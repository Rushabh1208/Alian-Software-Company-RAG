from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Any

from pydantic import BaseModel, ConfigDict

from rag.ingestion.parser.content_extractor import ContentExtractor
from rag.ingestion.parser.html_parser import HtmlParser


class ParsedDocument(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: str
    title: str
    meta_description: str
    headings: list[dict[str, Any]]
    content: str
    lists: list[list[str]]
    tables: list[dict[str, Any]]


@dataclass(frozen=True)
class ParsingSummary:
    total_pages: int
    parsed_pages: int
    failed_pages: int
    empty_content_pages: int
    average_extracted_text_length: float

    def render(self) -> str:
        return "\n".join(
            [
                "PARSING SUMMARY",
                f"- total pages: {self.total_pages}",
                f"- parsed pages: {self.parsed_pages}",
                f"- failed pages: {self.failed_pages}",
                f"- empty content pages: {self.empty_content_pages}",
                f"- average extracted text length: {self.average_extracted_text_length:.2f}",
            ]
        )


class ParserManager:
    def __init__(
        self,
        raw_dir: Path,
        parsed_dir: Path,
        logger: logging.Logger,
    ) -> None:
        self.raw_dir = raw_dir
        self.parsed_dir = parsed_dir
        self.logger = logger
        self.html_parser = HtmlParser()
        self.extractor = ContentExtractor(logger=logger)

    def run(self) -> tuple[list[ParsedDocument], ParsingSummary]:
        crawl_results = self._load_successful_crawl_results()
        self.parsed_dir.mkdir(parents=True, exist_ok=True)

        documents: list[ParsedDocument] = []
        failed_pages = 0
        empty_content_pages = 0
        text_lengths: list[int] = []

        for crawl_result in crawl_results:
            try:
                html_path = Path(crawl_result["saved_file"])
                if not html_path.exists():
                    failed_pages += 1
                    self.logger.error("Missing raw HTML file for %s: %s", crawl_result["url"], html_path)
                    continue

                html = html_path.read_text(encoding="utf-8", errors="replace")
                soup = self.html_parser.parse_html(html)
                extracted = self.extractor.extract(html=html, soup=soup)

                document = ParsedDocument(
                    url=crawl_result["url"],
                    title=extracted.title,
                    meta_description=extracted.meta_description,
                    headings=extracted.headings,
                    content=extracted.content,
                    lists=extracted.lists,
                    tables=extracted.tables,
                )

                if not document.content:
                    empty_content_pages += 1
                    self.logger.warning("Empty extracted content for %s", document.url)

                text_lengths.append(len(document.content))
                documents.append(document)
                self._write_page_document(document, html_path.stem)
            except Exception as exc:
                failed_pages += 1
                self.logger.exception("Failed to parse %s: %s", crawl_result.get("url", ""), exc)

        self._write_combined_dataset(documents)
        summary = ParsingSummary(
            total_pages=len(crawl_results),
            parsed_pages=len(documents),
            failed_pages=failed_pages,
            empty_content_pages=empty_content_pages,
            average_extracted_text_length=mean(text_lengths) if text_lengths else 0.0,
        )
        return documents, summary

    def _load_successful_crawl_results(self) -> list[dict[str, Any]]:
        crawl_results_path = self.raw_dir / "crawl_results.json"
        with crawl_results_path.open("r", encoding="utf-8") as input_file:
            payload = json.load(input_file)

        return [
            item
            for item in payload
            if item.get("status") == "success" and item.get("saved_file")
        ]

    def _write_page_document(self, document: ParsedDocument, file_stem: str) -> None:
        output_path = self.parsed_dir / f"{file_stem}.json"
        with output_path.open("w", encoding="utf-8") as output_file:
            json.dump(document.model_dump(mode="json"), output_file, indent=2, ensure_ascii=False)

    def _write_combined_dataset(self, documents: list[ParsedDocument]) -> None:
        output_path = self.parsed_dir / "parsed_documents.json"
        with output_path.open("w", encoding="utf-8") as output_file:
            json.dump(
                [document.model_dump(mode="json") for document in documents],
                output_file,
                indent=2,
                ensure_ascii=False,
            )

