from __future__ import annotations

import asyncio
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
import re

from rag.engine.query_engine import RagQueryEngine

_QUERY_ENGINE_CACHE: dict[str, RagQueryEngine] = {}

from config.constants import DEFAULT_BASE_COLLECTION_NAME, DEFAULT_TARGET_WEBSITE
from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import AppSettings, load_settings
from rag.engine.query_engine import RagQueryEngine
from rag.ingestion.chunking.chunk_manager import ChunkManager
from rag.ingestion.cleaner.cleaning_manager import CleaningManager
from rag.ingestion.crawler.crawl_manager import CrawlManager
from rag.ingestion.crawler.sitemap import SitemapProcessor
from rag.ingestion.embeddings.embedding_manager import EmbeddingManager
from rag.ingestion.metadata.metadata_generator import MetadataGenerator
from rag.ingestion.parser.parser_manager import ParserManager
from rag.ingestion.vectordb.chroma_client import ChromaVectorClient
from rag.ingestion.vectordb.upsert import ChromaUpserter
from rag.models.query_models import QueryResult
from rag.utils.websites import (
    WebsiteRecord,
    build_website_record,
    load_json_records,
    normalize_website_url,
    remove_website_record,
    upsert_website_record,
    website_collection_name,
    website_domain,
    website_workspace_name,
)


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

        sitemap_processor = SitemapProcessor(
            target_url=normalized_url,
            output_dir=paths.sitemap_dir,
            timeout=int(self.crawler_config.get("timeout", 30)),
            recursive_fallback_depth=int(self.crawler_config.get("recursive_fallback_depth", 2)),
            recursive_fallback_pages=int(self.crawler_config.get("recursive_fallback_pages", 80)),
            logger=logger,
        )
        sitemap_result = sitemap_processor.run()

        crawl_manager = CrawlManager(
            targets_path=paths.crawl_targets,
            raw_dir=paths.raw_dir,
            timeout=int(self.crawler_config.get("timeout", 30)),
            retries=int(self.crawler_config.get("retries", 3)),
            rate_limit=int(self.crawler_config.get("rate_limit", 2)),
            logger=logger,
        )
        _, crawl_summary = await crawl_manager.run()

        parser_manager = ParserManager(
            raw_dir=paths.raw_dir,
            parsed_dir=paths.parsed_dir,
            logger=logger,
        )
        _, parsing_summary = parser_manager.run()

        cleaner = CleaningManager(
            parsed_dir=paths.parsed_dir,
            cleaned_dir=paths.cleaned_dir,
            logger=logger,
        )
        _, _, cleaning_summary = cleaner.run()

        metadata_generator = MetadataGenerator(
            cleaned_path=paths.cleaned_documents,
            output_dir=paths.metadata_dir,
            collection_name=collection_name,
            logger=logger,
        )
        _, metadata_summary = metadata_generator.run()

        chunk_manager = ChunkManager(
            metadata_path=paths.metadata_documents,
            output_dir=paths.chunks_dir,
            chunk_size=int(self.chunking_config.get("chunk_size", 500)),
            overlap=int(self.chunking_config.get("overlap", 100)),
            collection_name=collection_name,
            logger=logger,
        )
        _, _, chunking_summary = chunk_manager.run()

        embedding_manager = EmbeddingManager(
            chunks_path=paths.chunked_documents,
            output_dir=paths.embeddings_dir,
            model_name=str(self.embedding_config.get("model", "BAAI/bge-small-en-v1.5")),
            batch_size=int(self.embedding_config.get("batch_size", 32)),
            normalize_embeddings=bool(self.embedding_config.get("normalize_embeddings", True)),
            logger=logger,
        )
        _, _, embedding_summary = await embedding_manager.run()

        upserter = ChromaUpserter(
            embeddings_path=paths.embeddings_dir / "embeddings.json",
            persist_directory=paths.chromadb_dir,
            collection_name=collection_name,
            logger=logger,
        )
        vectordb_summary = upserter.run()

        website_record = upsert_website_record(
            paths.website_registry,
            build_website_record(normalized_url, collection_name=collection_name),
        )

        return WebsiteIngestionResult(
            website=website_record,
            collection_name=collection_name,
            workspace_name=workspace_name,
            sitemap_summary=sitemap_result.summary.render(),
            crawl_summary=crawl_summary.render(),
            parsing_summary=parsing_summary.render(),
            cleaning_summary=cleaning_summary.render(),
            metadata_summary=metadata_summary.render(),
            chunking_summary=chunking_summary.render(),
            embedding_summary=embedding_summary.render(),
            vectordb_summary=vectordb_summary.render(),
        )

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
            raise ValueError("The base Alian Software collection cannot be deleted.")

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
