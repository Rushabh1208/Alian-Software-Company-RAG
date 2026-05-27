from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rag.ingestion.vectordb.chroma_client import ChromaVectorClient
from rag.ingestion.vectordb.schema import chroma_metadata, validate_embedding_record


@dataclass(frozen=True)
class VectorDbSummary:
    vectors_inserted: int
    duplicates_skipped: int
    insert_failures: int
    collection_name: str
    persist_directory: Path

    def render(self) -> str:
        return "\n".join(
            [
                "VECTOR DB SUMMARY",
                f"- vectors inserted: {self.vectors_inserted}",
                f"- duplicates skipped: {self.duplicates_skipped}",
                f"- insert failures: {self.insert_failures}",
                f"- collection name: {self.collection_name}",
                f"- persist directory: {self.persist_directory}",
            ]
        )


class ChromaUpserter:
    def __init__(
        self,
        *,
        embeddings_path: Path,
        persist_directory: Path,
        collection_name: str,
        logger: logging.Logger | None = None,
    ) -> None:
        self.embeddings_path = embeddings_path
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.logger = logger or logging.getLogger(__name__)

    def run(self) -> VectorDbSummary:
        records = self._load_embeddings()
        client = ChromaVectorClient(
            persist_directory=self.persist_directory,
            collection_name=self.collection_name,
        )

        ids: list[str] = []
        embeddings: list[list[float]] = []
        documents: list[str] = []
        metadatas: list[dict[str, str | int | float | bool]] = []
        failures = 0
        duplicates = 0
        seen_ids: set[str] = set()

        existing_ids = client.existing_ids([str(record.get("id") or "") for record in records])

        for record in records:
            is_valid, reason = validate_embedding_record(record)
            record_id = str(record.get("id") or "")
            if not is_valid:
                failures += 1
                self.logger.warning("Chroma insert skipped for %s: %s", record_id, reason)
                continue

            if record_id in seen_ids or record_id in existing_ids:
                duplicates += 1
                self.logger.debug("Chroma duplicate skipped: %s", record_id)
                continue

            seen_ids.add(record_id)
            ids.append(record_id)
            embeddings.append([float(value) for value in record["embedding"]])
            documents.append(str(record["document"]).strip())
            metadatas.append(chroma_metadata(record["metadata"]))

        inserted = 0
        if ids:
            try:
                client.collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas,
                )
                inserted = len(ids)
            except Exception:  # noqa: BLE001 - keep pipeline summary useful
                failures += len(ids)
                self.logger.exception("Chroma upsert failed")

        summary = VectorDbSummary(
            vectors_inserted=inserted,
            duplicates_skipped=duplicates,
            insert_failures=failures,
            collection_name=self.collection_name,
            persist_directory=self.persist_directory,
        )
        self.logger.info(summary.render().replace("\n", " | "))
        return summary

    def _load_embeddings(self) -> list[dict[str, Any]]:
        if not self.embeddings_path.exists():
            raise FileNotFoundError(f"Embeddings file not found: {self.embeddings_path}")

        with self.embeddings_path.open("r", encoding="utf-8") as embeddings_file:
            data = json.load(embeddings_file)

        if not isinstance(data, list):
            raise ValueError(f"Embeddings file must contain a list: {self.embeddings_path}")

        return [item for item in data if isinstance(item, dict)]

