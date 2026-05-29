from __future__ import annotations


def confidence_label(confidence: float) -> str:
    if confidence >= 0.65:
        return "high"
    if confidence >= 0.40:
        return "med"
    return "low"


def build_metrics(
    *,
    embedding_latency_ms: float,
    retrieval_latency_ms: float,
    rerank_latency_ms: float,
    generation_latency_ms: float,
    total_latency_ms: float,
    input_tokens: int,
    output_tokens: int,
    retrieved_chunks: int,
    accepted_chunks: int,
    avg_semantic_score: float,
    avg_rerank_score: float,
) -> dict[str, float | int]:
    return {
        "embedding_latency_ms": round(embedding_latency_ms, 2),
        "retrieval_latency_ms": round(retrieval_latency_ms, 2),
        "rerank_latency_ms": round(rerank_latency_ms, 2),
        "generation_latency_ms": round(generation_latency_ms, 2),
        "total_latency_ms": round(total_latency_ms, 2),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "throughput_tokens_per_sec": round(output_tokens / max(generation_latency_ms / 1000.0, 1e-6), 2)
        if generation_latency_ms > 0
        else 0.0,
        "retrieved_chunks": retrieved_chunks,
        "accepted_chunks": accepted_chunks,
        "avg_semantic_score": round(avg_semantic_score, 4),
        "avg_rerank_score": round(avg_rerank_score, 4),
    }

