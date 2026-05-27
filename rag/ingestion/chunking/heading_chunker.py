from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class HeadingSection:
    heading: str
    content: str


class HeadingChunker:
    def split_sections(self, text: str, fallback_heading: str = "") -> list[HeadingSection]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text or "") if part.strip()]
        if not paragraphs:
            return []

        sections: list[HeadingSection] = []
        current_heading = fallback_heading or paragraphs[0][:160]
        current_parts: list[str] = []

        for paragraph in paragraphs:
            if self._looks_like_heading(paragraph):
                if current_parts:
                    sections.append(
                        HeadingSection(
                            heading=current_heading,
                            content="\n\n".join(current_parts).strip(),
                        )
                    )
                    current_parts = []
                current_heading = paragraph[:240]
                current_parts.append(paragraph)
            else:
                current_parts.append(paragraph)

        if current_parts:
            sections.append(
                HeadingSection(
                    heading=current_heading,
                    content="\n\n".join(current_parts).strip(),
                )
            )

        return sections

    @staticmethod
    def _looks_like_heading(paragraph: str) -> bool:
        if "\n" in paragraph:
            return False
        if paragraph.startswith("- "):
            return False
        word_count = len(paragraph.split())
        if word_count <= 10 and len(paragraph) <= 90:
            return True
        return False

