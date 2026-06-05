from __future__ import annotations

import re

from bs4 import BeautifulSoup


ENGLISH_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "we",
    "were",
    "will",
    "with",
    "you",
}

NON_LATIN_RE = re.compile(
    r"[\u0400-\u04FF\u0600-\u06FF\u0900-\u0D7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]"
)
WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")


def extract_visible_text(html: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
        tag.decompose()
    return " ".join(soup.stripped_strings)


def _normalized_language_values(html: str) -> list[str]:
    soup = BeautifulSoup(html or "", "html.parser")
    values: list[str] = []

    html_tag = soup.find("html")
    if html_tag:
        lang_attr = html_tag.get("lang")
        if lang_attr:
            values.append(str(lang_attr).strip().lower())

    for meta in soup.find_all("meta"):
        meta_name = str(meta.get("name") or meta.get("http-equiv") or "").strip().lower()
        if meta_name in {"language", "content-language"}:
            content = str(meta.get("content") or "").strip().lower()
            if content:
                values.append(content)

    return values


def looks_english_html(html: str) -> bool:
    text = extract_visible_text(html)
    return looks_english_text(text, html=html)


def looks_english_text(text: str, *, html: str | None = None) -> bool:
    if html:
        language_values = _normalized_language_values(html)
        if any(value.startswith("en") or value == "x-default" for value in language_values):
            return True

    text = (text or "").strip()
    if not text:
        return False

    if NON_LATIN_RE.search(text):
        return False

    letters = [char for char in text if char.isalpha()]
    if not letters:
        return False

    ascii_ratio = sum(1 for char in letters if ord(char) < 128) / len(letters)
    if ascii_ratio < 0.85:
        return False

    words = WORD_RE.findall(text.lower())
    if not words:
        return False

    stopword_hits = sum(1 for word in words if word in ENGLISH_STOPWORDS)
    stopword_ratio = stopword_hits / len(words)

    if len(words) < 25:
        return (stopword_hits >= 1 and ascii_ratio >= 0.85) or (
            stopword_hits >= 2 and ascii_ratio >= 0.8
        )

    return stopword_ratio >= 0.03 or (stopword_hits >= 3 and ascii_ratio >= 0.85)


def detect_language(text: str, *, html: str | None = None) -> str:
    if looks_english_text(text, html=html):
        return "en"
    return "other"
