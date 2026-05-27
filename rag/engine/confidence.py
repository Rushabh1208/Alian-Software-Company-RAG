from __future__ import annotations

from rag.models.query_models import RetrievedChunk

MIN_SEMANTIC_SCORE = 0.15
MIN_RERANK_SCORE = 0.35


def filter_chunks(
    chunks: list[RetrievedChunk],
    *,
    top_k: int,
) -> tuple[list[RetrievedChunk], float, dict[str, float]]:
    if not chunks:
        return [], 0.0, {}

    filtered = [
        chunk
        for chunk in chunks
        if chunk.semantic_score >= MIN_SEMANTIC_SCORE and chunk.rerank_score >= MIN_RERANK_SCORE
    ]

    if not filtered:
        filtered = chunks[:top_k]

    top_chunks = filtered[:top_k]
    confidence = calculate_confidence(top_chunks)
    factors = {
        "semantic": 30.0,
        "rerank": 50.0,
        "top_score": 20.0,
    }
    return top_chunks, confidence, factors


def calculate_confidence(chunks: list[RetrievedChunk]) -> float:
    if not chunks:
        return 0.0

    semantic_avg = sum(chunk.semantic_score for chunk in chunks) / len(chunks)
    rerank_avg = sum(chunk.rerank_score for chunk in chunks) / len(chunks)
    top_score = chunks[0].final_score

    confidence = 0.30 * semantic_avg + 0.50 * rerank_avg + 0.20 * top_score
    return round(max(0.0, min(1.0, confidence)), 2)

