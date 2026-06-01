from __future__ import annotations

from pathlib import Path

import chromadb
from chromadb.api.models.Collection import Collection


class ChromaVectorClient:
    _instances: dict[tuple[str, str], "ChromaVectorClient"] = {}

    def __new__(cls, *, persist_directory: Path, collection_name: str) -> "ChromaVectorClient":
        key = (str(persist_directory.resolve()), collection_name)
        if key in cls._instances:
            return cls._instances[key]

        instance = super().__new__(cls)
        cls._instances[key] = instance
        return instance

    def __init__(self, *, persist_directory: Path, collection_name: str) -> None:
        if getattr(self, "_initialized", False):
            return

        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(self.persist_directory))
        self.collection: Collection = self.client.get_or_create_collection(name=collection_name)
        self._initialized = True

    def existing_ids(self, ids: list[str]) -> set[str]:
        if not ids:
            return set()

        result = self.collection.get(ids=ids, include=[])
        return set(result.get("ids") or [])

    def delete_collection(self) -> None:
        self.client.delete_collection(name=self.collection_name)
        # Reset init state so the cached instance rebuilds the collection object next time.
        self._initialized = False

    def count(self) -> int:
        try:
            return int(self.collection.count())
        except Exception:
            return 0

    def list_collections(self) -> list[str]:
        try:
            return [collection.name for collection in self.client.list_collections()]
        except Exception:
            return []

