from __future__ import annotations

import asyncio
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import re

from config.constants import DEFAULT_BASE_COLLECTION_NAME, DEFAULT_TARGET_WEBSITE
from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import AppSettings, load_settings
from rag.engine.query_engine import RagQueryEngine
from rag.ingestion.streaming_indexer import (
    StreamingIngestionConfig,
    StreamingWebsiteIndexer,
)
from rag.ingestion.vectordb.chroma_client import ChromaVectorClient
from rag.models.query_models import QueryResult
from rag.utils.websites import (
    WebsiteRecord,
    build_website_record,
    load_json_records,
    normalize_website_url,
    now_iso,
    remove_website_record,
    upsert_website_record,
    website_collection_name,
    website_domain,
    website_workspace_name,
)


_QUERY_ENGINE_CACHE: dict[str, RagQueryEngine] = {}


@dataclass(frozen=True)
class WebsiteIngestionResult:
    website: WebsiteRecord
    collection_name: str
    workspace_name: str
    sitemap_summary: str
    crawl_summary: str
    parsing_summary: str
    cleaning_summary: str
    metadata_summary: str
    chunking_summary: str
    embedding_summary: str
    vectordb_summary: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "website": self.website.to_json(),
            "collection_name": self.collection_name,
            "workspace_name": self.workspace_name,
            "sitemap_summary": self.sitemap_summary,
            "crawl_summary": self.crawl_summary,
            "parsing_summary": self.parsing_summary,
            "cleaning_summary": self.cleaning_summary,
            "metadata_summary": self.metadata_summary,
            "chunking_summary": self.chunking_summary,
            "embedding_summary": self.embedding_summary,
            "vectordb_summary": self.vectordb_summary,
        }


@dataclass(frozen=True)
class WebsiteQueryResult:
    collection_name: str
    result: QueryResult

    def to_dict(self) -> dict[str, Any]:
        return {
            "collection_name": self.collection_name,
            "result": _query_result_to_dict(self.result),
        }


class WebsiteIngestionService:
    def __init__(self, settings: AppSettings | None = None) -> None:
        self.settings = settings or load_settings()
        self.embedding_config = self.settings.config.get("embeddings", {})
        self.vectordb_config = self.settings.config.get("vectordb", {})
        self.crawler_config = self.settings.config.get("crawler", {})
        self.chunking_config = self.settings.config.get("chunking", {})
        self.streaming_config = self.settings.config.get("streaming_ingestion", {})

    async def index_website(
        self,
        url: str,
        *,
        force: bool = False,
    ) -> WebsiteIngestionResult:
        normalized_url = normalize_website_url(url)
        collection_name = website_collection_name(normalized_url)
        workspace_name = website_workspace_name(normalized_url)
        paths = get_pipeline_paths(self.settings.chroma_db_path, workspace_name=workspace_name)
        paths.ensure_directories()

        logger = setup_pipeline_logger(
            name=f"website_{workspace_name}",
            log_dir=paths.logs_vectordb,
            log_filename="website_ingestion.log",
        )

        if force:
            self._delete_collection_safely(paths.chromadb_dir, collection_name)
            if paths.checkpoint.exists():
                try:
                    paths.checkpoint.unlink()
                except Exception:
                    pass

        # Register website immediately so sidebar shows it before indexing finishes
        website_record = upsert_website_record(
            paths.website_registry,
            build_website_record(normalized_url, collection_name=collection_name),
        )

        # Write initial "indexing" progress file immediately
        progress_path = paths.workspace_dir / "indexing_progress.json"
        try:
            progress_path.parent.mkdir(parents=True, exist_ok=True)
            progress_path.write_text(
                json.dumps({
                    "status": "indexing",
                    "collection_name": collection_name,
                    "website": normalized_url,
                    "current_batch": 0,
                    "total_batches": 0,
                    "stored_chunks": 0,
                    "crawled_pages": 0,
                    "message": "Starting...",
                    "updated_at": now_iso(),
                }, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

        streaming_indexer = StreamingWebsiteIndexer(
            target_url=normalized_url,
            workspace_dir=paths.workspace_dir,
            sitemap_dir=paths.sitemap_dir,
            chromadb_dir=paths.chromadb_dir,
            collection_name=collection_name,
            progress_path=progress_path,
            config=StreamingIngestionConfig(
                batch_size=int(self.streaming_config.get("batch_size", 100)),
                batch_pause_seconds=float(self.streaming_config.get("batch_pause_seconds", 0)),
                embedding_batch_size=int(
                    self.streaming_config.get(
                        "embedding_batch_size",
                        self.embedding_config.get("batch_size", 32),
                    )
                ),
                max_retries=int(
                    self.streaming_config.get(
                        "max_retries",
                        self.crawler_config.get("retries", 3),
                    )
                ),
                backoff_multiplier=float(
                    self.streaming_config.get(
                        "backoff_multiplier",
                        2.0,
                    )
                ),
                chunk_size=int(self.chunking_config.get("chunk_size", 500)),
                overlap=int(self.chunking_config.get("overlap", 100)),
                max_backoff_seconds=float(self.crawler_config.get("max_backoff_seconds", 120.0)),
                rate_limit_retries=int(self.crawler_config.get("rate_limit_retries", 5)),
                rate_limit_base_seconds=float(self.crawler_config.get("rate_limit_base_seconds", 30.0)),
            ),
            timeout=int(self.crawler_config.get("timeout", 30)),
            logger=logger,
            embedding_model=str(self.embedding_config.get("model", "BAAI/bge-small-en-v1.5")),
            normalize_embeddings=bool(self.embedding_config.get("normalize_embeddings", True)),
            checkpoint_path=paths.checkpoint,
        )

        # Fire indexing as background task — returns immediately, no bridge timeout
        async def _run_and_finalize() -> None:
            try:
                await streaming_indexer.run(force=force)
            except Exception as exc:
                logger.error("Background indexing failed: %s", exc)
                try:
                    progress_path.write_text(
                        json.dumps({
                            "status": "error",
                            "collection_name": collection_name,
                            "website": normalized_url,
                            "current_batch": 0,
                            "total_batches": 0,
                            "stored_chunks": 0,
                            "crawled_pages": 0,
                            "message": str(exc),
                            "updated_at": now_iso(),
                        }, indent=2),
                        encoding="utf-8",
                    )
                except Exception:
                    pass

        asyncio.ensure_future(_run_and_finalize())

        return WebsiteIngestionResult(
            website=website_record,
            collection_name=collection_name,
            workspace_name=workspace_name,
            sitemap_summary="Indexing started in background",
            crawl_summary="",
            parsing_summary="",
            cleaning_summary="",
            metadata_summary="",
            chunking_summary="",
            embedding_summary="",
            vectordb_summary="",
        )

    def get_indexing_status(self, collection_name: str) -> dict:
        """Read the live progress file for a given collection."""
        paths_base = get_pipeline_paths(self.settings.chroma_db_path)
        registry = load_json_records(paths_base.website_registry)
        record = next((r for r in registry if str(r.get("id") or "") == collection_name), None)

        if not record:
            return {"status": "unknown", "collection_name": collection_name}

        workspace_name = str(record.get("workspace_name") or collection_name)
        paths = get_pipeline_paths(self.settings.chroma_db_path, workspace_name=workspace_name)
        progress_path = paths.workspace_dir / "indexing_progress.json"

        if not progress_path.exists():
            return {"status": "done", "collection_name": collection_name}

        try:
            return json.loads(progress_path.read_text(encoding="utf-8"))
        except Exception:
            return {"status": "unknown", "collection_name": collection_name}

    def sync_collections(self) -> dict:
        """
        Reconcile website registry against actual ChromaDB collections.
        Removes registry entries whose ChromaDB collection no longer exists.
        Returns the cleaned list.
        """
        from chromadb import PersistentClient

        paths = get_pipeline_paths(self.settings.chroma_db_path)
        paths.ensure_directories()

        try:
            chroma_client = PersistentClient(path=str(paths.chromadb_dir))
            live_collections = {col.name for col in chroma_client.list_collections()}
        except Exception:
            live_collections = set()

        registry = load_json_records(paths.website_registry)
        cleaned = []
        for record in registry:
            record_id = str(record.get("id") or "")
            # Always keep base collection entry
            if record_id == DEFAULT_BASE_COLLECTION_NAME:
                cleaned.append(record)
                continue
            # Keep only if ChromaDB collection still exists
            if record_id in live_collections:
                cleaned.append(record)

        paths.website_registry.write_text(
            json.dumps(cleaned, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        return {
            "synced": len(cleaned),
            "removed": len(registry) - len(cleaned),
            "websites": cleaned,
        }
    
    async def query(
        self,
        question: str,
        *,
        collection_name: str = DEFAULT_BASE_COLLECTION_NAME,
        top_k: int = 5,
    ) -> WebsiteQueryResult:
        paths = get_pipeline_paths(self.settings.chroma_db_path)
        paths.ensure_directories()
        resolved_collection = self._resolve_collection_name(paths.chromadb_dir, collection_name)

        cache_key = "|".join(
            [
                str(paths.chromadb_dir.resolve()),
                resolved_collection,
                str(self.embedding_config.get("model", "BAAI/bge-small-en-v1.5")),
                str(bool(self.embedding_config.get("normalize_embeddings", True))),
                str((paths.embeddings_dir / "model_cache").resolve()),
            ]
        )

        engine = _QUERY_ENGINE_CACHE.get(cache_key)
        if engine is None:
            engine = RagQueryEngine(
                persist_directory=paths.chromadb_dir,
                collection_name=resolved_collection,
                model_name=str(self.embedding_config.get("model", "BAAI/bge-small-en-v1.5")),
                normalize_embeddings=bool(self.embedding_config.get("normalize_embeddings", True)),
                model_cache_dir=paths.embeddings_dir / "model_cache",
                embeddings_path=paths.embeddings_dir / "embeddings.json",
            )
            _QUERY_ENGINE_CACHE[cache_key] = engine

        result = await engine.ask(question, top_k=max(top_k, 1))
        return WebsiteQueryResult(collection_name=resolved_collection, result=result)

    def list_websites(self) -> list[dict[str, str]]:
        paths = get_pipeline_paths(self.settings.chroma_db_path)
        registry = load_json_records(paths.website_registry)
        website_entries = [item for item in registry if str(item.get("source_type") or "") == "website"]

        if not any(str(item.get("id") or "") == DEFAULT_BASE_COLLECTION_NAME for item in website_entries):
            website_entries.insert(
                0,
                build_website_record(DEFAULT_TARGET_WEBSITE, collection_name=DEFAULT_BASE_COLLECTION_NAME).to_json(),
            )

        return website_entries

    def delete_website(self, website_id: str) -> dict[str, str]:
        if website_id == DEFAULT_BASE_COLLECTION_NAME:
            raise ValueError("The base collection cannot be deleted.")

        paths = get_pipeline_paths(self.settings.chroma_db_path)
        paths.ensure_directories()
        removed = remove_website_record(paths.website_registry, website_id)

        client = ChromaVectorClient(
            persist_directory=paths.chromadb_dir,
            collection_name=website_id,
        )
        try:
            client.delete_collection()
        except Exception:
            pass

        if removed:
            workspace_root = get_pipeline_paths(
                self.settings.chroma_db_path,
                workspace_name=removed.workspace_name,
            ).workspace_dir
            if workspace_root.exists():
                shutil.rmtree(workspace_root, ignore_errors=True)
        elif re.fullmatch(r"[a-z0-9_]+", website_id):
            workspace_root = get_pipeline_paths(
                self.settings.chroma_db_path,
                workspace_name=website_id,
            ).workspace_dir
            if workspace_root.exists():
                shutil.rmtree(workspace_root, ignore_errors=True)

        return {
            "id": website_id,
            "deleted": "true",
        }

    def _resolve_collection_name(self, persist_directory: Path, collection_name: str) -> str:
        if collection_name != DEFAULT_BASE_COLLECTION_NAME:
            return collection_name

        preferred = ChromaVectorClient(
            persist_directory=persist_directory,
            collection_name=DEFAULT_BASE_COLLECTION_NAME,
        )
        if preferred.count() > 0:
            return DEFAULT_BASE_COLLECTION_NAME

        legacy = ChromaVectorClient(
            persist_directory=persist_directory,
            collection_name=str(self.vectordb_config.get("collection_name", "rag_documents")),
        )
        if legacy.count() > 0:
            return legacy.collection_name

        return DEFAULT_BASE_COLLECTION_NAME

    @staticmethod
    def _delete_collection_safely(persist_directory: Path, collection_name: str) -> None:
        client = ChromaVectorClient(
            persist_directory=persist_directory,
            collection_name=collection_name,
        )
        try:
            client.delete_collection()
        except Exception:
            pass


def _query_result_to_dict(result: QueryResult) -> dict[str, Any]:
    return {
        "question": result.question,
        "answer": result.answer,
        "confidence": result.confidence,
        "confidence_label": result.confidence_label,
        "confidence_factors": result.confidence_factors or {},
        "metrics": result.metrics or {},
        "chunks": [
            {
                "rank": chunk.rank,
                "chunk_id": chunk.chunk_id,
                "document": chunk.document,
                "metadata": chunk.metadata,
                "semantic_score": chunk.semantic_score,
                "rerank_score": chunk.rerank_score,
                "final_score": chunk.final_score,
                "source_url": chunk.source_url,
                "title": chunk.title,
                "heading": chunk.heading,
                "source_type": chunk.source_type,
                "collection": chunk.collection,
            }
            for chunk in result.chunks
        ],
    }
