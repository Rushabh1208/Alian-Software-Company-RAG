from __future__ import annotations

import re

from rag.utils.token_utils import estimate_tokens


def normalize_text(text: str) -> str:
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    text = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", text)
    text = text.lower()
    text = re.sub(r"[_\-/]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def content_body(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(("Page title:", "Source URL:", "Section:")):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", normalized) if part.strip()]


def compact(text: str, *, max_chars: int) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 3].rstrip() + "..."


def keywords(text: str) -> set[str]:
    stop_words = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "can",
        "do",
        "for",
        "from",
        "how",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "our",
        "that",
        "the",
        "their",
        "this",
        "to",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "with",
        "you",
        "your",
    }
    normalized = normalize_text(text)
    return {
        token
        for token in re.findall(r"[a-z0-9]+", normalized)
        if len(token) > 2 and token not in stop_words
    }


def ngrams(text: str, n: int) -> set[str]:
    tokens = [token for token in re.findall(r"[a-z0-9]+", normalize_text(text)) if len(token) > 2]
    if len(tokens) < n:
        return set()
    return {" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def is_bad_answer(answer: str) -> bool:
    cleaned = answer.strip().lower()
    if not cleaned:
        return True
    if cleaned == "i don't know from the indexed website content.":
        return True
    generic_bad_patterns = [
        "no information available",
        "not enough information",
        "cannot determine",
        "unable to determine",
        "not provided",
    ]
    return any(pattern in cleaned for pattern in generic_bad_patterns)


def near_duplicate_key(text: str) -> str:
    tokens = [token for token in re.findall(r"[a-z0-9]+", normalize_text(text)) if len(token) > 2]
    return " ".join(tokens[:80])

