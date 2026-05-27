from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any


class EmbeddingCache:
    """JSON-backed cache keyed by model name and SHA256 content hash."""

    def __init__(self, cache_path: Path, logger: logging.Logger | None = None) -> None:
        self.cache_path = cache_path
        self.logger = logger or logging.getLogger(__name__)
        self._cache: dict[str, dict[str, Any]] = {}
        self.load()

    @staticmethod
    def content_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def cache_key(model_name: str, content_hash: str) -> str:
        return f"{model_name}:{content_hash}"

    def load(self) -> None:
        if not self.cache_path.exists():
            self._cache = {}
            return

        try:
            with self.cache_path.open("r", encoding="utf-8") as cache_file:
                data = json.load(cache_file)
        except (json.JSONDecodeError, OSError) as exc:
            self.logger.warning("Unable to load embedding cache: %s", exc)
            self._cache = {}
            return

        self._cache = data if isinstance(data, dict) else {}

    def get(self, model_name: str, content_hash: str) -> list[float] | None:
        item = self._cache.get(self.cache_key(model_name, content_hash))
        if not isinstance(item, dict):
            return None

        embedding = item.get("embedding")
        if not isinstance(embedding, list):
            return None

        return embedding

    def set(
        self,
        *,
        model_name: str,
        content_hash: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self._cache[self.cache_key(model_name, content_hash)] = {
            "model": model_name,
            "content_hash": content_hash,
            "embedding": embedding,
            "metadata": metadata or {},
        }

    def save(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.cache_path.with_suffix(f"{self.cache_path.suffix}.tmp")
        with temp_path.open("w", encoding="utf-8") as cache_file:
            json.dump(self._cache, cache_file, ensure_ascii=False, indent=2)
        temp_path.replace(self.cache_path)

