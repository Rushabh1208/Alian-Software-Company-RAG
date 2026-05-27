from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path

import requests

from rag.ingestion.crawler.crawler import (
    CrawlResult,
    RawCrawlTarget,
    is_valid_html_response,
    needs_playwright,
    save_raw_html,
)
from rag.ingestion.crawler.playwright_crawler import PlaywrightCrawler
from rag.ingestion.crawler.request_handler import RequestHandler
from rag.ingestion.crawler.robots_handler import RobotsHandler


@dataclass(frozen=True)
class CrawlSummary:
    total_urls: int
    successful_crawls: int
    failed_crawls: int
    playwright_pages: int
    skipped_pages: int

    def render(self) -> str:
        return "\n".join(
            [
                "CRAWL SUMMARY",
                f"- total URLs: {self.total_urls}",
                f"- successful crawls: {self.successful_crawls}",
                f"- failed crawls: {self.failed_crawls}",
                f"- Playwright pages: {self.playwright_pages}",
                f"- skipped pages: {self.skipped_pages}",
            ]
        )


class CrawlManager:
    def __init__(
        self,
        targets_path: Path,
        raw_dir: Path,
        timeout: int,
        retries: int,
        rate_limit: int,
        logger: logging.Logger,
    ) -> None:
        self.targets_path = targets_path
        self.raw_dir = raw_dir
        self.timeout = timeout
        self.retries = retries
        self.rate_limit = max(1, rate_limit)
        self.logger = logger
        self.request_handler = RequestHandler(timeout=timeout, retries=retries, logger=logger)
        self.robots = RobotsHandler(
            session=requests.Session(),
            timeout=timeout,
            logger=logger,
        )
        self._concurrency = asyncio.Semaphore(self.rate_limit)
        self._rate_lock = asyncio.Lock()
        self._last_request_time = 0.0

    async def run(self) -> tuple[list[CrawlResult], CrawlSummary]:
        targets = self.load_targets()
        self.raw_dir.mkdir(parents=True, exist_ok=True)

        async with PlaywrightCrawler(timeout=self.timeout, logger=self.logger) as playwright:
            results = await asyncio.gather(
                *(self._crawl_target(target, playwright) for target in targets)
            )

        self.write_results(results)
        summary = CrawlSummary(
            total_urls=len(targets),
            successful_crawls=sum(1 for result in results if result.status == "success"),
            failed_crawls=sum(1 for result in results if result.status == "failed"),
            playwright_pages=sum(1 for result in results if result.crawler == "playwright"),
            skipped_pages=sum(1 for result in results if result.status == "skipped"),
        )
        return results, summary

    def load_targets(self) -> list[RawCrawlTarget]:
        with self.targets_path.open("r", encoding="utf-8") as input_file:
            payload = json.load(input_file)
        return [RawCrawlTarget.model_validate(item) for item in payload]

    def write_results(self, results: list[CrawlResult]) -> None:
        output_path = self.raw_dir / "crawl_results.json"
        with output_path.open("w", encoding="utf-8") as output_file:
            json.dump(
                [result.model_dump(mode="json") for result in results],
                output_file,
                indent=2,
                ensure_ascii=False,
            )

    async def _crawl_target(
        self,
        target: RawCrawlTarget,
        playwright: PlaywrightCrawler,
    ) -> CrawlResult:
        async with self._concurrency:
            return await self._crawl_target_inner(target, playwright)

    async def _crawl_target_inner(
        self,
        target: RawCrawlTarget,
        playwright: PlaywrightCrawler,
    ) -> CrawlResult:
        url = str(target.canonical_url or target.url)

        if not await asyncio.to_thread(self.robots.allowed, url):
            self.logger.info("Skipping robots-blocked URL: %s", url)
            return CrawlResult(url=url, status="skipped", error="blocked by robots.txt")

        try:
            await self._wait_for_rate_limit()
            response = await asyncio.to_thread(self.request_handler.fetch, url)

            if is_valid_html_response(response) and not needs_playwright(response.text):
                saved_file = save_raw_html(self.raw_dir, url, response.text)
                return CrawlResult(
                    url=url,
                    status="success",
                    status_code=response.status_code,
                    crawler="requests",
                    saved_file=str(saved_file),
                    content_length=len(response.text),
                )

            fallback_reason = self._fallback_reason(response)
            self.logger.info("Using Playwright fallback for %s: %s", url, fallback_reason)

            await self._wait_for_rate_limit()
            playwright_response = await playwright.fetch(url)
            if not is_valid_html_response(playwright_response):
                return CrawlResult(
                    url=url,
                    status="failed",
                    status_code=playwright_response.status_code,
                    crawler="playwright",
                    content_length=len(playwright_response.text),
                    error=f"invalid response content-type: {playwright_response.content_type}",
                )

            saved_file = save_raw_html(self.raw_dir, url, playwright_response.text)
            return CrawlResult(
                url=url,
                status="success",
                status_code=playwright_response.status_code,
                crawler="playwright",
                saved_file=str(saved_file),
                content_length=len(playwright_response.text),
            )
        except Exception as exc:
            self.logger.error("Failed to crawl %s: %s", url, exc)
            return CrawlResult(url=url, status="failed", error=str(exc))

    async def _wait_for_rate_limit(self) -> None:
        interval = 1.0 / self.rate_limit
        async with self._rate_lock:
            elapsed = time.monotonic() - self._last_request_time
            if elapsed < interval:
                await asyncio.sleep(interval - elapsed)
            self._last_request_time = time.monotonic()

    @staticmethod
    def _fallback_reason(response: object) -> str:
        if not is_valid_html_response(response):
            return "invalid status code or content-type"
        if needs_playwright(response.text):
            return "empty, low-text, or JS-rendered HTML"
        return "unknown"

