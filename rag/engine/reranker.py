from __future__ import annotations

from rag.models.query_models import RetrievedChunk
from rag.utils.similarity import sigmoid
from rag.utils.text_utils import compact, content_body


def rerank_chunks(
    question: str,
    chunks: list[RetrievedChunk],
    cross_encoder: object | None,
) -> list[RetrievedChunk]:
    if not chunks:
        return []

    pairs = [(question, chunk_text(chunk)) for chunk in chunks]
    ce_scores = cross_encoder_scores(cross_encoder, pairs)

    reranked: list[RetrievedChunk] = []
    for index, chunk in enumerate(chunks):
        rerank_score = ce_scores[index] if index < len(ce_scores) else 0.65
        final_score = 0.75 * rerank_score + 0.25 * chunk.semantic_score
        reranked.append(
            RetrievedChunk(
                rank=chunk.rank,
                chunk_id=chunk.chunk_id,
                document=chunk.document,
                metadata=chunk.metadata,
                semantic_score=chunk.semantic_score,
                rerank_score=rerank_score,
                final_score=final_score,
            )
        )

    reranked.sort(key=lambda c: c.final_score, reverse=True)
    return [
        RetrievedChunk(
            rank=index + 1,
            chunk_id=chunk.chunk_id,
            document=chunk.document,
            metadata=chunk.metadata,
            semantic_score=chunk.semantic_score,
            rerank_score=chunk.rerank_score,
            final_score=chunk.final_score,
        )
        for index, chunk in enumerate(reranked)
    ]


def cross_encoder_scores(
    cross_encoder: object | None,
    pairs: list[tuple[str, str]],
) -> list[float]:
    if cross_encoder is None:
        return [0.65 for _ in pairs]

    try:
        scores = cross_encoder.predict(pairs, convert_to_numpy=True)
        return [sigmoid(float(score)) for score in scores]
    except Exception:
        return [0.65 for _ in pairs]


def chunk_text(chunk: RetrievedChunk) -> str:
    return " ".join(
        part
        for part in [
            chunk.title,
            chunk.heading,
            compact(content_body(chunk.document), max_chars=1000),
        ]
        if part
    )

