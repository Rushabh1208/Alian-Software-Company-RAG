from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from rag.ingestion.cleaner.cleaner import DocumentCleaner
from rag.ingestion.cleaner.deduplicator import fingerprint_text
from rag.ingestion.cleaner.normalizer import normalize_text


MIN_CONTENT_LENGTH = 100


class CleanedDocument(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    document_id: str
    url: str
    title: str
    content: str
    cleaned_content: str
    language: str = "en"


class RejectedDocument(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: str
    title: str = ""
    reason: str
    content_length: int = 0
    duplicate_of: str = ""


@dataclass(frozen=True)
class CleaningSummary:
    total_documents: int
    cleaned_documents: int
    rejected_documents: int
    duplicates_removed: int
    average_content_length: float

    def render(self) -> str:
        return "\n".join(
            [
                "CLEANING SUMMARY",
                f"- total documents: {self.total_documents}",
                f"- cleaned documents: {self.cleaned_documents}",
                f"- rejected documents: {self.rejected_documents}",
                f"- duplicates removed: {self.duplicates_removed}",
                f"- average content length: {self.average_content_length:.2f}",
            ]
        )


class CleaningManager:
    def __init__(
        self,
        parsed_dir: Path,
        cleaned_dir: Path,
        logger: logging.Logger,
    ) -> None:
        self.parsed_dir = parsed_dir
        self.cleaned_dir = cleaned_dir
        self.logger = logger
        self.cleaner = DocumentCleaner()

    def run(self) -> tuple[list[CleanedDocument], list[RejectedDocument], CleaningSummary]:
        documents = self._load_parsed_documents()
        self.cleaned_dir.mkdir(parents=True, exist_ok=True)

        cleaned_documents: list[CleanedDocument] = []
        rejected_documents: list[RejectedDocument] = []
        seen_fingerprints: dict[str, str] = {}
        duplicates_removed = 0
        cleaned_lengths: list[int] = []

        for index, document in enumerate(documents, start=1):
            url = str(document.get("url") or "")
            title, title_changed = normalize_text(str(document.get("title") or ""))
            if title_changed:
                self.logger.info("Normalized title encoding for %s", url)

            original_content = str(document.get("content") or "")
            cleaned_text = self.cleaner.clean_document_text(document)
            if cleaned_text.encoding_fixed:
                self.logger.info("Applied encoding fixes for %s", url)
            if cleaned_text.repeated_lines_removed:
                self.logger.info(
                    "Removed %s repeated lines from %s",
                    cleaned_text.repeated_lines_removed,
                    url,
                )
            if cleaned_text.duplicate_paragraphs_removed:
                self.logger.info(
                    "Removed %s duplicate paragraphs from %s",
                    cleaned_text.duplicate_paragraphs_removed,
                    url,
                )

            rejection = self._rejection_reason(cleaned_text.text)
            if rejection:
                rejected = RejectedDocument(
                    url=url,
                    title=title,
                    reason=rejection,
                    content_length=len(cleaned_text.text),
                )
                rejected_documents.append(rejected)
                self.logger.warning("Rejected %s: %s", url, rejection)
                continue

            fingerprint = fingerprint_text(cleaned_text.text)
            if fingerprint in seen_fingerprints:
                duplicates_removed += 1
                duplicate_of = seen_fingerprints[fingerprint]
                rejected = RejectedDocument(
                    url=url,
                    title=title,
                    reason="duplicate document",
                    content_length=len(cleaned_text.text),
                    duplicate_of=duplicate_of,
                )
                rejected_documents.append(rejected)
                self.logger.warning("Rejected duplicate %s; duplicate of %s", url, duplicate_of)
                continue

            document_id = f"doc-{index:05d}"
            cleaned_document = CleanedDocument(
                document_id=document_id,
                url=url,
                title=title,
                content=original_content,
                cleaned_content=cleaned_text.text,
                language="en",
            )
            cleaned_documents.append(cleaned_document)
            cleaned_lengths.append(len(cleaned_document.cleaned_content))
            seen_fingerprints[fingerprint] = url

        self._write_outputs(cleaned_documents, rejected_documents)
        summary = CleaningSummary(
            total_documents=len(documents),
            cleaned_documents=len(cleaned_documents),
            rejected_documents=len(rejected_documents),
            duplicates_removed=duplicates_removed,
            average_content_length=mean(cleaned_lengths) if cleaned_lengths else 0.0,
        )
        return cleaned_documents, rejected_documents, summary

    def _load_parsed_documents(self) -> list[dict[str, Any]]:
        parsed_path = self.parsed_dir / "parsed_documents.json"
        with parsed_path.open("r", encoding="utf-8") as input_file:
            payload = json.load(input_file)
        if not isinstance(payload, list):
            raise ValueError(f"Expected list of parsed documents: {parsed_path}")
        return payload

    def _write_outputs(
        self,
        cleaned_documents: list[CleanedDocument],
        rejected_documents: list[RejectedDocument],
    ) -> None:
        cleaned_path = self.cleaned_dir / "cleaned_documents.json"
        with cleaned_path.open("w", encoding="utf-8") as output_file:
            json.dump(
                [document.model_dump(mode="json") for document in cleaned_documents],
                output_file,
                indent=2,
                ensure_ascii=False,
            )

        rejected_path = self.cleaned_dir / "rejected_documents.json"
        with rejected_path.open("w", encoding="utf-8") as output_file:
            json.dump(
                [document.model_dump(mode="json") for document in rejected_documents],
                output_file,
                indent=2,
                ensure_ascii=False,
            )

    @staticmethod
    def _rejection_reason(cleaned_content: str) -> str:
        if not cleaned_content.strip():
            return "empty document"
        if len(cleaned_content.strip()) < MIN_CONTENT_LENGTH:
            return "extremely short page"
        return ""

