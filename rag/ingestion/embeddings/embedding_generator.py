from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from collections.abc import Sequence

from langchain_huggingface import HuggingFaceEmbeddings


class HuggingFaceEmbeddingGenerator:
    def __init__(
        self,
        *,
        model_name: str,
        normalize_embeddings: bool = True,
        cache_folder: Path | None = None,
        local_files_only: bool = False,
        logger: logging.Logger | None = None,
    ) -> None:
        self.model_name = model_name
        self.logger = logger or logging.getLogger(__name__)
        self.embedding_model = HuggingFaceEmbeddings(
            model_name=model_name,
            cache_folder=str(cache_folder) if cache_folder else None,
            model_kwargs={"local_files_only": local_files_only},
            encode_kwargs={"normalize_embeddings": normalize_embeddings},
            show_progress=False,
        )

    async def embed_documents(self, documents: Sequence[str]) -> list[list[float]]:
        if not documents:
            return []

        embeddings = await asyncio.to_thread(
            self.embedding_model.embed_documents,
            list(documents),
        )
        return [self._coerce_embedding(vector) for vector in embeddings]

    async def embed_query(self, query: str) -> list[float]:
        embedding = await asyncio.to_thread(self.embedding_model.embed_query, query)
        return self._coerce_embedding(embedding)

    @staticmethod
    def _coerce_embedding(vector: Sequence[float]) -> list[float]:
        return [float(value) for value in vector]

