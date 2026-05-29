from __future__ import annotations
import re
import math

from rag.models.query_models import RetrievedChunk

MIN_SEMANTIC_SCORE = 0.20
MIN_RERANK_SCORE = 0.0

GENERIC_PHRASES = (
    "i don't know",
    "i do not know",
    "not enough information",
    "insufficient information",
    "cannot determine",
    "can't determine",
    "cannot answer",
)

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

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
        "semantic": 20.0,
        "rerank": 40.0,
        "top_score": 20.0,
        "answerability": 10.0,
        "grounding": 10.0,
    }
    return top_chunks, confidence, factors


def calculate_confidence(chunks: list[RetrievedChunk]) -> float:
    if not chunks:
        return 0.0

    semantic_avg = (
        sum(chunk.semantic_score for chunk in chunks) / len(chunks)
    )

    rerank_scores = sorted(
        [chunk.rerank_score for chunk in chunks],
        reverse=True
    )

    top_rerank = rerank_scores[0]
    second_rerank = rerank_scores[1] if len(rerank_scores) > 1 else 0.0

    rerank_confidence = sigmoid(top_rerank - second_rerank)

    top_score = chunks[0].final_score

    grounding = len(chunks) / (len(chunks) + 2)

    confidence = (
        0.35 * semantic_avg
        + 0.30 * rerank_confidence
        + 0.20 * top_score
        + 0.15 * grounding
    )

    return round(clamp(confidence), 2)
def sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())
