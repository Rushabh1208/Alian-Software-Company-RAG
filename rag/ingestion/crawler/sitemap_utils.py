from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests


TRACKING_PARAMS = {
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "msclkid",
    "ref",
}


def normalize_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower() or "https"
    netloc = parts.netloc.lower()
    path = parts.path.rstrip("/") or "/"

    query_items: list[tuple[str, str]] = []
    seen_keys: set[str] = set()
    for key, value in parse_qsl(parts.query, keep_blank_values=False):
        normalized_key = key.lower()
        if normalized_key.startswith("utm_") or normalized_key in TRACKING_PARAMS:
            continue
        if normalized_key in seen_keys:
            continue
        seen_keys.add(normalized_key)
        query_items.append((normalized_key, value))

    query = urlencode(query_items, doseq=False)
    normalized = urlunsplit((scheme, netloc, path, query, ""))
    return normalized.lower()


def fetch_url(
    session: requests.Session,
    url: str,
    timeout: int,
    logger: logging.Logger,
) -> requests.Response | None:
    try:
        response = session.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "WebsiteRAGIngestionBot/1.0"},
        )
        return response
    except requests.RequestException as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as output_file:
        json.dump(payload, output_file, indent=2, ensure_ascii=False)


def model_to_jsonable(model: Any) -> dict[str, Any]:
    return model.model_dump(mode="json")

