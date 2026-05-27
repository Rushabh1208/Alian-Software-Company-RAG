from __future__ import annotations

import hashlib
import re

import ftfy
import tiktoken

from rag.ingestion.chunking.heading_chunker import HeadingChunker
from rag.ingestion.chunking.heading_chunker import HeadingSection
from rag.ingestion.chunking.recursive_chunker import RecursiveChunker


MIN_CHUNK_TOKENS = 12


class SemanticChunker:
    def __init__(self) -> None:
        self.heading_chunker = HeadingChunker()
        self.recursive_chunker = RecursiveChunker()
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def chunk_text(
        self,
        text: str,
        category: str,
        fallback_heading: str,
        default_chunk_size: int,
        default_overlap: int,
        title: str = "",
        source_url: str = "",
    ) -> list[tuple[str, str]]:
        chunk_size, overlap = chunk_settings(category, default_chunk_size, default_overlap)
        fixed_text = ftfy.fix_text(text or "")
        fixed_heading = ftfy.fix_text(fallback_heading or "")
        fixed_title = ftfy.fix_text(title or fixed_heading)
        sections = self.heading_chunker.split_sections(fixed_text, fallback_heading=fixed_heading)
        sections = self._merge_small_sections(sections)
        chunks = self._fact_chunks(fixed_text, fixed_title, source_url)
        seen_content = {chunk_fingerprint(content) for _, content in chunks}

        for section in sections:
            section_text = self._with_context(
                title=fixed_title,
                source_url=source_url,
                heading=section.heading,
                content=section.content,
            )
            for chunk in self.recursive_chunker.split(section_text, chunk_size, overlap):
                fingerprint = chunk_fingerprint(chunk)
                if fingerprint in seen_content:
                    continue
                seen_content.add(fingerprint)
                chunks.append((section.heading, chunk))

        return chunks

    def token_count(self, text: str) -> int:
        return len(self.encoding.encode(text or ""))

    def _merge_small_sections(self, sections: list[HeadingSection]) -> list[HeadingSection]:
        merged: list[HeadingSection] = []
        pending_heading = ""
        pending_parts: list[str] = []

        for section in sections:
            section_tokens = self.token_count(section.content)
            if section_tokens < MIN_CHUNK_TOKENS:
                if not pending_heading:
                    pending_heading = section.heading
                pending_parts.append(section.content)
                continue

            if pending_parts:
                content = "\n\n".join([*pending_parts, section.content]).strip()
                merged.append(
                    HeadingSection(
                        heading=pending_heading or section.heading,
                        content=content,
                    )
                )
                pending_heading = ""
                pending_parts = []
                continue

            merged.append(section)

        if pending_parts:
            merged.append(
                HeadingSection(
                    heading=pending_heading,
                    content="\n\n".join(pending_parts).strip(),
                )
            )

        return merged

    def _fact_chunks(self, text: str, title: str, source_url: str) -> list[tuple[str, str]]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text or "") if part.strip()]
        chunks: list[tuple[str, str]] = []
        for index, paragraph in enumerate(paragraphs):
            if self._looks_like_person_name(paragraph) and index + 1 < len(paragraphs):
                role = paragraphs[index + 1].strip()
                if self._looks_like_role(role):
                    bio = paragraphs[index + 2].strip() if index + 2 < len(paragraphs) else ""
                    content = "\n\n".join(part for part in (paragraph, role, bio) if part).strip()
                    chunks.append(
                        (
                            paragraph,
                            self._with_context(
                                title=title,
                                source_url=source_url,
                                heading=paragraph,
                                content=content,
                            ),
                        )
                    )

            if paragraph.startswith("- "):
                for line in paragraph.splitlines():
                    line = line.strip()
                    if line.startswith("- ") and len(line) >= 25:
                        heading = line[2:].split("  ")[0][:120]
                        chunks.append(
                            (
                                heading,
                                self._with_context(
                                    title=title,
                                    source_url=source_url,
                                    heading=heading,
                                    content=line,
                                ),
                            )
                        )

        return chunks

    @staticmethod
    def _with_context(*, title: str, source_url: str, heading: str, content: str) -> str:
        parts = [
            f"Page title: {title}".strip(),
            f"Source URL: {source_url}".strip(),
            f"Section: {heading}".strip(),
            "",
            content.strip(),
        ]
        return "\n".join(part for part in parts if part).strip()

    @staticmethod
    def _looks_like_person_name(text: str) -> bool:
        if "\n" in text:
            return False
        words = text.split()
        if not 2 <= len(words) <= 4:
            return False
        return all(re.fullmatch(r"[A-Z][a-z]+", word) for word in words)

    @staticmethod
    def _looks_like_role(text: str) -> bool:
        if "\n" in text or len(text) > 90:
            return False
        role_terms = {
            "CEO",
            "CTO",
            "CFO",
            "CMO",
            "Director",
            "Engineer",
            "Architect",
            "Designer",
            "Founder",
            "Lead",
            "Manager",
        }
        return any(term in text for term in role_terms)


def chunk_settings(category: str, default_chunk_size: int, default_overlap: int) -> tuple[int, int]:
    normalized_category = (category or "").lower()
    if normalized_category == "blog":
        return 900, min(default_overlap, 180)
    if normalized_category in {"faq", "faqs"}:
        return 450, min(default_overlap, 100)
    if normalized_category == "services":
        return 650, min(default_overlap, 140)
    return max(default_chunk_size, 700), min(default_overlap, 160)


def stable_chunk_id(document_id: str, content: str, index: int) -> str:
    normalized = re.sub(r"\s+", " ", content or "").strip()
    seed = f"{document_id}|{index}|{normalized}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def chunk_fingerprint(content: str) -> str:
    normalized = re.sub(r"\W+", " ", (content or "").lower()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

