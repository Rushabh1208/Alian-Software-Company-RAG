from __future__ import annotations

import re
import unicodedata

import ftfy


def fix_encoding(text: str) -> tuple[str, bool]:
    fixed = ftfy.fix_text(text or "")
    return fixed, fixed != (text or "")


def normalize_unicode(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "")


def normalize_line_breaks(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_whitespace(text: str) -> str:
    text = re.sub(r"[ \t\f\v]+", " ", text or "")
    text = re.sub(r" *\n *", "\n", text)
    return normalize_line_breaks(text)


def normalize_text(text: str) -> tuple[str, bool]:
    fixed, changed = fix_encoding(text)
    normalized = normalize_unicode(fixed)
    normalized = normalize_whitespace(normalized)
    return normalized, changed or normalized != (text or "")

