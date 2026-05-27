from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from rag.ingestion.cleaner.deduplicator import remove_duplicate_paragraphs, remove_repeated_lines
from rag.ingestion.cleaner.normalizer import normalize_text


BOILERPLATE_PATTERNS = [
    r"(?im)^skip to content$",
    r"(?im)^book a demo$",
    r"(?im)^contact us$",
    r"(?im)^privacy policy$",
    r"(?im)^terms (of service|and conditions)$",
    r"(?im)^all rights reserved\.?$",
    r"(?im)^subscribe (to )?(our )?newsletter$",
    r"(?im)^accept (all )?cookies$",
    r"(?im)^cookie settings$",
]


@dataclass(frozen=True)
class CleanedText:
    text: str
    encoding_fixed: bool
    repeated_lines_removed: int
    duplicate_paragraphs_removed: int


class DocumentCleaner:
    def clean_document_text(self, document: dict[str, Any]) -> CleanedText:
        text = self._compose_structured_text(document)
        text, encoding_fixed = normalize_text(text)
        text = self._remove_boilerplate_remnants(text)
        text, repeated_lines_removed = remove_repeated_lines(text)
        text, duplicate_paragraphs_removed = remove_duplicate_paragraphs(text)
        text, _ = normalize_text(text)

        return CleanedText(
            text=text,
            encoding_fixed=encoding_fixed,
            repeated_lines_removed=repeated_lines_removed,
            duplicate_paragraphs_removed=duplicate_paragraphs_removed,
        )

    def _compose_structured_text(self, document: dict[str, Any]) -> str:
        blocks: list[str] = []

        title = str(document.get("title") or "").strip()
        if title:
            blocks.append(title)

        for heading in document.get("headings") or []:
            heading_text = str(heading.get("text") or "").strip()
            if heading_text:
                blocks.append(heading_text)

        content = str(document.get("content") or "").strip()
        if content:
            blocks.append(content)

        for list_items in document.get("lists") or []:
            items = [str(item).strip() for item in list_items if str(item).strip()]
            if items:
                blocks.append("\n".join(f"- {item}" for item in items))

        for table in document.get("tables") or []:
            rows = table.get("rows") or []
            table_lines = [
                " | ".join(str(cell).strip() for cell in row if str(cell).strip())
                for row in rows
            ]
            table_lines = [line for line in table_lines if line]
            if table_lines:
                blocks.append("\n".join(table_lines))

        return "\n\n".join(blocks)

    @staticmethod
    def _remove_boilerplate_remnants(text: str) -> str:
        cleaned = text or ""
        for pattern in BOILERPLATE_PATTERNS:
            cleaned = re.sub(pattern, "", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

