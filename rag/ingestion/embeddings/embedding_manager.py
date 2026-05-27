from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rag.ingestion.embeddings.batch_processor import EmbeddingBatchProcessor
from rag.ingestion.embeddings.embedding_cache import EmbeddingCache
from rag.ingestion.embeddings.embedding_generator import HuggingFaceEmbeddingGenerator


@dataclass(frozen=True)
class EmbeddingSummary:
    total_chunks: int
    embedded_chunks: int
    cached_chunks: int
    failed_embeddings: int
    duplicate_chunks: int
    model_used: str

    def render(self) -> str:
        return "\n".join(
            [
                "EMBEDDING SUMMARY",
                f"- total chunks: {self.total_chunks}",
                f"- embedded chunks: {self.embedded_chunks}",
                f"- cached chunks: {self.cached_chunks}",
                f"- failed embeddings: {self.failed_embeddings}",
                f"- duplicate chunks: {self.duplicate_chunks}",
                f"- model used: {self.model_used}",
            ]
        )


class EmbeddingManager:
    def __init__(
        self,
        *,
        chunks_path: Path,
        output_dir: Path,
        model_name: str,
        batch_size: int,
        normalize_embeddings: bool,
        logger: logging.Logger | None = None,
    ) -> None:
        self.chunks_path = chunks_path
        self.output_dir = output_dir
        self.model_name = model_name
        self.batch_size = batch_size
        self.normalize_embeddings = normalize_embeddings
        self.logger = logger or logging.getLogger(__name__)

    async def run(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], EmbeddingSummary]:
        chunks = self._load_chunks()
        self.output_dir.mkdir(parents=True, exist_ok=True)

        generator = HuggingFaceEmbeddingGenerator(
            model_name=self.model_name,
            normalize_embeddings=self.normalize_embeddings,
            cache_folder=self.output_dir / "model_cache",
            local_files_only=True,
            logger=self.logger,
        )
        cache = EmbeddingCache(self.output_dir / "embedding_cache.json", logger=self.logger)
        processor = EmbeddingBatchProcessor(
            generator=generator,
            cache=cache,
            batch_size=self.batch_size,
            logger=self.logger,
        )

        result = await processor.process(chunks)
        cache.save()

        embeddings_path = self.output_dir / "embeddings.json"
        failures_path = self.output_dir / "failed_embeddings.json"
        self._write_json(embeddings_path, result.embeddings)
        self._write_json(failures_path, result.failures)

        summary = EmbeddingSummary(
            total_chunks=len(chunks),
            embedded_chunks=len(result.embeddings),
            cached_chunks=result.cached_count,
            failed_embeddings=len(result.failures),
            duplicate_chunks=result.duplicate_count,
            model_used=self.model_name,
        )
        self.logger.info(summary.render().replace("\n", " | "))
        return result.embeddings, result.failures, summary

    def _load_chunks(self) -> list[dict[str, Any]]:
        if not self.chunks_path.exists():
            raise FileNotFoundError(f"Chunk file not found: {self.chunks_path}")

        with self.chunks_path.open("r", encoding="utf-8") as chunks_file:
            data = json.load(chunks_file)

        if not isinstance(data, list):
            raise ValueError(f"Chunk file must contain a list: {self.chunks_path}")

        return [item for item in data if isinstance(item, dict)]

    @staticmethod
    def _write_json(path: Path, data: Any) -> None:
        temp_path = path.with_suffix(f"{path.suffix}.tmp")
        with temp_path.open("w", encoding="utf-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=2)
        temp_path.replace(path)

