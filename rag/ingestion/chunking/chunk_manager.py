from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Any

from rag.ingestion.chunking.chunker import (
    MIN_CHUNK_TOKENS,
    SemanticChunker,
    chunk_fingerprint,
    chunk_settings,
    stable_chunk_id,
)
from rag.models.ingest_models import ChunkDocument, ChunkMetadata, MetadataDocument, RejectedChunk


@dataclass(frozen=True)
class ChunkingSummary:
    total_documents: int
    total_chunks: int
    rejected_chunks: int
    average_chunk_size: float
    average_token_count: float

    def render(self) -> str:
        return "\n".join(
            [
                "CHUNKING SUMMARY",
                f"- total documents: {self.total_documents}",
                f"- total chunks: {self.total_chunks}",
                f"- rejected chunks: {self.rejected_chunks}",
                f"- average chunk size: {self.average_chunk_size:.2f}",
                f"- average token count: {self.average_token_count:.2f}",
            ]
        )


class ChunkManager:
    def __init__(
        self,
        metadata_path: Path,
        output_dir: Path,
        chunk_size: int,
        overlap: int,
        collection_name: str,
        logger: logging.Logger,
    ) -> None:
        self.metadata_path = metadata_path
        self.output_dir = output_dir
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.collection_name = collection_name
        self.logger = logger
        self.chunker = SemanticChunker()

    def run(self) -> tuple[list[ChunkDocument], list[RejectedChunk], ChunkingSummary]:
        documents = self._load_metadata_documents()
        chunks: list[ChunkDocument] = []
        rejected: list[RejectedChunk] = []
        seen_fingerprints: dict[str, str] = {}

        for document in documents:
            try:
                document_chunks = self.chunker.chunk_text(
                    text=document.content,
                    category=document.category,
                    fallback_heading=document.section_heading or document.title,
                    title=document.title,
                    source_url=str(document.source_url),
                    default_chunk_size=self.chunk_size,
                    default_overlap=self.overlap,
                )
                category_chunk_size, _ = chunk_settings(
                    document.category,
                    self.chunk_size,
                    self.overlap,
                )

                for index, (heading, content) in enumerate(document_chunks, start=1):
                    token_count = self.chunker.token_count(content)
                    rejection_reason = self._rejection_reason(content, token_count)
                    if rejection_reason:
                        rejected.append(self._reject(document, content, token_count, rejection_reason))
                        self.logger.warning(
                            "Rejected chunk for %s: %s",
                            document.source_url,
                            rejection_reason,
                        )
                        continue

                    fingerprint = chunk_fingerprint(content)
                    if fingerprint in seen_fingerprints:
                        rejected.append(self._reject(document, content, token_count, "duplicate chunk"))
                        self.logger.warning(
                            "Rejected duplicate chunk for %s; duplicate of %s",
                            document.source_url,
                            seen_fingerprints[fingerprint],
                        )
                        continue
                    seen_fingerprints[fingerprint] = str(document.source_url)

                    if token_count > category_chunk_size:
                        self.logger.warning(
                            "Token overflow for %s chunk %s: %s tokens > %s",
                            document.source_url,
                            index,
                            token_count,
                            category_chunk_size,
                        )

                    chunks.append(
                        ChunkDocument(
                            chunk_id=stable_chunk_id(document.document_id, content, index),
                            document_id=document.document_id,
                            content=content,
                            token_count=token_count,
                            metadata=ChunkMetadata(
                            source_url=str(document.source_url),
                            title=document.title,
                            category=document.category,
                            heading=heading,
                            source_type=document.source_type,
                            collection=self.collection_name or document.collection,
                        ),
                    )
                    )
            except Exception as exc:
                self.logger.exception("Chunking failed for %s: %s", document.source_url, exc)
                rejected.append(self._reject(document, "", 0, f"chunking failure: {exc}"))

        self._write_outputs(chunks, rejected)
        summary = ChunkingSummary(
            total_documents=len(documents),
            total_chunks=len(chunks),
            rejected_chunks=len(rejected),
            average_chunk_size=mean([len(chunk.content) for chunk in chunks]) if chunks else 0.0,
            average_token_count=mean([chunk.token_count for chunk in chunks]) if chunks else 0.0,
        )
        return chunks, rejected, summary

    def _load_metadata_documents(self) -> list[MetadataDocument]:
        with self.metadata_path.open("r", encoding="utf-8") as input_file:
            payload = json.load(input_file)
        if not isinstance(payload, list):
            raise ValueError(f"Expected list of metadata documents: {self.metadata_path}")
        return [MetadataDocument.model_validate(item) for item in payload]

    def _write_outputs(
        self,
        chunks: list[ChunkDocument],
        rejected: list[RejectedChunk],
    ) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        with (self.output_dir / "chunked_documents.json").open("w", encoding="utf-8") as output_file:
            json.dump(
                [chunk.model_dump(mode="json") for chunk in chunks],
                output_file,
                indent=2,
                ensure_ascii=False,
            )

        with (self.output_dir / "rejected_chunks.json").open("w", encoding="utf-8") as output_file:
            json.dump(
                [chunk.model_dump(mode="json") for chunk in rejected],
                output_file,
                indent=2,
                ensure_ascii=False,
            )

    @staticmethod
    def _rejection_reason(content: str, token_count: int) -> str:
        if not content.strip():
            return "empty chunk"
        if token_count < MIN_CHUNK_TOKENS:
            return "extremely small chunk"
        return ""

    @staticmethod
    def _reject(
        document: MetadataDocument,
        content: str,
        token_count: int,
        reason: str,
    ) -> RejectedChunk:
        return RejectedChunk(
            document_id=document.document_id,
            source_url=str(document.source_url),
            content=content,
            token_count=token_count,
            reason=reason,
        )

