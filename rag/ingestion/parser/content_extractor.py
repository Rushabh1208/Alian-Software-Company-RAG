from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

import trafilatura
from bs4 import BeautifulSoup, Tag
from readability import Document


CONTENT_SELECTORS = [
    "article",
    "main",
    "[role='main']",
    ".content",
    ".page-content",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".blog-content",
]


@dataclass
class StructuredContent:
    title: str = ""
    meta_description: str = ""
    headings: list[dict[str, Any]] = field(default_factory=list)
    content: str = ""
    lists: list[list[str]] = field(default_factory=list)
    tables: list[dict[str, Any]] = field(default_factory=list)


class ContentExtractor:
    def __init__(self, logger: logging.Logger) -> None:
        self.logger = logger

    def extract(self, html: str, soup: BeautifulSoup) -> StructuredContent:
        container = self._main_container(html, soup)
        content_soup = BeautifulSoup(str(container), "lxml")

        structured = StructuredContent(
            title=self._title(soup),
            meta_description=self._meta_description(soup),
            headings=self._headings(content_soup),
            content=self._hierarchical_text(content_soup),
            lists=self._lists(content_soup),
            tables=self._tables(content_soup),
        )

        if not structured.content:
            fallback_text = trafilatura.extract(html, include_tables=True) or ""
            structured.content = normalize_text(fallback_text)
            if fallback_text:
                self.logger.info("Used trafilatura text fallback")

        return structured

    def _main_container(self, html: str, soup: BeautifulSoup) -> Tag | BeautifulSoup:
        candidates: list[Tag] = []
        for selector in CONTENT_SELECTORS:
            candidates.extend(soup.select(selector))

        if candidates:
            return max(candidates, key=lambda node: len(node.get_text(" ", strip=True)))

        try:
            readable = Document(html)
            summary = readable.summary(html_partial=True)
            readable_soup = BeautifulSoup(summary, "lxml")
            body = readable_soup.body
            if body and len(body.get_text(" ", strip=True)) > 100:
                return body
        except Exception as exc:
            self.logger.warning("Readability fallback failed: %s", exc)

        return soup.body or soup

    @staticmethod
    def _title(soup: BeautifulSoup) -> str:
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return normalize_text(str(og_title["content"]))

        title = soup.find("title")
        if title:
            return normalize_text(title.get_text(" ", strip=True))

        h1 = soup.find("h1")
        return normalize_text(h1.get_text(" ", strip=True)) if h1 else ""

    @staticmethod
    def _meta_description(soup: BeautifulSoup) -> str:
        description = soup.find("meta", attrs={"name": "description"})
        if description and description.get("content"):
            return normalize_text(str(description["content"]))

        og_description = soup.find("meta", property="og:description")
        if og_description and og_description.get("content"):
            return normalize_text(str(og_description["content"]))

        return ""

    @staticmethod
    def _headings(soup: BeautifulSoup) -> list[dict[str, Any]]:
        headings: list[dict[str, Any]] = []
        for heading in soup.find_all(re.compile(r"^h[1-6]$")):
            text = normalize_text(heading.get_text(" ", strip=True))
            if text:
                headings.append({"level": int(heading.name[1]), "text": text})
        return headings

    @staticmethod
    def _hierarchical_text(soup: BeautifulSoup) -> str:
        blocks: list[str] = []
        for node in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p"]):
            text = normalize_text(node.get_text(" ", strip=True))
            if text:
                blocks.append(text)

        if not blocks:
            return normalize_text(soup.get_text("\n", strip=True))

        return "\n\n".join(dedupe_preserve_order(blocks))

    @staticmethod
    def _lists(soup: BeautifulSoup) -> list[list[str]]:
        lists: list[list[str]] = []
        for list_node in soup.find_all(["ul", "ol"]):
            items = [
                normalize_text(item.get_text(" ", strip=True))
                for item in list_node.find_all("li", recursive=False)
            ]
            items = [item for item in items if item]
            if items:
                lists.append(items)
        return lists

    @staticmethod
    def _tables(soup: BeautifulSoup) -> list[dict[str, Any]]:
        tables: list[dict[str, Any]] = []
        for table in soup.find_all("table"):
            rows: list[list[str]] = []
            for row in table.find_all("tr"):
                cells = [
                    normalize_text(cell.get_text(" ", strip=True))
                    for cell in row.find_all(["th", "td"])
                ]
                if any(cells):
                    rows.append(cells)
            if rows:
                tables.append({"rows": rows})
        return tables


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    return deduped

