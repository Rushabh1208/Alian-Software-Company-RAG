from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievedChunk:
    rank: int
    chunk_id: str
    document: str
    metadata: dict[str, object]
    semantic_score: float = 0.0
    rerank_score: float = 0.0
    final_score: float = 0.0

    @property
    def source_url(self) -> str:
        return str(self.metadata.get("source_url") or "")

    @property
    def title(self) -> str:
        return str(self.metadata.get("title") or "")

    @property
    def heading(self) -> str:
        return str(self.metadata.get("heading") or "")


@dataclass(frozen=True)
class QueryResult:
    question: str
    answer: str
    confidence: float
    chunks: list[RetrievedChunk]
    confidence_label: str = "low"
    confidence_factors: dict[str, float] | None = None
    metrics: dict[str, float | int] | None = None

