from __future__ import annotations

from pathlib import Path

from bs4 import BeautifulSoup

from rag.ingestion.parser.boilerplate_remover import remove_boilerplate


class HtmlParser:
    def parse_file(self, html_path: Path) -> BeautifulSoup:
        html = html_path.read_text(encoding="utf-8", errors="replace")
        return self.parse_html(html)

    def parse_html(self, html: str) -> BeautifulSoup:
        soup = BeautifulSoup(html, "lxml")
        return remove_boilerplate(soup)

