from __future__ import annotations
import time
import logging
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup

from rag.ingestion.crawler.robots_handler import RobotsHandler

# Fallback definition to prevent the website crash
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

from rag.ingestion.crawler.recursive_crawler import RecursiveCrawler
from rag.ingestion.crawler.language_filter import looks_english_html
from rag.ingestion.crawler.sitemap_utils import fetch_url, model_to_jsonable, normalize_url, write_json
from rag.ingestion.crawler.url_filter import filter_urls
from rag.models.ingest_models import CrawlTarget, ExtractedUrl, SitemapRecord


@dataclass
class SitemapPipelineSummary:
    sitemaps_discovered: int = 0
    urls_extracted: int = 0
    urls_filtered: int = 0
    valid_crawl_targets: int = 0
    duplicates_removed: int = 0
    blocked_urls: int = 0

    def render(self) -> str:
        return "\n".join(
            [
                "SITEMAP PIPELINE SUMMARY",
                f"- total URLs: {self.urls_extracted}",
                f"- filtered URLs: {self.urls_filtered}",
                f"- crawl targets: {self.valid_crawl_targets}",
                f"- blocked URLs: {self.blocked_urls}",
            ]
        )


@dataclass
class SitemapPipelineResult:
    discovered_sitemaps: list[SitemapRecord]
    extracted_urls: list[ExtractedUrl]
    filtered_urls: list[ExtractedUrl]
    crawl_targets: list[CrawlTarget]
    summary: SitemapPipelineSummary


@dataclass
class SitemapProcessor:
    target_url: str
    output_dir: Path
    timeout: int = 30
    recursive_fallback_depth: int = 2
    recursive_fallback_pages: int = 80
    logger: logging.Logger = field(default_factory=lambda: logging.getLogger(__name__))
    session: requests.Session = field(default_factory=requests.Session)

    def __post_init__(self) -> None:
        self.target_url = normalize_url(self.target_url)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.session.headers.update(
            {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
            }
        )
        self.robots = RobotsHandler(
            session=self.session,
            timeout=self.timeout,
            logger=self.logger,
        )
        self.parsed_sitemaps: list[SitemapRecord] = []

    def run(self) -> SitemapPipelineResult:
        pipeline_start = time.time()

        self.logger.info(
            "Starting sitemap pipeline for %s",
            self.target_url,
        )

        discovered_sitemaps = self.discover_sitemaps()
        self.logger.info("Discovered %s sitemap(s)", len(discovered_sitemaps))
        extracted_urls = self.extract_urls(discovered_sitemaps)
        discovered_sitemaps = self._merge_sitemap_records(
            [*discovered_sitemaps, *self.parsed_sitemaps]
        )

        if not extracted_urls:
            fallback_urls, recursive_summary = self._recursive_fallback_urls()
            if fallback_urls:
                self.logger.info(
                    "Recursive crawl fallback discovered %s URLs from %s pages",
                    recursive_summary.discovered_urls,
                    recursive_summary.visited_pages,
                )
                extracted_urls = fallback_urls

        filtered_urls, duplicates_removed, blocked_urls = self.apply_filters(extracted_urls)
        crawl_targets, validation_blocked = self.validate_crawl_targets(filtered_urls)

        if not crawl_targets:
            fallback_urls, recursive_summary = self._recursive_fallback_urls()
            if fallback_urls:
                self.logger.info(
                    "Recursive crawl fallback discovered %s URLs from %s pages after sitemap filtering",
                    recursive_summary.discovered_urls,
                    recursive_summary.visited_pages,
                )
                filtered_urls, duplicates_removed, blocked_urls = self.apply_filters(fallback_urls)
                crawl_targets, validation_blocked = self.validate_crawl_targets(filtered_urls)

        summary = SitemapPipelineSummary(
            sitemaps_discovered=len(discovered_sitemaps),
            urls_extracted=len(extracted_urls),
            urls_filtered=len(filtered_urls),
            valid_crawl_targets=len(crawl_targets),
            duplicates_removed=duplicates_removed,
            blocked_urls=blocked_urls + validation_blocked,
        )

        result = SitemapPipelineResult(
            discovered_sitemaps=discovered_sitemaps,
            extracted_urls=extracted_urls,
            filtered_urls=filtered_urls,
            crawl_targets=crawl_targets,
            summary=summary,
        )
        self.write_outputs(result)
        elapsed = time.time() - pipeline_start

        self.logger.info(
            "Pipeline finished in %.2f seconds",
            elapsed,
        )

        self.logger.info(
            summary.render()
        )
        return result

    def discover_sitemaps(self) -> list[SitemapRecord]:
        origin = self._origin(self.target_url)
        candidates = [
            urljoin(origin, "/sitemap.xml"),
            urljoin(origin, "/sitemap_index.xml"),
            *self.robots.get_sitemaps(self.target_url),
        ]

        discovered: list[SitemapRecord] = []
        seen: set[str] = set()
        for candidate in candidates:
            normalized = normalize_url(candidate)
            if normalized in seen:
                continue
            seen.add(normalized)

            response = fetch_url(self.session, normalized, self.timeout, self.logger)
            if not response or response.status_code != 200:
                self.logger.info("Sitemap candidate unavailable: %s", normalized)
                continue

            if self._looks_like_sitemap(response.text):
                discovered.append(SitemapRecord(url=normalized, source="candidate"))
                self.logger.info("Discovered sitemap: %s", normalized)

        return discovered
        
    def extract_urls(self, sitemaps: list[SitemapRecord]) -> list[ExtractedUrl]:
        self.logger.info(
            "Starting sitemap extraction from %s discovered sitemap(s)",
            len(sitemaps),
        )

        extracted: list[ExtractedUrl] = []
        visited_sitemaps: set[str] = set()

        for index, sitemap in enumerate(sitemaps, start=1):
            self.logger.info(
                "[%s/%s] Processing sitemap: %s",
                index,
                len(sitemaps),
                sitemap.url,
            )

            before_count = len(extracted)

            self._parse_sitemap(
                sitemap_url=str(sitemap.url),
                extracted=extracted,
                visited_sitemaps=visited_sitemaps,
            )

            new_urls = len(extracted) - before_count

            self.logger.info(
                "Completed sitemap %s | URLs found: %s | Total URLs so far: %s",
                sitemap.url,
                new_urls,
                len(extracted),
            )

        self.logger.info(
            "Sitemap extraction completed. Total URLs extracted: %s",
            len(extracted),
        )

        return extracted


    

    def apply_filters(self, extracted_urls: list[ExtractedUrl]) -> tuple[list[ExtractedUrl], int, int]:
        url_by_canonical = {item.canonical_url: item for item in extracted_urls}
        filter_result = filter_urls([item.canonical_url for item in extracted_urls])
        filtered: list[ExtractedUrl] = []
        out_of_scope_count = 0
        for url in filter_result.accepted_urls:
            if not self._in_target_scope(url):
                out_of_scope_count += 1
                continue
            filtered.append(url_by_canonical[url])

        return (
            filtered,
            len(filter_result.duplicate_urls),
            len(filter_result.blocked_urls) + out_of_scope_count,
        )

    def validate_crawl_targets(self, filtered_urls: list[ExtractedUrl]) -> tuple[list[CrawlTarget], int]:
        crawl_targets: list[CrawlTarget] = []
        blocked_count = 0

        for extracted_url in filtered_urls:
            url = extracted_url.canonical_url
            if not self.robots.allowed(url):
                blocked_count += 1
                self.logger.info("Blocked by robots.txt: %s", url)
                continue

            if not self._is_valid_html_page(url):
                blocked_count += 1
                continue

            crawl_targets.append(CrawlTarget.from_extracted_url(extracted_url))

        return crawl_targets, blocked_count

    def _recursive_fallback_urls(self) -> tuple[list[ExtractedUrl], object]:
        crawler = RecursiveCrawler(
            target_url=self.target_url,
            session=self.session,
            timeout=self.timeout,
            logger=self.logger,
            robots=self.robots,
            max_depth=self.recursive_fallback_depth,
            max_pages=self.recursive_fallback_pages,
        )
        return crawler.discover()

    def write_outputs(self, result: SitemapPipelineResult) -> None:
        write_json(
            self.output_dir / "discovered_sitemaps.json",
            [model_to_jsonable(item) for item in result.discovered_sitemaps],
        )
        write_json(
            self.output_dir / "extracted_urls.json",
            [model_to_jsonable(item) for item in result.extracted_urls],
        )
        write_json(
            self.output_dir / "filtered_urls.json",
            [model_to_jsonable(item) for item in result.filtered_urls],
        )
        write_json(
            self.output_dir / "crawl_targets.json",
            [model_to_jsonable(item) for item in result.crawl_targets],
        )

    def _parse_sitemap(
    self,
    sitemap_url: str,
    extracted: list[ExtractedUrl],
    visited_sitemaps: set[str],
    ) -> None:

        normalized_sitemap_url = normalize_url(sitemap_url)

        if normalized_sitemap_url in visited_sitemaps:
            self.logger.debug(
                "Skipping already processed sitemap: %s",
                normalized_sitemap_url,
            )
            return

        visited_sitemaps.add(normalized_sitemap_url)

        self.parsed_sitemaps.append(
            SitemapRecord(
                url=normalized_sitemap_url,
                source="parsed",
            )
        )

        self.logger.info(
            "Fetching sitemap: %s",
            normalized_sitemap_url,
        )

        response = fetch_url(
            self.session,
            normalized_sitemap_url,
            self.timeout,
            self.logger,
        )

        if not response or response.status_code != 200:
            self.logger.warning(
                "Unable to parse sitemap: %s",
                normalized_sitemap_url,
            )
            return

        soup = BeautifulSoup(response.text, "xml")
        child_sitemaps = []
        if soup.find("sitemapindex"):

            child_sitemaps = soup.find_all("sitemap")

            self.logger.info(
                "Sitemap index detected: %s | Nested sitemaps: %s",
                normalized_sitemap_url,
                len(child_sitemaps),
            )

            # UPDATED CODE — adds locale filter before recursing
        for idx, sitemap_tag in enumerate(child_sitemaps, start=1):
            loc = sitemap_tag.find("loc")
            if not loc or not loc.text:
                continue
            child_url = loc.text.strip()

            # ── Locale + content-type filter ──────────────────────────
            if not self._should_index_sitemap(child_url):
                self.logger.info(
                    "Skipping sitemap %s/%s (locale/type filtered): %s",
                    idx,
                    len(child_sitemaps),
                    child_url,
                )
                continue
            # ──────────────────────────────────────────────────────────

            self.logger.info(
                "Processing nested sitemap %s/%s: %s",
                idx,
                len(child_sitemaps),
                child_url,
            )
            self._parse_sitemap(
                sitemap_url=child_url,
                extracted=extracted,
                visited_sitemaps=visited_sitemaps,
            )

            return

        if not soup.find("urlset"):
            self.logger.warning(
                "Unsupported sitemap format: %s",
                normalized_sitemap_url,
            )
            return

        urls = soup.find_all("url")

        self.logger.info(
            "URL sitemap detected: %s | URLs inside: %s",
            normalized_sitemap_url,
            len(urls),
        )

        for count, url_tag in enumerate(urls, start=1):

            loc = url_tag.find("loc")

            if not loc or not loc.text:
                continue

            canonical_url = normalize_url(loc.text)

            last_modified = self._tag_text(url_tag, "lastmod")
            priority = self._priority(url_tag)

            extracted.append(
                ExtractedUrl(
                    url=canonical_url,
                    canonical_url=canonical_url,
                    last_modified=last_modified,
                    priority=priority,
                    source_sitemap=normalized_sitemap_url,
                )
            )

            if count % 100 == 0:
                self.logger.info(
                    "Extracted %s URLs from %s",
                    count,
                    normalized_sitemap_url,
                )

        self.logger.info(
            "Finished sitemap %s | Extracted URLs: %s",
            normalized_sitemap_url,
            len(urls),
        )

    def _is_valid_html_page(self, url: str) -> bool:
        try:
            response = self.session.get(url, timeout=self.timeout, stream=True)
            content_type = response.headers.get("content-type", "").lower()
            if response.status_code != 200:
                self.logger.info("Rejected non-200 URL %s with status %s", url, response.status_code)
                return False
            if "text/html" not in content_type:
                self.logger.info("Rejected non-HTML URL %s with content-type %s", url, content_type)
                return False
            if not looks_english_html(response.text):
                self.logger.info("Rejected non-English URL %s", url)
                return False
            return True
        except requests.RequestException as exc:
            self.logger.warning("Validation request failed for %s: %s", url, exc)
            return False

    def _in_target_scope(self, url: str) -> bool:
        target_parts = urlsplit(self.target_url)
        url_parts = urlsplit(url)
        target_path = target_parts.path.rstrip("/")

        if url_parts.netloc != target_parts.netloc:
            return False
        if not target_path:
            return True
        return url_parts.path == target_path or url_parts.path.startswith(f"{target_path}/")

    @staticmethod
    def _origin(url: str) -> str:
        parts = urlsplit(url)
        return f"{parts.scheme}://{parts.netloc}"

    @staticmethod
    def _looks_like_sitemap(body: str) -> bool:
        soup = BeautifulSoup(body, "xml")
        return bool(soup.find("urlset") or soup.find("sitemapindex"))

    @staticmethod
    def _tag_text(parent: BeautifulSoup, tag_name: str) -> str:
        tag = parent.find(tag_name)
        return tag.text.strip() if tag and tag.text else ""

    @staticmethod
    def _priority(parent: BeautifulSoup) -> float:
        raw_priority = SitemapProcessor._tag_text(parent, "priority")
        if not raw_priority:
            return 0.5
        try:
            return max(0.0, min(1.0, float(raw_priority)))
        except ValueError:
            return 0.5

    @staticmethod
    def _merge_sitemap_records(records: list[SitemapRecord]) -> list[SitemapRecord]:
        merged: list[SitemapRecord] = []
        seen: set[str] = set()
        for record in records:
            normalized_url = normalize_url(str(record.url))
            if normalized_url in seen:
                continue
            seen.add(normalized_url)
            merged.append(SitemapRecord(url=normalized_url, source=record.source))
        return merged
    # Add this as a static method inside SitemapProcessor class

    @staticmethod
    def _should_index_sitemap(sitemap_url: str) -> bool:
        """
        Returns True only for English, high-value sitemaps.
        Skips Arabic locales, regional duplicates, and low-value sitemaps.
        """
        from urllib.parse import urlsplit
        path = urlsplit(sitemap_url).path.lower()

        # Skip all Arabic locale paths
        ARABIC_PREFIXES = ("/ar/", "/ar-kw/", "/ar-sa/", "/ar-qa/", "/ar-om/", "/ar-bh/")
        if any(path.startswith(prefix) for prefix in ARABIC_PREFIXES):
            return False

        # Skip regional English duplicates (same content as base, different pricing)
        # Remove this block if regional pricing differs and you want region-specific content
        REGIONAL_EN_PREFIXES = ("/en-kw/", "/en-sa/", "/en-qa/", "/en-om/", "/en-bh/")
        if any(path.startswith(prefix) for prefix in REGIONAL_EN_PREFIXES):
            return False

        # Skip agentic discovery - not useful for RAG
        if "agentic_discovery" in path:
            return False

        return True