from __future__ import annotations

import logging
from dataclasses import dataclass

from playwright.async_api import Browser, Page, async_playwright

from config.constants import REQUEST_USER_AGENT
from rag.ingestion.crawler.request_handler import FetchResponse


@dataclass
class PlaywrightCrawler:
    timeout: int
    logger: logging.Logger
    browser: Browser | None = None
    _playwright: object | None = None

    async def __aenter__(self) -> "PlaywrightCrawler":
        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(headless=True)
        return self

    async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def fetch(self, url: str) -> FetchResponse:
        if not self.browser:
            raise RuntimeError("Playwright browser is not initialized")

        page: Page = await self.browser.new_page(user_agent=REQUEST_USER_AGENT)
        try:
            response = await page.goto(
                url,
                wait_until="networkidle",
                timeout=self.timeout * 1000,
            )
            await page.wait_for_load_state("domcontentloaded")
            html = await page.content()

            status_code = response.status if response else 0
            content_type = ""
            if response:
                content_type = response.headers.get("content-type", "")

            return FetchResponse(
                url=url,
                status_code=status_code,
                content_type=content_type,
                text=html,
                crawler="playwright",
            )
        except Exception as exc:
            self.logger.warning("Playwright failed for %s: %s", url, exc)
            raise
        finally:
            await page.close()

