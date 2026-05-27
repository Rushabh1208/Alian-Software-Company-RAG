from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class ConfidenceBreakdown:
    semantic: float
    rerank: float
    top_score: float

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


@dataclass(frozen=True)
class QueryMetrics:
    embedding_latency_ms: float = 0.0
    retrieval_latency_ms: float = 0.0
    rerank_latency_ms: float = 0.0
    generation_latency_ms: float = 0.0
    total_latency_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    throughput_tokens_per_sec: float = 0.0
    retrieved_chunks: int = 0
    accepted_chunks: int = 0
    avg_semantic_score: float = 0.0
    avg_rerank_score: float = 0.0

    def as_dict(self) -> dict[str, float | int]:
        return asdict(self)

