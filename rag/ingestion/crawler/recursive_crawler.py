from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from rag.ingestion.crawler.sitemap_utils import fetch_url, normalize_url
from rag.ingestion.crawler.url_filter import filter_urls
from rag.models.ingest_models import ExtractedUrl


@dataclass(frozen=True)
class RecursiveCrawlSummary:
    discovered_urls: int
    visited_pages: int


class RecursiveCrawler:
    def __init__(
        self,
        *,
        target_url: str,
        session: object,
        timeout: int,
        logger: object,
        robots: object,
        max_depth: int = 2,
        max_pages: int = 80,
    ) -> None:
        self.target_url = normalize_url(target_url)
        self.session = session
        self.timeout = timeout
        self.logger = logger
        self.robots = robots
        self.max_depth = max(1, max_depth)
        self.max_pages = max(1, max_pages)

    def discover(self) -> tuple[list[ExtractedUrl], RecursiveCrawlSummary]:
        queue: deque[tuple[str, int]] = deque([(self.target_url, 0)])
        visited: set[str] = set()
        discovered: list[str] = []

        while queue and len(visited) < self.max_pages:
            url, depth = queue.popleft()
            normalized = normalize_url(url)
            if normalized in visited:
                continue
            visited.add(normalized)

            if not self._in_scope(normalized):
                continue

            if not self.robots.allowed(normalized):
                continue

            response = fetch_url(self.session, normalized, self.timeout, self.logger)
            if not response or response.status_code != 200:
                continue

            content_type = response.headers.get("content-type", "") if hasattr(response, "headers") else ""
            if "text/html" not in content_type.lower():
                continue

            discovered.append(normalized)
            if depth >= self.max_depth:
                continue

            for href in self._extract_links(response.text, normalized):
                if href not in visited:
                    queue.append((href, depth + 1))

        filtered = filter_urls(discovered)
        extracted = [
            ExtractedUrl(
                url=url,
                canonical_url=url,
                last_modified="",
                priority=0.5,
                source_sitemap=self.target_url,
            )
            for url in filtered.accepted_urls
        ]
        summary = RecursiveCrawlSummary(
            discovered_urls=len(extracted),
            visited_pages=len(visited),
        )
        return extracted, summary

    def _in_scope(self, url: str) -> bool:
        target_parts = urlsplit(self.target_url)
        url_parts = urlsplit(url)
        if url_parts.netloc != target_parts.netloc:
            return False
        target_path = target_parts.path.rstrip("/")
        if not target_path:
            return True
        return url_parts.path == target_path or url_parts.path.startswith(f"{target_path}/")

    @staticmethod
    def _extract_links(html: str, base_url: str) -> list[str]:
        soup = BeautifulSoup(html, "lxml")
        links: list[str] = []
        for anchor in soup.find_all("a", href=True):
            href = str(anchor.get("href") or "").strip()
            if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue
            candidate = normalize_url(urljoin(base_url, href))
            links.append(candidate)
        return links
