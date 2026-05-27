from __future__ import annotations

import hashlib
import re


def fingerprint_text(text: str) -> str:
    normalized = re.sub(r"\W+", " ", (text or "").lower()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def remove_repeated_lines(text: str) -> tuple[str, int]:
    seen: set[str] = set()
    output: list[str] = []
    removed = 0

    for line in (text or "").splitlines():
        normalized = line.strip()
        if not normalized:
            if output and output[-1] != "":
                output.append("")
            continue
        key = normalized.lower()
        if key in seen:
            removed += 1
            continue
        seen.add(key)
        output.append(normalized)

    return "\n".join(output).strip(), removed


def remove_duplicate_paragraphs(text: str) -> tuple[str, int]:
    paragraphs = re.split(r"\n\s*\n", text or "")
    seen: set[str] = set()
    output: list[str] = []
    removed = 0

    for paragraph in paragraphs:
        normalized = re.sub(r"\s+", " ", paragraph).strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            removed += 1
            continue
        seen.add(key)
        output.append(paragraph.strip())

    return "\n\n".join(output).strip(), removed

