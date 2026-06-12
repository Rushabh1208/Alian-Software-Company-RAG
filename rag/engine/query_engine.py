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
from rag.prompts.prompt_settings import load_prompt_settings_for_user
from rag.utils.metrics import build_metrics, confidence_label
from rag.engine.query_expander import expand_query

try:
    from sentence_transformers import CrossEncoder
except Exception:
    CrossEncoder = None

try:
    from google import genai
except Exception:
    genai = None


load_dotenv()

_EMBEDDING_GENERATOR_CACHE: dict[str, HuggingFaceEmbeddingGenerator] = {}
_CROSS_ENCODER_CACHE: dict[str, object | None] = {}
_GEMINI_CLIENT: object | None = None


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
        retrieval_config: dict[str, object] | None = None,
        reranking_config: dict[str, object] | None = None,
        # NEW: optional user id for per-user prompt settings
        user_id: str | None = None,
    ) -> None:
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embeddings_path = embeddings_path
        self.user_id = user_id  # NEW
        self.retrieval_config = retrieval_config or {}
        self.reranking_config = reranking_config or {}

        self.embedding_generator = self._get_embedding_generator(
            model_name=model_name,
            normalize_embeddings=normalize_embeddings,
            cache_folder=model_cache_dir,
        )

        self.query_prefix = (
            "Represent this sentence for searching relevant passages: "
            if "bge-" in model_name
            else ""
        )

        self.cross_encoder = self._load_cross_encoder(
            model_name=str(self.reranking_config.get("model", "cross-encoder/ms-marco-MiniLM-L-6-v2")),
            backend=str(self.reranking_config.get("backend", "auto")),
            enabled=bool(self.reranking_config.get("enabled", True)),
        )
        self.gemini_client = self._load_gemini_client()

    @classmethod
    def _get_embedding_generator(
        cls,
        *,
        model_name: str,
        normalize_embeddings: bool,
        cache_folder: Path,
    ) -> HuggingFaceEmbeddingGenerator:
        cache_key = f"{model_name}|{normalize_embeddings}|{str(cache_folder.resolve())}"
        embedding_generator = _EMBEDDING_GENERATOR_CACHE.get(cache_key)
        if embedding_generator is None:
            embedding_generator = HuggingFaceEmbeddingGenerator(
                model_name=model_name,
                normalize_embeddings=normalize_embeddings,
                cache_folder=cache_folder,
                local_files_only=False,
            )
            _EMBEDDING_GENERATOR_CACHE[cache_key] = embedding_generator
        return embedding_generator

    async def ask(
        self,
        question: str,
        *,
        top_k: int = 10,
        # NEW: per-request override (e.g. from widget queries)
        user_id: str | None = None,
    ) -> QueryResult:
        total_started = perf_counter()

        cleaned_question = question.strip()
        if not cleaned_question:
            raise ValueError("Question cannot be empty")

        embedding_started = perf_counter()
        sub_questions = await expand_query(cleaned_question, self.gemini_client)
        embedding_latency_ms = (perf_counter() - embedding_started) * 1000.0

        retrieval_started = perf_counter()
        seen_chunk_ids: set[str] = set()
        candidate_chunks: list = []

        for sub_q in sub_questions:
            sub_embedding = await self.embedding_generator.embed_query(
                f"{self.query_prefix}{sub_q}"
            )
            sub_chunks = await asyncio.to_thread(
                query_embedding_file,
                persist_directory=self.persist_directory,
                collection_name=self.collection_name,
                query_embedding=sub_embedding,
                top_k=self._initial_retrieval_k(),
            )
            for chunk in sub_chunks:
                if chunk.semantic_score < self._minimum_semantic_score():
                    continue
                if chunk.chunk_id not in seen_chunk_ids:
                    seen_chunk_ids.add(chunk.chunk_id)
                    candidate_chunks.append(chunk)

        retrieval_latency_ms = (perf_counter() - retrieval_started) * 1000.0

        rerank_started = perf_counter()
        reranking_enabled = bool(self.reranking_config.get("enabled", True))
        skip_rerank = (
            not reranking_enabled
            or (
                len(sub_questions) == 1
                and candidate_chunks
                and getattr(candidate_chunks[0], "semantic_score", 0.0) > 0.82
            )
        )
        if skip_rerank:
            reranked_chunks = candidate_chunks
            rerank_latency_ms = 0.0
        else:
            reranked_chunks = rerank_chunks(
                cleaned_question,
                candidate_chunks,
                self.cross_encoder,
            )
            rerank_latency_ms = (perf_counter() - rerank_started) * 1000.0

        final_top_k = self._final_top_k(top_k)
        accepted_chunks, confidence, confidence_factors = filter_chunks(
            reranked_chunks,
            top_k=final_top_k,
        )

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
                answer="I don't know based on indexed content.",
                confidence=0.0,
                chunks=[],
                confidence_label="low",
                confidence_factors=confidence_factors,
                metrics=metrics,
            )

        generation_started = perf_counter()

        # Resolve prompt settings with user-scoped fallback chain
        # (user-specific → global collection → defaults)
        prompt_settings = load_prompt_settings_for_user(
            user_id or self.user_id,
            self.collection_name,
        )

        answer_future = generate_answer(
            gemini_client=self.gemini_client,
            question=cleaned_question,
            chunks=accepted_chunks,
            prompt_settings=prompt_settings,
        )
        confidence_future = asyncio.to_thread(confidence_label, confidence)
        (answer, input_tokens, output_tokens), confidence_label_value = await asyncio.gather(
            answer_future,
            confidence_future,
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
            chunks=accepted_chunks[:final_top_k],
            confidence_label=confidence_label_value,
            confidence_factors=confidence_factors,
            metrics=metrics,
        )

    @staticmethod
    def _load_cross_encoder(model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2", backend: str = "auto", enabled: bool = True):
        if not enabled:
            return None
        if CrossEncoder is None:
            return None
        cache_key = f"{backend}|{model_name}"
        if cache_key in _CROSS_ENCODER_CACHE:
            return _CROSS_ENCODER_CACHE[cache_key]
        try:
            cross_encoder = CrossEncoder(model_name, device="cpu")
        except Exception:
            cross_encoder = None
        _CROSS_ENCODER_CACHE[cache_key] = cross_encoder
        return cross_encoder

    def _initial_retrieval_k(self) -> int:
        try:
            return max(1, int(self.retrieval_config.get("vector_top_k", 20)))
        except (TypeError, ValueError):
            return 20

    def _final_top_k(self, requested_top_k: int) -> int:
        try:
            configured = max(1, int(self.retrieval_config.get("final_top_k", requested_top_k)))
        except (TypeError, ValueError):
            configured = max(1, requested_top_k)
        return max(1, min(max(1, requested_top_k), configured))

    def _minimum_semantic_score(self) -> float:
        try:
            max_distance = float(self.retrieval_config.get("max_search_distance", 1.15))
        except (TypeError, ValueError):
            max_distance = 1.15
        return max(0.0, min(1.0, 1.0 - (max_distance / 2.0)))

    @staticmethod
    def _load_gemini_client():
        global _GEMINI_CLIENT
        if genai is None:
            return None
        if _GEMINI_CLIENT is not None:
            return _GEMINI_CLIENT
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            return None
        try:
            _GEMINI_CLIENT = genai.Client(api_key=api_key)
        except Exception:
            _GEMINI_CLIENT = None
        return _GEMINI_CLIENT
