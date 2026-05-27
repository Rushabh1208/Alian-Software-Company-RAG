from __future__ import annotations

from pathlib import Path

import chromadb
from chromadb.api.models.Collection import Collection


class ChromaVectorClient:
    def __init__(self, *, persist_directory: Path, collection_name: str) -> None:
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(self.persist_directory))
        self.collection: Collection = self.client.get_or_create_collection(name=collection_name)

    def existing_ids(self, ids: list[str]) -> set[str]:
        if not ids:
            return set()

        result = self.collection.get(ids=ids, include=[])
        return set(result.get("ids") or [])

