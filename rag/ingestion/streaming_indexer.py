from __future__ import annotations

import asyncio
import gc
import json
import logging
import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

from rag.ingestion.chunking.chunker import SemanticChunker, stable_chunk_id
from rag.ingestion.cleaner.cleaner import DocumentCleaner
from rag.ingestion.crawler.crawler import is_valid_html_response, needs_playwright
from rag.ingestion.crawler.language_filter import detect_language
from rag.ingestion.crawler.playwright_crawler import PlaywrightCrawler
from rag.ingestion.crawler.request_handler import FetchResponse, RequestHandler
from rag.ingestion.crawler.robots_handler import RobotsHandler
from rag.ingestion.crawler.sitemap import SitemapProcessor
from rag.ingestion.crawler.sitemap_utils import normalize_url
from rag.ingestion.embeddings.batch_processor import EmbeddingBatchProcessor
from rag.ingestion.embeddings.embedding_cache import EmbeddingCache
from rag.ingestion.embeddings.embedding_generator import HuggingFaceEmbeddingGenerator
from rag.ingestion.metadata.metadata_generator import (
    canonicalize_url,
    detect_category,
    hash_text,
    stable_document_id,
)
from rag.ingestion.parser.content_extractor import ContentExtractor
from rag.ingestion.vectordb.chroma_client import ChromaVectorClient
from rag.ingestion.vectordb.schema import chroma_metadata
from rag.utils.websites import now_iso


@dataclass(frozen=True)
class StreamingIngestionConfig:
    batch_size: int = 100
    batch_pause_seconds: float = 0.0
    embedding_batch_size: int = 32
    max_retries: int = 3
    backoff_multiplier: float = 2.0
    chunk_size: int = 500
    overlap: int = 100
    # In StreamingIngestionConfig dataclass (streaming_indexer.py), add:
    max_backoff_seconds: float = 120.0
    rate_limit_retries: int = 5
    rate_limit_base_seconds: float = 30.0


@dataclass
class StreamingCheckpoint:
    website: str
    collection_name: str
    total_urls: int
    total_batches: int
    batch_size: int
    current_batch: int = 0
    next_batch_index: int = 0
    processed_urls: list[str] = field(default_factory=list)
    stored_chunk_count: int = 0
    timestamp: str = field(default_factory=now_iso)

    def to_json(self) -> dict[str, Any]:
        return {
            "website": self.website,
            "collection_name": self.collection_name,
            "total_urls": self.total_urls,
            "total_batches": self.total_batches,
            "batch_size": self.batch_size,
            "current_batch": self.current_batch,
            "next_batch_index": self.next_batch_index,
            "processed_urls": self.processed_urls,
            "stored_chunk_count": self.stored_chunk_count,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "StreamingCheckpoint":
        return cls(
            website=str(data.get("website") or ""),
            collection_name=str(data.get("collection_name") or ""),
            total_urls=int(data.get("total_urls") or 0),
            total_batches=int(data.get("total_batches") or 0),
            batch_size=int(data.get("batch_size") or 0),
            current_batch=int(data.get("current_batch") or 0),
            next_batch_index=int(data.get("next_batch_index") or 0),
            processed_urls=[
                str(item)
                for item in data.get("processed_urls") or []
                if str(item).strip()
            ],
            stored_chunk_count=int(data.get("stored_chunk_count") or 0),
            timestamp=str(data.get("timestamp") or now_iso()),
        )


@dataclass(frozen=True)
class StreamingIngestionSummary:
    website: str
    total_urls: int
    total_batches: int
    resumed_from_batch: int
    crawled_pages: int
    english_pages: int
    skipped_non_english_pages: int
    skipped_failed_pages: int
    chunks_generated: int
    embeddings_generated: int
    stored_chunks: int
    checkpoint_path: Path

    def render(self) -> str:
        return "\n".join(
            [
                "STREAMING INGESTION SUMMARY",
                f"- website: {self.website}",
                f"- total URLs: {self.total_urls}",
                f"- total batches: {self.total_batches}",
                f"- resumed from batch: {self.resumed_from_batch}",
                f"- crawled pages: {self.crawled_pages}",
                f"- English pages: {self.english_pages}",
                f"- skipped non-English pages: {self.skipped_non_english_pages}",
                f"- skipped failed pages: {self.skipped_failed_pages}",
                f"- chunks generated: {self.chunks_generated}",
                f"- embeddings generated: {self.embeddings_generated}",
                f"- stored chunks: {self.stored_chunks}",
                f"- checkpoint: {self.checkpoint_path}",
            ]
        )


class StreamingWebsiteIndexer:
    def __init__(
        self,
        *,
        target_url: str,
        workspace_dir: Path,
        sitemap_dir: Path,
        chromadb_dir: Path,
        collection_name: str,
        config: StreamingIngestionConfig,
        timeout: int,
        logger: logging.Logger,
        embedding_model: str,
        normalize_embeddings: bool,
        checkpoint_path: Path,
        progress_path: Path | None = None,
    ) -> None:
        self.target_url = normalize_url(target_url)
        self.workspace_dir = workspace_dir
        self.sitemap_dir = sitemap_dir
        self.chromadb_dir = chromadb_dir
        self.collection_name = collection_name
        self.config = config
        self.timeout = timeout
        self.logger = logger
        self.embedding_model = embedding_model
        self.normalize_embeddings = normalize_embeddings
        self.checkpoint_path = checkpoint_path
        self.progress_path = progress_path

        self.content_extractor = ContentExtractor(logger=logger)
        self.cleaner = DocumentCleaner()
        self.chunker = SemanticChunker()
        self.request_handler = RequestHandler(
            timeout=timeout,
            retries=config.max_retries,
            logger=logger,
            backoff_multiplier=config.backoff_multiplier,
            max_backoff_seconds=config.max_backoff_seconds,
            rate_limit_retries=config.rate_limit_retries,
            rate_limit_base_seconds=config.rate_limit_base_seconds,
        )
        self.robots = RobotsHandler(
            session=self.request_handler.session,
            timeout=timeout,
            logger=logger,
        )
        self.embedding_cache = EmbeddingCache(
            self.workspace_dir / "embeddings" / "embedding_cache.json",
            logger=logger,
        )
        self.embedding_generator = HuggingFaceEmbeddingGenerator(
            model_name=embedding_model,
            normalize_embeddings=normalize_embeddings,
            cache_folder=self.workspace_dir / "embeddings" / "model_cache",
            local_files_only=False,
            logger=logger,
        )
        self.embedding_processor = EmbeddingBatchProcessor(
            generator=self.embedding_generator,
            cache=self.embedding_cache,
            batch_size=max(1, config.embedding_batch_size),
            logger=logger,
        )
        self.chroma = ChromaVectorClient(
            persist_directory=chromadb_dir,
            collection_name=collection_name,
        )
    def _write_progress(
        self,
        *,
        status: str,
        current_batch: int,
        total_batches: int,
        stored_chunks: int,
        crawled_pages: int,
        message: str = "",
    ) -> None:
        if not self.progress_path:
            return
        payload = {
            "status": status,
            "collection_name": self.collection_name,
            "website": self.target_url,
            "current_batch": current_batch,
            "total_batches": total_batches,
            "stored_chunks": stored_chunks,
            "crawled_pages": crawled_pages,
            "message": message,
            "updated_at": now_iso(),
        }
        try:
            tmp = self.progress_path.with_suffix(".tmp")
            self.progress_path.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            tmp.replace(self.progress_path)
        except Exception as exc:
            self.logger.warning("Failed to write progress file: %s", exc)

    async def run(self, *, force: bool = False) -> StreamingIngestionSummary:
        if force and self.checkpoint_path.exists():
            try:
                self.checkpoint_path.unlink()
            except Exception:
                pass

        checkpoint = self._load_checkpoint()

        sitemap_processor = SitemapProcessor(
            target_url=self.target_url,
            output_dir=self.sitemap_dir,
            timeout=self.timeout,
            logger=self.logger,
        )

        discovered_sitemaps = sitemap_processor.discover_sitemaps()
        extracted_urls = sitemap_processor.extract_urls(discovered_sitemaps)
        filtered_urls, duplicates_removed, blocked_urls = sitemap_processor.apply_filters(extracted_urls)

        self.logger.info("Discovered %s URLs", len(extracted_urls))
        self.logger.info("Created %s batches", math.ceil(len(filtered_urls) / max(self.config.batch_size, 1)))
        if duplicates_removed:
            self.logger.info("Deduplicated %s URLs", duplicates_removed)
        if blocked_urls:
            self.logger.info("Filtered %s blocked URLs", blocked_urls)

        checkpoint.total_urls = len(filtered_urls)
        checkpoint.total_batches = math.ceil(len(filtered_urls) / max(self.config.batch_size, 1))
        checkpoint.batch_size = max(self.config.batch_size, 1)
        checkpoint.website = self.target_url
        checkpoint.collection_name = self.collection_name
        self._save_checkpoint(checkpoint)

        total_urls = len(filtered_urls)
        total_batches = checkpoint.total_batches
        resumed_from_batch = checkpoint.current_batch

        crawled_pages = 0
        english_pages = 0
        skipped_non_english_pages = 0
        skipped_failed_pages = 0
        chunks_generated = 0
        embeddings_generated = 0
        stored_chunks = checkpoint.stored_chunk_count

        start_batch = min(max(checkpoint.next_batch_index, 0), total_batches)
        if checkpoint.current_batch > 0:
            self.logger.info(
                "Resuming from batch %s/%s with %s previously processed URLs and %s stored chunks",
                checkpoint.current_batch,
                total_batches,
                len(checkpoint.processed_urls),
                checkpoint.stored_chunk_count,
            )
        else:
            self.logger.info("Starting fresh streaming ingestion run")
        self._write_progress(
            status="indexing",
            current_batch=start_batch,
            total_batches=total_batches,
            stored_chunks=stored_chunks,
            crawled_pages=crawled_pages,
            message="Crawling and indexing started",
        )
        async with PlaywrightCrawler(timeout=self.timeout, logger=self.logger) as playwright:
            for batch_index in range(start_batch, total_batches):
                batch_number = batch_index + 1
                batch_urls = filtered_urls[
                    batch_index * checkpoint.batch_size : (batch_index + 1) * checkpoint.batch_size
                ]
                self.logger.info(
                    "Processing batch %s/%s | urls=%s",
                    batch_number,
                    total_batches,
                    len(batch_urls),
                )

                pending_chunks: list[dict[str, Any]] = []
                batch_processed_urls: list[str] = []
                batch_english_pages = 0
                batch_non_english_pages = 0
                batch_failed_pages = 0
                batch_chunk_count = 0
                batch_embedding_count = 0

                for url_index, extracted in enumerate(batch_urls, start=1):
                    url = str(extracted.canonical_url)
                    if url in checkpoint.processed_urls:
                        self.logger.info(
                            "Skipping already processed URL %s/%s in batch %s/%s: %s",
                            url_index,
                            len(batch_urls),
                            batch_number,
                            total_batches,
                            url,
                        )
                        continue

                    self.logger.info(
                        "Processing URL %s/%s in batch %s/%s: %s",
                        url_index,
                        len(batch_urls),
                        batch_number,
                        total_batches,
                        url,
                    )
                    page = await self._crawl_url(url, playwright)
                    if page is None:
                        skipped_failed_pages += 1
                        batch_failed_pages += 1
                        self.logger.info(
                            "Finished URL %s/%s in batch %s/%s: skipped or failed",
                            url_index,
                            len(batch_urls),
                            batch_number,
                            total_batches,
                        )
                        continue

                    crawled_pages += 1
                    batch_processed_urls.append(url)

                    structured = self.content_extractor.extract(html=page.text, soup=BeautifulSoup(page.text, "lxml"))
                    language_probe = self._language_probe(structured)
                    language = detect_language(language_probe, html=page.text)
                    self.logger.info(
                        "Language detected for %s: %s",
                        url,
                        language,
                    )
                    if language != "en":
                        skipped_non_english_pages += 1
                        batch_non_english_pages += 1
                        self.logger.info("Skipped non-English page: %s", url)
                        self.logger.info(
                            "Finished URL %s/%s in batch %s/%s: non-English",
                            url_index,
                            len(batch_urls),
                            batch_number,
                            total_batches,
                        )
                        continue

                    english_pages += 1
                    batch_english_pages += 1
                    cleaned_document = self.cleaner.clean_document_text(
                        {
                            "title": structured.title,
                            "headings": structured.headings,
                            "content": structured.content,
                            "lists": structured.lists,
                            "tables": structured.tables,
                        }
                    )

                    if not cleaned_document.text.strip():
                        self.logger.info("Skipped empty cleaned page: %s", url)
                        self.logger.info(
                            "Finished URL %s/%s in batch %s/%s: empty after cleaning",
                            url_index,
                            len(batch_urls),
                            batch_number,
                            total_batches,
                        )
                        continue

                    canonical_url = canonicalize_url(url)
                    category = detect_category(canonical_url)
                    content_hash = hash_text(cleaned_document.text)
                    document_id = stable_document_id(canonical_url, content_hash)
                    section_heading = self._first_non_empty_line(cleaned_document.text)
                    chunks = self.chunker.chunk_text(
                        text=cleaned_document.text,
                        category=category,
                        fallback_heading=section_heading or structured.title,
                        default_chunk_size=self.config.chunk_size,
                        default_overlap=self.config.overlap,
                        title=structured.title,
                        source_url=canonical_url,
                    )

                    for index, (heading, chunk_text) in enumerate(chunks, start=1):
                        chunk_id = self._chunk_id(document_id, chunk_text, index)
                        pending_chunks.append(
                            {
                                "chunk_id": chunk_id,
                                "document_id": document_id,
                                "content": chunk_text,
                                "metadata": {
                                    "source_url": canonical_url,
                                    "title": structured.title,
                                    "category": category,
                                    "heading": heading,
                                    "source_type": "website",
                                    "collection": self.collection_name,
                                },
                            }
                    )

                    chunks_generated += len(chunks)
                    batch_chunk_count += len(chunks)
                    self.logger.info(
                        "Generated %s chunks for %s",
                        len(chunks),
                        url,
                    )

                    while len(pending_chunks) >= self.config.embedding_batch_size:
                        batch_to_process = pending_chunks[: self.config.embedding_batch_size]
                        del pending_chunks[: self.config.embedding_batch_size]
                        self.logger.info(
                            "Embedding batch flush: %s items for %s",
                            len(batch_to_process),
                            url,
                        )
                        embeddings_generated, stored_chunks, flushed_embeddings = await self._flush_embeddings(
                            batch_to_process,
                            embeddings_generated,
                            stored_chunks,
                        )
                        batch_embedding_count += flushed_embeddings

                    self.logger.info(
                        "Finished URL %s/%s in batch %s/%s | language=%s | chunks=%s | pending_embeddings=%s",
                        url_index,
                        len(batch_urls),
                        batch_number,
                        total_batches,
                        language,
                        len(chunks),
                        len(pending_chunks),
                    )

                if pending_chunks:
                    self.logger.info(
                        "Embedding final flush for batch %s/%s: %s items",
                        batch_number,
                        total_batches,
                        len(pending_chunks),
                    )
                    embeddings_generated, stored_chunks, flushed_embeddings = await self._flush_embeddings(
                        pending_chunks,
                        embeddings_generated,
                        stored_chunks,
                    )
                    batch_embedding_count += flushed_embeddings
                    pending_chunks.clear()
                
                self._write_progress(
                    status="indexing",
                    current_batch=batch_number,
                    total_batches=total_batches,
                    stored_chunks=stored_chunks,
                    crawled_pages=crawled_pages,
                    message=f"Batch {batch_number}/{total_batches} complete",
                )
                checkpoint.current_batch = batch_number
                checkpoint.next_batch_index = batch_number
                checkpoint.processed_urls = self._merge_processed_urls(
                    checkpoint.processed_urls,
                    batch_processed_urls,
                )
                checkpoint.stored_chunk_count = stored_chunks
                checkpoint.timestamp = now_iso()
                self._save_checkpoint(checkpoint)

                self.logger.info("Batch crawl complete")
                self.logger.info(
                    "Batch %s/%s stats | english=%s | non_english=%s | failed=%s | chunks=%s | embeddings=%s | stored_total=%s",
                    batch_number,
                    total_batches,
                    batch_english_pages,
                    batch_non_english_pages,
                    batch_failed_pages,
                    batch_chunk_count,
                    batch_embedding_count,
                    stored_chunks,
                )
                self.logger.info("Stored %s chunks in ChromaDB", stored_chunks)

                if batch_number < total_batches and self.config.batch_pause_seconds > 0:
                    self.logger.info("Sleeping %s seconds", self.config.batch_pause_seconds)
                    await asyncio.sleep(self.config.batch_pause_seconds)

                gc.collect()

        self._write_progress(
            status="done",
            current_batch=total_batches,
            total_batches=total_batches,
            stored_chunks=stored_chunks,
            crawled_pages=crawled_pages,
            message="Indexing complete",
        )
        
        summary = StreamingIngestionSummary(
            website=self.target_url,
            total_urls=total_urls,
            total_batches=total_batches,
            resumed_from_batch=resumed_from_batch,
            crawled_pages=crawled_pages,
            english_pages=english_pages,
            skipped_non_english_pages=skipped_non_english_pages,
            skipped_failed_pages=skipped_failed_pages,
            chunks_generated=chunks_generated,
            embeddings_generated=embeddings_generated,
            stored_chunks=stored_chunks,
            checkpoint_path=self.checkpoint_path,
        )
        self.logger.info(summary.render().replace("\n", " | "))
        return summary

    async def _crawl_url(self, url: str, playwright: PlaywrightCrawler) -> FetchResponse | None:
        if not self.robots.allowed(url):
            self.logger.info("Skipping robots-blocked URL: %s", url)
            return None

        try:
            self.logger.info("Crawling URL with requests: %s", url)
            response = await asyncio.to_thread(self.request_handler.fetch, url)
            if is_valid_html_response(response) and not needs_playwright(response.text):
                self.logger.info(
                    "Fetched URL with requests: %s | status=%s | content-type=%s | chars=%s",
                    url,
                    response.status_code,
                    response.content_type,
                    len(response.text),
                )
                return response

            fallback_reason = "invalid response content-type" if not is_valid_html_response(response) else "empty, low-text, or JS-rendered HTML"
            self.logger.info("Using Playwright fallback for %s: %s", url, fallback_reason)
            playwright_response = await playwright.fetch(url)
            if not is_valid_html_response(playwright_response):
                self.logger.info(
                    "Skipping unsupported response for %s: status=%s content-type=%s",
                    url,
                    playwright_response.status_code,
                    playwright_response.content_type,
                )
                return None
            self.logger.info(
                "Fetched URL with Playwright: %s | status=%s | content-type=%s | chars=%s",
                url,
                playwright_response.status_code,
                playwright_response.content_type,
                len(playwright_response.text),
            )
            return playwright_response
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Failed to crawl %s: %s", url, exc)
            return None

    async def _flush_embeddings(
        self,
        pending_chunks: list[dict[str, Any]],
        embeddings_generated: int,
        stored_chunks: int,
    ) -> tuple[int, int, int]:
        result = await self.embedding_processor.process(pending_chunks)
        embeddings_generated += len(result.embeddings)
        stored_now = await self._upsert_embeddings(result.embeddings)
        stored_chunks += stored_now
        self.logger.info(
            "Embedding flush complete | produced=%s | cached=%s | duplicates=%s | failures=%s | stored=%s",
            len(result.embeddings),
            result.cached_count,
            result.duplicate_count,
            len(result.failures),
            stored_now,
        )
        return embeddings_generated, stored_chunks, len(result.embeddings)

    async def _upsert_embeddings(self, records: list[dict[str, Any]]) -> int:
        if not records:
            return 0

        ids: list[str] = []
        embeddings: list[list[float]] = []
        documents: list[str] = []
        metadatas: list[dict[str, str | int | float | bool]] = []

        for record in records:
            ids.append(str(record.get("id") or ""))
            embeddings.append([float(value) for value in record.get("embedding") or []])
            documents.append(str(record.get("document") or "").strip())
            metadatas.append(chroma_metadata(record.get("metadata") or {}))

        self.chroma.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        self.logger.info("Stored %s embeddings in ChromaDB", len(ids))
        return len(ids)

    def _load_checkpoint(self) -> StreamingCheckpoint:
        if not self.checkpoint_path.exists():
            return StreamingCheckpoint(
                website=self.target_url,
                collection_name=self.collection_name,
                total_urls=0,
                total_batches=0,
                batch_size=self.config.batch_size,
            )

        with self.checkpoint_path.open("r", encoding="utf-8") as checkpoint_file:
            payload = json.load(checkpoint_file)

        if not isinstance(payload, dict):
            return StreamingCheckpoint(
                website=self.target_url,
                collection_name=self.collection_name,
                total_urls=0,
                total_batches=0,
                batch_size=self.config.batch_size,
            )

        checkpoint = StreamingCheckpoint.from_json(payload)
        if checkpoint.website != self.target_url or checkpoint.collection_name != self.collection_name:
            return StreamingCheckpoint(
                website=self.target_url,
                collection_name=self.collection_name,
                total_urls=0,
                total_batches=0,
                batch_size=self.config.batch_size,
            )
        return checkpoint

    def _save_checkpoint(self, checkpoint: StreamingCheckpoint) -> None:
        self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.checkpoint_path.with_suffix(".tmp")
        with temp_path.open("w", encoding="utf-8") as output_file:
            json.dump(checkpoint.to_json(), output_file, indent=2, ensure_ascii=False)
        temp_path.replace(self.checkpoint_path)

    @staticmethod
    def _merge_processed_urls(existing: list[str], batch_urls: list[str]) -> list[str]:
        merged = list(existing)
        seen = set(existing)
        for url in batch_urls:
            if url in seen:
                continue
            seen.add(url)
            merged.append(url)
        return merged

    @staticmethod
    def _language_probe(structured: Any) -> str:
        parts: list[str] = []
        title = str(getattr(structured, "title", "") or "").strip()
        if title:
            parts.append(title)
        meta_description = str(getattr(structured, "meta_description", "") or "").strip()
        if meta_description:
            parts.append(meta_description)
        for heading in getattr(structured, "headings", []) or []:
            heading_text = str(heading.get("text") or "").strip()
            if heading_text:
                parts.append(heading_text)
        content = str(getattr(structured, "content", "") or "").strip()
        if content:
            parts.append(content)
        for items in getattr(structured, "lists", []) or []:
            parts.extend(str(item).strip() for item in items if str(item).strip())
        for table in getattr(structured, "tables", []) or []:
            for row in table.get("rows") or []:
                parts.extend(str(cell).strip() for cell in row if str(cell).strip())
        return "\n".join(part for part in parts if part).strip()

    @staticmethod
    def _first_non_empty_line(text: str) -> str:
        for line in (text or "").splitlines():
            cleaned = line.strip()
            if cleaned:
                return cleaned[:240]
        return ""

    @staticmethod
    def _chunk_id(document_id: str, content: str, index: int) -> str:
        return stable_chunk_id(document_id, content, index)
