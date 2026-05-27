from __future__ import annotations

from math import sqrt


def cosine_similarity(left: list[float], right: list[object]) -> float:
    numerator = 0.0
    left_norm = 0.0
    right_norm = 0.0

    for left_value, right_value in zip(left, right, strict=False):
        if not isinstance(right_value, (int, float)):
            continue
        right_float = float(right_value)
        numerator += left_value * right_float
        left_norm += left_value * left_value
        right_norm += right_float * right_float

    denominator = sqrt(left_norm) * sqrt(right_norm)
    if denominator == 0:
        return 0.0

    similarity = numerator / denominator
    return max(0.0, min(1.0, similarity))


def sigmoid(value: float) -> float:
    try:
        return 1.0 / (1.0 + pow(2.718281828459045, -value))
    except OverflowError:
        return 0.0 if value < 0 else 1.0


def normalize_overlap(left_terms: set[str], right_terms: set[str]) -> float:
    if not left_terms:
        return 0.0
    return min(1.0, len(left_terms.intersection(right_terms)) / max(len(left_terms), 1))

