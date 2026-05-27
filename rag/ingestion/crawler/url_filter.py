from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import PurePosixPath
from urllib.parse import urlsplit


BLOCKED_PATH_TERMS = (
    "login",
    "signup",
    "sign-up",
    "register",
    "privacy",
    "terms",
    "policy",
    "legal",
)

MEDIA_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".pdf",
    ".zip",
    ".mp4",
    ".mov",
    ".avi",
    ".css",
    ".js",
)


@dataclass
class UrlFilterResult:
    accepted_urls: list[str] = field(default_factory=list)
    blocked_urls: list[str] = field(default_factory=list)
    duplicate_urls: list[str] = field(default_factory=list)


def is_blocked_url(url: str) -> bool:
    parts = urlsplit(url)
    path = parts.path.lower()
    suffix = PurePosixPath(path).suffix

    if suffix in MEDIA_EXTENSIONS:
        return True

    return any(term in path for term in BLOCKED_PATH_TERMS)


def filter_urls(urls: list[str]) -> UrlFilterResult:
    result = UrlFilterResult()
    seen: set[str] = set()

    for url in urls:
        if url in seen:
            result.duplicate_urls.append(url)
            continue
        seen.add(url)

        if is_blocked_url(url):
            result.blocked_urls.append(url)
            continue

        result.accepted_urls.append(url)

    return result

