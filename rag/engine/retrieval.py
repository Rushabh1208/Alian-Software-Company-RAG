from __future__ import annotations

from pathlib import Path

from rag.models.query_models import RetrievedChunk
from rag.ingestion.vectordb.chroma_client import ChromaVectorClient


def query_embedding_file(
    *,
    persist_directory: Path,
    collection_name: str,
    query_embedding: list[float],
    top_k: int,
) -> list[RetrievedChunk]:
    if top_k <= 0:
        return []

    client = ChromaVectorClient(
        persist_directory=persist_directory,
        collection_name=collection_name,
    )

    try:
        result = client.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    ids = (result.get("ids") or [[]])[0]
    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    chunks: list[RetrievedChunk] = []
    for rank, (chunk_id, document, metadata, distance) in enumerate(
        zip(ids, documents, metadatas, distances, strict=False),
        start=1,
    ):
        if not isinstance(document, str):
            continue
        if not isinstance(metadata, dict):
            metadata = {}

        try:
            raw_distance = float(distance)
        except (TypeError, ValueError):
            raw_distance = 1.0

        semantic_score = 1.0 / (1.0 + max(raw_distance, 0.0))

        chunks.append(
            RetrievedChunk(
                rank=rank,
                chunk_id=str(chunk_id or metadata.get("chunk_id") or ""),
                document=document,
                metadata=metadata,
                semantic_score=semantic_score,
                rerank_score=0.0,
                final_score=semantic_score,
            )
        )

    return chunks

