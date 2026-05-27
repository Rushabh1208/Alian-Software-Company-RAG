from __future__ import annotations

import logging
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import requests

from config.constants import ROBOTS_USER_AGENT


@dataclass
class RobotsHandler:
    session: requests.Session
    timeout: int
    logger: logging.Logger
    user_agent: str = ROBOTS_USER_AGENT
    parsers: dict[str, RobotFileParser] = field(default_factory=dict)
    sitemap_urls: dict[str, list[str]] = field(default_factory=dict)

    def _origin(self, url: str) -> str:
        parts = urlsplit(url)
        return f"{parts.scheme}://{parts.netloc}"

    def load(self, base_url: str) -> RobotFileParser:
        origin = self._origin(base_url)
        if origin in self.parsers:
            return self.parsers[origin]

        robots_url = urljoin(origin, "/robots.txt")
        parser = RobotFileParser()
        parser.set_url(robots_url)

        try:
            response = self.session.get(
                robots_url,
                timeout=self.timeout,
                headers={"User-Agent": self.user_agent},
            )
            if response.status_code == 200:
                lines = response.text.splitlines()
                parser.parse(lines)
                self.sitemap_urls[origin] = self._extract_sitemaps(lines)
                self.logger.info("Loaded robots.txt from %s", robots_url)
            else:
                parser.parse([])
                self.sitemap_urls[origin] = []
                self.logger.warning(
                    "robots.txt unavailable at %s with status %s",
                    robots_url,
                    response.status_code,
                )
        except requests.RequestException as exc:
            parser.parse([])
            self.sitemap_urls[origin] = []
            self.logger.warning("Failed to load robots.txt from %s: %s", robots_url, exc)

        self.parsers[origin] = parser
        return parser

    def allowed(self, url: str) -> bool:
        parser = self.load(url)
        return parser.can_fetch(self.user_agent, url)

    def get_sitemaps(self, base_url: str) -> list[str]:
        self.load(base_url)
        return self.sitemap_urls.get(self._origin(base_url), [])

    @staticmethod
    def _extract_sitemaps(lines: list[str]) -> list[str]:
        sitemaps: list[str] = []
        for line in lines:
            if line.lower().startswith("sitemap:"):
                sitemap_url = line.split(":", 1)[1].strip()
                if sitemap_url:
                    sitemaps.append(sitemap_url)
        return sitemaps

