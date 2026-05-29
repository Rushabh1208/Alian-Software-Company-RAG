from __future__ import annotations

import asyncio
import os
from pathlib import Path
from time import perf_counter

from dotenv import load_dotenv

from rag.ingestion.embeddings.embedding_generator import HuggingFaceEmbeddingGenerator
from rag.engine.confidence import filter_chunks
from rag.engine.generator import generate_answer
from rag.engine.reranker import rerank_chunks
from rag.engine.retrieval import query_embedding_file
from rag.models.query_models import QueryResult
from rag.utils.metrics import build_metrics, confidence_label

try:
    from sentence_transformers import CrossEncoder
except Exception:
    CrossEncoder = None

try:
    from google import genai
except Exception:
    genai = None


INITIAL_RETRIEVAL_K = 20


class RagQueryEngine:
    def __init__(
        self,
        *,
        persist_directory: Path,
        collection_name: str,
        model_name: str,
        normalize_embeddings: bool,
        model_cache_dir: Path,
        embeddings_path: Path,
    ) -> None:
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embeddings_path = embeddings_path

        load_dotenv()

        self.embedding_generator = HuggingFaceEmbeddingGenerator(
            model_name=model_name,
            normalize_embeddings=normalize_embeddings,
            cache_folder=model_cache_dir,
            local_files_only=False,
        )

        self.query_prefix = (
            "Represent this sentence for searching relevant passages: "
            if "bge-" in model_name
            else ""
        )

        self.cross_encoder = self._load_cross_encoder()
        self.gemini_client = self._load_gemini_client()

    async def ask(
        self,
        question: str,
        *,
        top_k: int = 5,
    ) -> QueryResult:
        total_started = perf_counter()

        cleaned_question = question.strip()
        if not cleaned_question:
            raise ValueError("Question cannot be empty")

        embedding_started = perf_counter()
        query_embedding = await self.embedding_generator.embed_query(
            f"{self.query_prefix}{cleaned_question}"
        )
        embedding_latency_ms = (perf_counter() - embedding_started) * 1000.0

        retrieval_started = perf_counter()
        candidate_chunks = await asyncio.to_thread(
            query_embedding_file,
            persist_directory=self.persist_directory,
            collection_name=self.collection_name,
            query_embedding=query_embedding,
            top_k=INITIAL_RETRIEVAL_K,
        )
        retrieval_latency_ms = (perf_counter() - retrieval_started) * 1000.0

        rerank_started = perf_counter()
        reranked_chunks = rerank_chunks(
            cleaned_question,
            candidate_chunks,
            self.cross_encoder,
        )
        rerank_latency_ms = (perf_counter() - rerank_started) * 1000.0

        accepted_chunks, confidence, confidence_factors = filter_chunks(
            reranked_chunks,
            top_k=top_k,
        )
        confidence_label_value = confidence_label(confidence)

        if not accepted_chunks:
            metrics = build_metrics(
                embedding_latency_ms=embedding_latency_ms,
                retrieval_latency_ms=retrieval_latency_ms,
                rerank_latency_ms=rerank_latency_ms,
                generation_latency_ms=0.0,
                total_latency_ms=(perf_counter() - total_started) * 1000.0,
                input_tokens=0,
                output_tokens=0,
                retrieved_chunks=len(candidate_chunks),
                accepted_chunks=0,
                avg_semantic_score=0.0,
                avg_rerank_score=0.0,
            )
            return QueryResult(
                question=cleaned_question,
                answer="I don’t know based on indexed content.",
                confidence=0.0,
                chunks=[],
                confidence_label="low",
                confidence_factors=confidence_factors,
                metrics=metrics,
            )

        generation_started = perf_counter()
        answer, input_tokens, output_tokens = await generate_answer(
            gemini_client=self.gemini_client,
            question=cleaned_question,
            chunks=accepted_chunks,
        )
        generation_latency_ms = (perf_counter() - generation_started) * 1000.0
        total_latency_ms = (perf_counter() - total_started) * 1000.0

        metrics = build_metrics(
            embedding_latency_ms=embedding_latency_ms,
            retrieval_latency_ms=retrieval_latency_ms,
            rerank_latency_ms=rerank_latency_ms,
            generation_latency_ms=generation_latency_ms,
            total_latency_ms=total_latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            retrieved_chunks=len(candidate_chunks),
            accepted_chunks=len(accepted_chunks),
            avg_semantic_score=sum(c.semantic_score for c in accepted_chunks) / len(accepted_chunks),
            avg_rerank_score=sum(c.rerank_score for c in accepted_chunks) / len(accepted_chunks),
        )

        return QueryResult(
            question=cleaned_question,
            answer=answer,
            confidence=confidence,
            chunks=accepted_chunks[:top_k],
            confidence_label=confidence_label_value,
            confidence_factors=confidence_factors,
            metrics=metrics,
        )

    @staticmethod
    def _load_cross_encoder():
        if CrossEncoder is None:
            return None
        try:
            return CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu")
        except Exception:
            return None

    @staticmethod
    def _load_gemini_client():
        if genai is None:
            return None

        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            return None

        try:
            return genai.Client(api_key=api_key)
        except Exception:
            return None

