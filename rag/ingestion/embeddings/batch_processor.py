from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from rag.ingestion.embeddings.embedding_cache import EmbeddingCache
from rag.ingestion.embeddings.embedding_generator import HuggingFaceEmbeddingGenerator


@dataclass
class EmbeddingBatchResult:
    embeddings: list[dict[str, Any]] = field(default_factory=list)
    failures: list[dict[str, Any]] = field(default_factory=list)
    cached_count: int = 0
    duplicate_count: int = 0


class EmbeddingBatchProcessor:
    def __init__(
        self,
        *,
        generator: HuggingFaceEmbeddingGenerator,
        cache: EmbeddingCache,
        batch_size: int,
        logger: logging.Logger | None = None,
    ) -> None:
        self.generator = generator
        self.cache = cache
        self.batch_size = batch_size
        self.logger = logger or logging.getLogger(__name__)

    async def process(self, chunks: list[dict[str, Any]]) -> EmbeddingBatchResult:
        result = EmbeddingBatchResult()
        expected_dimension: int | None = None
        seen_hashes: set[str] = set()
        pending: list[dict[str, Any]] = []

        for chunk in chunks:
            content = str(chunk.get("content") or "").strip()
            chunk_id = str(chunk.get("chunk_id") or "")

            if not content:
                result.failures.append(self._failure(chunk, "empty content"))
                self.logger.warning("Embedding skipped for empty chunk: %s", chunk_id)
                continue

            content_hash = self.cache.content_hash(content)
            if content_hash in seen_hashes:
                result.duplicate_count += 1
                self.logger.info("Duplicate chunk skipped: %s", chunk_id)
                continue

            seen_hashes.add(content_hash)
            cached_embedding = self.cache.get(self.generator.model_name, content_hash)
            if cached_embedding is not None:
                if expected_dimension is None:
                    expected_dimension = len(cached_embedding)
                if not self._valid_embedding(cached_embedding, expected_dimension):
                    result.failures.append(self._failure(chunk, "invalid cached embedding"))
                    self.logger.warning("Invalid cached embedding skipped: %s", chunk_id)
                    continue

                result.cached_count += 1
                self.logger.debug("Cached embedding reused: %s", chunk_id)
                result.embeddings.append(self._record(chunk, cached_embedding))
                continue

            pending.append(
                {
                    "chunk": chunk,
                    "content": content,
                    "content_hash": content_hash,
                }
            )

            if len(pending) >= self.batch_size:
                expected_dimension = await self._flush_pending(
                    pending,
                    result,
                    expected_dimension,
                )
                pending.clear()

        if pending:
            await self._flush_pending(pending, result, expected_dimension)

        self.cache.save()

        return result

    async def _flush_pending(
        self,
        pending: list[dict[str, Any]],
        result: EmbeddingBatchResult,
        expected_dimension: int | None,
    ) -> int | None:
        try:
            vectors = await self.generator.embed_documents([item["content"] for item in pending])
        except Exception as exc:  # noqa: BLE001 - failures are written to failed_embeddings.json
            self.logger.exception("Embedding batch failed")
            for item in pending:
                result.failures.append(self._failure(item["chunk"], str(exc)))
            return expected_dimension

        if len(vectors) != len(pending):
            reason = f"embedding count mismatch: expected {len(pending)}, got {len(vectors)}"
            for item in pending:
                result.failures.append(self._failure(item["chunk"], reason))
            self.logger.error(reason)
            return expected_dimension

        for item, vector in zip(pending, vectors, strict=True):
            if expected_dimension is None:
                expected_dimension = len(vector)

            if not self._valid_embedding(vector, expected_dimension):
                result.failures.append(self._failure(item["chunk"], "invalid embedding vector"))
                self.logger.warning("Invalid embedding vector skipped: %s", item["chunk"].get("chunk_id"))
                continue

            self.cache.set(
                model_name=self.generator.model_name,
                content_hash=item["content_hash"],
                embedding=vector,
                metadata={"chunk_id": item["chunk"].get("chunk_id")},
            )
            result.embeddings.append(self._record(item["chunk"], vector))

        return expected_dimension

    @staticmethod
    def _valid_embedding(vector: Any, expected_dimension: int) -> bool:
        return (
            isinstance(vector, list)
            and len(vector) == expected_dimension
            and expected_dimension > 0
            and all(isinstance(value, int | float) for value in vector)
        )

    @staticmethod
    def _metadata(chunk: dict[str, Any]) -> dict[str, Any]:
        metadata = chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
        return {
            "chunk_id": str(chunk.get("chunk_id") or ""),
            "document_id": str(chunk.get("document_id") or ""),
            "source_url": str(metadata.get("source_url") or ""),
            "title": str(metadata.get("title") or ""),
            "category": str(metadata.get("category") or ""),
            "heading": str(metadata.get("heading") or ""),
            "source_type": str(metadata.get("source_type") or "website"),
            "collection": str(metadata.get("collection") or ""),
        }

    def _record(self, chunk: dict[str, Any], embedding: list[float]) -> dict[str, Any]:
        return {
            "id": str(chunk.get("chunk_id") or self.cache.content_hash(str(chunk.get("content") or ""))),
            "embedding": embedding,
            "document": str(chunk.get("content") or "").strip(),
            "metadata": self._metadata(chunk),
        }

    def _failure(self, chunk: dict[str, Any], reason: str) -> dict[str, Any]:
        return {
            "id": str(chunk.get("chunk_id") or ""),
            "document": str(chunk.get("content") or ""),
            "metadata": self._metadata(chunk),
            "error": reason,
        }

