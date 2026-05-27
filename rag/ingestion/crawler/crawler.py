from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Literal

from bs4 import BeautifulSoup
from pydantic import BaseModel, ConfigDict, HttpUrl

from rag.ingestion.crawler.request_handler import FetchResponse


class RawCrawlTarget(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: HttpUrl
    canonical_url: str
    status: str = "pending"


class CrawlResult(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: str
    status: Literal["success", "failed", "skipped"]
    status_code: int = 0
    crawler: Literal["requests", "playwright", "none"] = "none"
    saved_file: str = ""
    content_length: int = 0
    error: str = ""


def filename_for_url(url: str) -> str:
    return f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.html"


def save_raw_html(raw_dir: Path, url: str, html: str) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    output_path = raw_dir / filename_for_url(url)
    output_path.write_text(html, encoding="utf-8")
    return output_path


def is_valid_html_response(response: FetchResponse) -> bool:
    return response.status_code == 200 and "text/html" in response.content_type.lower()


def needs_playwright(html: str) -> bool:
    stripped_html = html.strip()
    if not stripped_html:
        return True

    soup = BeautifulSoup(stripped_html, "lxml")
    body = soup.body
    body_text = body.get_text(" ", strip=True) if body else soup.get_text(" ", strip=True)

    if len(body_text) < 250:
        return True

    script_count = len(soup.find_all("script"))
    paragraph_count = len(soup.find_all(["p", "li", "h1", "h2", "h3"]))
    js_root = soup.find(id="__next") or soup.find(id="root")

    if js_root and paragraph_count < 3:
        return True
    if script_count > 15 and paragraph_count < 5:
        return True

    return False

