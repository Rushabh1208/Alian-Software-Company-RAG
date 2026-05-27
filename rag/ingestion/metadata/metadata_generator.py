from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from rag.models.ingest_models import CleanedDocumentModel, MetadataDocument


CATEGORY_BY_SEGMENT = {
    "about": "company",
    "agents": "agents",
    "blog": "blog",
    "careers": "company",
    "case-studies": "case_study",
    "community": "community",
    "contact": "company",
    "customers": "customers",
    "demos": "demos",
    "glossary": "glossary",
    "industries": "industries",
    "integrations": "integrations",
    "playbooks": "playbooks",
    "pricing": "pricing",
    "process": "company",
    "services": "services",
    "templates": "templates",
    "tools": "tools",
    "uses": "resources",
    "work": "case_study",
}


@dataclass(frozen=True)
class MetadataSummary:
    total_documents: int
    metadata_generated: int
    duplicate_hashes: int
    missing_titles: int
    categorized_documents: int

    def render(self) -> str:
        return "\n".join(
            [
                "METADATA SUMMARY",
                f"- total documents: {self.total_documents}",
                f"- metadata generated: {self.metadata_generated}",
                f"- duplicate hashes: {self.duplicate_hashes}",
                f"- missing titles: {self.missing_titles}",
                f"- categorized documents: {self.categorized_documents}",
            ]
        )


class MetadataGenerator:
    def __init__(
        self,
        cleaned_path: Path,
        output_dir: Path,
        logger: logging.Logger,
    ) -> None:
        self.cleaned_path = cleaned_path
        self.output_dir = output_dir
        self.logger = logger

    def run(self) -> tuple[list[MetadataDocument], MetadataSummary]:
        cleaned_documents = self._load_cleaned_documents()
        crawl_timestamp = datetime.now(UTC).isoformat()
        metadata_documents: list[MetadataDocument] = []
        seen_hashes: dict[str, str] = {}
        duplicate_hashes = 0
        missing_titles = 0
        categorized_documents = 0

        for document in cleaned_documents:
            try:
                canonical_url = canonicalize_url(str(document.url))
                category = detect_category(canonical_url)
                section_heading = first_section_heading(document.cleaned_content)
                content_hash = hash_text(document.cleaned_content)
                document_id = stable_document_id(canonical_url, content_hash)

                if not document.title:
                    missing_titles += 1
                    self.logger.warning("Missing title for %s", canonical_url)
                if category != "general":
                    categorized_documents += 1

                if content_hash in seen_hashes:
                    duplicate_hashes += 1
                    self.logger.warning(
                        "Duplicate content hash for %s; duplicate of %s",
                        canonical_url,
                        seen_hashes[content_hash],
                    )
                else:
                    seen_hashes[content_hash] = canonical_url

                metadata_documents.append(
                    MetadataDocument(
                        document_id=document_id,
                        source_url=document.url,
                        canonical_url=canonical_url,
                        title=document.title,
                        section_heading=section_heading,
                        category=category,
                        language=document.language or "en",
                        source_type="website",
                        crawl_timestamp=crawl_timestamp,
                        content_hash=content_hash,
                        content=document.cleaned_content,
                    )
                )
            except Exception as exc:
                self.logger.exception("Metadata generation failed for %s: %s", document.url, exc)

        self._write_metadata_documents(metadata_documents)
        summary = MetadataSummary(
            total_documents=len(cleaned_documents),
            metadata_generated=len(metadata_documents),
            duplicate_hashes=duplicate_hashes,
            missing_titles=missing_titles,
            categorized_documents=categorized_documents,
        )
        return metadata_documents, summary

    def _load_cleaned_documents(self) -> list[CleanedDocumentModel]:
        with self.cleaned_path.open("r", encoding="utf-8") as input_file:
            payload = json.load(input_file)
        if not isinstance(payload, list):
            raise ValueError(f"Expected list of cleaned documents: {self.cleaned_path}")
        return [CleanedDocumentModel.model_validate(item) for item in payload]

    def _write_metadata_documents(self, documents: list[MetadataDocument]) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.output_dir / "metadata_documents.json"
        with output_path.open("w", encoding="utf-8") as output_file:
            json.dump(
                [document.model_dump(mode="json") for document in documents],
                output_file,
                indent=2,
                ensure_ascii=False,
            )


def canonicalize_url(url: str) -> str:
    parts = urlsplit(url.strip())
    query_items = sorted(parse_qsl(parts.query, keep_blank_values=False))
    query = urlencode(query_items)
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, query, ""))


def detect_category(url: str) -> str:
    path_parts = [part for part in urlsplit(url).path.split("/") if part]
    meaningful_parts = [part for part in path_parts if part not in {"en", "hi"}]
    if not meaningful_parts:
        return "home"

    for part in meaningful_parts:
        if part in CATEGORY_BY_SEGMENT:
            return CATEGORY_BY_SEGMENT[part]

    return "general"


def first_section_heading(content: str) -> str:
    for line in content.splitlines():
        line = line.strip()
        if line:
            return line[:240]
    return ""


def hash_text(text: str) -> str:
    normalized = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def stable_document_id(canonical_url: str, content_hash: str) -> str:
    seed = f"{canonical_url}|{content_hash}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()

