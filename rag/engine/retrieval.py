from __future__ import annotations

from pathlib import Path

from rag.models.query_models import RetrievedChunk
from rag.ingestion.vectordb.chroma_client import ChromaVectorClient


# Simple module-level client cache to avoid repeated client construction
_CLIENT_CACHE: dict[str, ChromaVectorClient] = {}


def query_embedding_file(
    *,
    persist_directory: Path,
    collection_name: str,
    query_embedding: list[float],
    top_k: int,
) -> list[RetrievedChunk]:
    if top_k <= 0:
        return []

    cache_key = f"{str(persist_directory.resolve())}:{collection_name}"
    client = _CLIENT_CACHE.get(cache_key)
    if client is None:
        client = ChromaVectorClient(
            persist_directory=persist_directory,
            collection_name=collection_name,
        )
        _CLIENT_CACHE[cache_key] = client

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

        # Normalize distance into a more intuitive semantic score in [0,1]
        semantic_score = max(0.0, 1.0 - (raw_distance / 2.0))

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

