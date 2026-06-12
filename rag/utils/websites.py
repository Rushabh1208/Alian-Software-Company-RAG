from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

from config.constants import DEFAULT_BASE_COLLECTION_NAME, WEBSITE_COLLECTION_PREFIX

# Separator used between the URL slug and the user-id suffix in collection names.
# Must not appear in normal slugs (which use only [a-z0-9_]).
_USER_SUFFIX_SEP = "_u_"

# Maximum characters to use from a sanitised user-id in the collection name.
# ChromaDB collection names must be 3–63 characters, all lowercase
# alphanumeric + underscores/hyphens, no consecutive dots.
_MAX_USER_SLUG_LEN = 20


@dataclass(frozen=True)
class WebsiteRecord:
    id: str
    url: str
    domain: str
    collection_name: str
    workspace_name: str
    source_type: str = "website"
    source_url: str = ""
    status: str = "indexed"
    indexed_at: str = ""
    updated_at: str = ""
    # Multi-tenancy: which user owns this collection (may be empty for legacy/shared records)
    owner_user_id: str = ""

    def to_json(self) -> dict[str, str]:
        return {key: str(value) for key, value in asdict(self).items()}


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def normalize_website_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = parts.scheme or "https"
    netloc = parts.netloc or parts.path
    path = parts.path if parts.netloc else ""
    normalized = f"{scheme.lower()}://{netloc.lower()}{path}"
    if not normalized.endswith("/") and not parts.path:
        normalized += "/"
    return normalized.rstrip("/")


def website_domain(url: str) -> str:
    parts = urlsplit(normalize_website_url(url))
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def website_slug(url: str) -> str:
    domain = website_domain(url)
    slug = re.sub(r"[^a-z0-9]+", "_", domain.lower()).strip("_")
    return slug or DEFAULT_BASE_COLLECTION_NAME


def _sanitise_user_id(user_id: str) -> str:
    """Convert an arbitrary user-id string to a safe slug usable in a collection name."""
    slug = re.sub(r"[^a-z0-9]", "_", user_id.lower()).strip("_")
    slug = re.sub(r"_+", "_", slug)  # collapse consecutive underscores
    return slug[:_MAX_USER_SLUG_LEN].strip("_") or "user"


def website_collection_name(url: str, *, user_id: str | None = None) -> str:
    """
    Return the ChromaDB collection name for a URL, optionally scoped to a user.

    When *user_id* is provided the name is user-scoped:
        website_<slug>_u_<sanitised_user_id>

    This guarantees that two different users indexing the same URL each get
    their own, fully isolated ChromaDB collection.

    The base/shared collection (aliansoftware.com) is never user-scoped.
    """
    if _is_default_company_site(url):
        return DEFAULT_BASE_COLLECTION_NAME

    base = f"{WEBSITE_COLLECTION_PREFIX}{website_slug(url)}"
    if user_id:
        user_slug = _sanitise_user_id(str(user_id))
        return f"{base}{_USER_SUFFIX_SEP}{user_slug}"
    return base


def website_workspace_name(url: str, *, user_id: str | None = None) -> str:
    """Return the filesystem workspace name (mirrors the collection name)."""
    return website_collection_name(url, user_id=user_id)


def build_website_record(
    url: str,
    *,
    collection_name: str | None = None,
    user_id: str | None = None,
) -> WebsiteRecord:
    normalized = normalize_website_url(url)
    domain = website_domain(normalized)
    collection = collection_name or website_collection_name(normalized, user_id=user_id)
    now = now_iso()
    return WebsiteRecord(
        id=collection,
        url=normalized,
        domain=domain,
        collection_name=collection,
        workspace_name=collection,
        source_url=normalized,
        indexed_at=now,
        updated_at=now,
        owner_user_id=str(user_id) if user_id else "",
    )


def load_json_records(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, dict)]


def save_json_records(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(records, handle, indent=2, ensure_ascii=False)


def upsert_website_record(path: Path, record: WebsiteRecord) -> WebsiteRecord:
    records = load_json_records(path)
    now = now_iso()
    payload = record.to_json()
    payload["updated_at"] = now
    payload["indexed_at"] = record.indexed_at or now

    filtered = [item for item in records if str(item.get("id") or "") != record.id]
    filtered.append(payload)
    save_json_records(path, filtered)
    return WebsiteRecord(**{k: payload.get(k, "") for k in WebsiteRecord.__dataclass_fields__})


def remove_website_record(path: Path, record_id: str) -> WebsiteRecord | None:
    records = load_json_records(path)
    remaining: list[dict[str, str]] = []
    removed: WebsiteRecord | None = None

    for item in records:
        if str(item.get("id") or "") == record_id:
            removed = WebsiteRecord(
                id=str(item.get("id") or record_id),
                url=str(item.get("url") or ""),
                domain=str(item.get("domain") or ""),
                collection_name=str(item.get("collection_name") or record_id),
                workspace_name=str(item.get("workspace_name") or record_id),
                source_type=str(item.get("source_type") or "website"),
                source_url=str(item.get("source_url") or ""),
                status=str(item.get("status") or "indexed"),
                indexed_at=str(item.get("indexed_at") or ""),
                updated_at=str(item.get("updated_at") or ""),
                owner_user_id=str(item.get("owner_user_id") or ""),
            )
            continue
        remaining.append(item)

    save_json_records(path, remaining)
    return removed


def filter_records_by_user(
    records: list[dict[str, str]],
    user_id: str | None,
    *,
    include_shared: bool = True,
) -> list[dict[str, str]]:
    """
    Filter a list of website registry records to only those belonging to *user_id*.

    When *include_shared* is True (default) the shared base collection
    (owner_user_id == "") is always included regardless of user_id.
    """
    if user_id is None:
        return records  # admin / unauthenticated → return all

    result = []
    for item in records:
        owner = str(item.get("owner_user_id") or "")
        if include_shared and not owner:
            result.append(item)
            continue
        if owner == str(user_id):
            result.append(item)
    return result


def _is_default_company_site(url: str) -> bool:
    return website_domain(url) in {"aliansoftware.com", "www.aliansoftware.com"}