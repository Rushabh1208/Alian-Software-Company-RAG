from __future__ import annotations
from __future__ import annotations

import re
import math
from typing import Tuple, Dict

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
    """
    Filter and select top_k chunks and return (selected_chunks, confidence, factor_values)

    factor_values are returned as percentages (0-100) for direct display in the UI.
    """
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

    confidence, factor_values = calculate_confidence(top_chunks)

    # scale factor values to percentages for frontend display
    factors_pct: Dict[str, float] = {
        "semantic": round(factor_values.get("semantic", 0.0) * 100.0, 2),
        "rerank": round(factor_values.get("rerank", 0.0) * 100.0, 2),
        "top_score": round(factor_values.get("top_score", 0.0) * 100.0, 2),
        "answerability": round(factor_values.get("answerability", 0.0) * 100.0, 2),
        "grounding": round(factor_values.get("grounding", 0.0) * 100.0, 2),
    }

    return top_chunks, confidence, factors_pct


def calculate_confidence(chunks: list[RetrievedChunk]) -> Tuple[float, dict]:
    """
    Return a tuple (confidence_score, factor_values_dict). factor_values are in [0,1].
    """
    if not chunks:
        return 0.0, {}

    semantic_avg = sum(chunk.semantic_score for chunk in chunks) / len(chunks)

    rerank_scores = sorted([chunk.rerank_score for chunk in chunks], reverse=True)
    top_rerank = rerank_scores[0] if rerank_scores else 0.0
    second_rerank = rerank_scores[1] if len(rerank_scores) > 1 else 0.0
    # difference-based signal; stable in [0,1] after sigmoid
    rerank_confidence = sigmoid(top_rerank - second_rerank)

    top_score = chunks[0].final_score if chunks else 0.0

    grounding = len(chunks) / (len(chunks) + 2)

    # answerability: penalize if chunks contain generic 'I don't know' type text
    generic_count = 0
    for chunk in chunks:
        text = (chunk.document or "").lower()
        if any(phrase in text for phrase in GENERIC_PHRASES):
            generic_count += 1
    answerability = max(0.0, 1.0 - (generic_count / max(1, len(chunks))))

    # Weighted composition (tuned): give rerank and top_score slightly more influence
    confidence = (
        0.30 * semantic_avg
        + 0.35 * rerank_confidence
        + 0.27 * top_score
        + 0.08 * grounding
    )

    # gentle positive bias
    confidence = confidence + 0.03

    confidence = clamp(confidence)

    factor_values = {
        "semantic": semantic_avg,
        "rerank": rerank_confidence,
        "top_score": top_score,
        "answerability": answerability,
        "grounding": grounding,
    }

    return round(confidence, 2), factor_values


def sigmoid(value: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-value))
    except Exception:
        return 0.5


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())
