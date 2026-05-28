from __future__ import annotations

from typing import Any


REQUIRED_METADATA_FIELDS = (
    "chunk_id",
    "document_id",
    "source_url",
    "title",
    "category",
    "heading",
    "source_type",
    "collection",
)


def validate_embedding_record(record: dict[str, Any]) -> tuple[bool, str | None]:
    if not str(record.get("id") or ""):
        return False, "missing id"

    document = record.get("document")
    if not isinstance(document, str) or not document.strip():
        return False, "empty document"

    embedding = record.get("embedding")
    if not isinstance(embedding, list) or not embedding:
        return False, "missing embedding"

    if not all(isinstance(value, int | float) for value in embedding):
        return False, "embedding contains non-numeric values"

    metadata = record.get("metadata")
    if not isinstance(metadata, dict):
        return False, "missing metadata"

    missing = [field for field in REQUIRED_METADATA_FIELDS if field not in metadata]
    if missing:
        return False, f"missing metadata fields: {', '.join(missing)}"

    return True, None


def chroma_metadata(metadata: dict[str, Any]) -> dict[str, str | int | float | bool]:
    cleaned: dict[str, str | int | float | bool] = {}
    for field in REQUIRED_METADATA_FIELDS:
        value = metadata.get(field, "")
        if isinstance(value, bool | int | float):
            cleaned[field] = value
        else:
            cleaned[field] = str(value or "")
    return cleaned

