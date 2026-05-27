from __future__ import annotations

import re

from rag.models.query_models import RetrievedChunk
from rag.utils.text_utils import compact, content_body


GEMINI_MODEL = "gemini-3.1-flash-lite"
MAX_GEMINI_CHARS = 7000


def build_extractive_answer(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "I don't know from the indexed website content."

    parts: list[str] = []
    for chunk in chunks[:3]:
        body = compact(content_body(chunk.document), max_chars=250)
        if body:
            parts.append(body)

    combined = "\n\n".join(parts).strip()
    if not combined:
        return "I don't know from the indexed website content."
    return combined


def build_gemini_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    context_parts: list[str] = []
    for index, chunk in enumerate(chunks[:5], start=1):
        context_parts.append(
            f"""
[{index}]

TITLE:
{chunk.title}

HEADING:
{chunk.heading}

CONTENT:
{compact(content_body(chunk.document), max_chars=1200)}
"""
        )

    context = "\n\n".join(context_parts)[:MAX_GEMINI_CHARS]
    return f"""
You are an intelligent AI assistant.

Rules:
- Answer ONLY from the information.
- Be conversational and well-structured.
- Include ALL valid matching items.
- Use bullets for multiple results.
- Remove duplicates.
- Keep response concise.
- Never mention chunks or references.
- If answer unavailable reply exactly:
I don't know from the indexed website content.

QUESTION:
{question}

INFORMATION:
{context}
"""


def clean_answer(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^\s*answer\s*:\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if not cleaned:
        return "I don't know from the indexed website content."
    return cleaned.strip()

