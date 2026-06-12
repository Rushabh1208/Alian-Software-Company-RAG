from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from config.settings import PROJECT_ROOT
from rag.prompts.defaults import (
    default_prompt_constraints,
    default_prompt_role,
    MAX_PROMPT_CONSTRAINTS,
    MAX_PROMPT_CONSTRAINT_CHARS,
    MAX_PROMPT_ROLE_CHARS,
)


# Legacy global file — kept only for the shared/default base collection.
PROMPT_SETTINGS_PATH = PROJECT_ROOT / "data" / "prompt_settings.json"

# Per-collection (global, no user scope) settings live here.
PROMPT_SETTINGS_DIR = PROJECT_ROOT / "data" / "prompt_settings"

# Per-user, per-collection settings live here:
#   data/prompt_settings_users/<user_id>/<safe_collection>.json
PROMPT_SETTINGS_USERS_DIR = PROJECT_ROOT / "data" / "prompt_settings_users"

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_WHITESPACE = re.compile(r"\s+")
_LEADING_BULLET = re.compile(r"^\s*[-*]+\s*")
_SAFE_NAME = re.compile(r"[^a-zA-Z0-9_-]+")


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _safe(name: str) -> str:
    """Sanitise a user id or collection name so it is safe as a filename."""
    return _SAFE_NAME.sub("_", str(name or "").strip()) or "unknown"


def prompt_settings_path_for_collection(collection: str | None = None) -> Path:
    """Return the *global* (non-user-scoped) per-collection settings file.

    Used as the fallback when no user-specific override exists, and by
    legacy callers that don't pass a user_id.
    """
    normalized = str(collection or "").strip()
    if not normalized:
        return PROMPT_SETTINGS_PATH

    return PROMPT_SETTINGS_DIR / f"{_safe(normalized)}.json"


def prompt_settings_path_for_user_collection(
    user_id: str | None,
    collection: str | None = None,
) -> Path:
    """Return the *user-specific* settings file for a given collection.

    Layout on disk:
        data/prompt_settings_users/<safe_user_id>/<safe_collection>.json

    If user_id is absent or blank, falls back to the global per-collection
    path so callers can always get *some* path without extra branching.
    """
    uid = str(user_id or "").strip()
    if not uid:
        return prompt_settings_path_for_collection(collection)

    col = str(collection or "").strip()
    if not col:
        return prompt_settings_path_for_collection(collection)
    return PROMPT_SETTINGS_USERS_DIR / _safe(uid) / f"{_safe(col)}.json"


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PromptSettings:
    role: str = field(default_factory=default_prompt_role)
    constraints: list[str] | tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, Any]:
        return {
            "role": self.role,
            "constraints": list(self.constraints),
        }


# ---------------------------------------------------------------------------
# Load / save helpers
# ---------------------------------------------------------------------------

def _load_from_path(path: Path) -> PromptSettings | None:
    """Load settings from *path*, returning None if the file is absent/invalid."""
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None

    role = payload.get("role", default_prompt_role())
    constraints = payload.get("constraints", [])
    if not isinstance(constraints, list):
        constraints = []

    return normalize_prompt_settings(
        role=str(role or ""),
        constraints=[str(item or "") for item in constraints],
    )


def load_prompt_settings(path: Path | None = None) -> PromptSettings:
    """Load from an explicit path (legacy / global collection path).

    Falls back to defaults when the file is absent or unreadable.
    """
    return _load_from_path(path or PROMPT_SETTINGS_PATH) or PromptSettings()


def load_prompt_settings_for_user(
    user_id: str | None,
    collection: str | None = None,
) -> PromptSettings:
    """Load settings with a two-level fallback chain:

    1. User-specific file   → data/prompt_settings_users/<uid>/<col>.json
    2. Global collection    → data/prompt_settings/<col>.json  (or legacy root)
    3. Hard-coded defaults  → PromptSettings()
    """
    # Try user-specific file first.
    user_path = prompt_settings_path_for_user_collection(user_id, collection)
    settings = _load_from_path(user_path)
    if settings is not None:
        return settings

    # Fall back to global collection settings.
    global_path = prompt_settings_path_for_collection(collection)
    settings = _load_from_path(global_path)
    if settings is not None:
        return settings

    return PromptSettings()


def save_prompt_settings(
    settings: PromptSettings,
    *,
    path: Path | None = None,
) -> PromptSettings:
    """Save to an explicit path (legacy / global collection path)."""
    normalized = normalize_prompt_settings(
        role=settings.role,
        constraints=list(settings.constraints),
    )
    settings_path = path or PROMPT_SETTINGS_PATH
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    temp_path = settings_path.with_suffix(f"{settings_path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as fh:
        json.dump(normalized.to_dict(), fh, ensure_ascii=False, indent=2)
    temp_path.replace(settings_path)
    return normalized


def save_prompt_settings_for_user(
    settings: PromptSettings,
    *,
    user_id: str | None,
    collection: str | None = None,
) -> PromptSettings:
    """Persist user-specific prompt settings for a given collection.

    Always writes to the user-scoped path, never to the shared global file,
    so one user's changes never bleed into another user's experience.
    """
    path = prompt_settings_path_for_user_collection(user_id, collection)
    return save_prompt_settings(settings, path=path)


def reset_prompt_settings(*, path: Path | None = None) -> PromptSettings:
    """Reset the global/legacy file to defaults."""
    return save_prompt_settings(PromptSettings(), path=path)


def reset_prompt_settings_for_user(
    *,
    user_id: str | None,
    collection: str | None = None,
) -> PromptSettings:
    """Delete the user-specific override so the fallback chain kicks in."""
    path = prompt_settings_path_for_user_collection(user_id, collection)
    if path.exists():
        path.unlink(missing_ok=True)
    # Return the effective settings after deletion (global or defaults).
    return load_prompt_settings_for_user(user_id, collection)


# ---------------------------------------------------------------------------
# Normalisation / validation
# ---------------------------------------------------------------------------

def normalize_prompt_settings(*, role: str, constraints: list[str]) -> PromptSettings:
    return PromptSettings(
        role=normalize_role(role),
        constraints=normalize_constraints(constraints),
    )


def normalize_role(role: str) -> str:
    cleaned = sanitize_text(role, max_chars=MAX_PROMPT_ROLE_CHARS)
    return cleaned or default_prompt_role()


def normalize_constraints(constraints: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for raw in constraints[:MAX_PROMPT_CONSTRAINTS]:
        cleaned = sanitize_text(raw, max_chars=MAX_PROMPT_CONSTRAINT_CHARS)
        cleaned = _LEADING_BULLET.sub("", cleaned).strip()
        if not cleaned:
            continue
        key = _normalize_key(cleaned)
        if key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned)

    return normalized


def sanitize_text(text: str, *, max_chars: int) -> str:
    cleaned = str(text or "")
    cleaned = cleaned.replace("<", " ").replace(">", " ")
    cleaned = _CONTROL_CHARS.sub(" ", cleaned)
    cleaned = _WHITESPACE.sub(" ", cleaned).strip()
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars].rstrip()
    return cleaned


def _normalize_key(text: str) -> str:
    return _WHITESPACE.sub(" ", text).strip().lower()


def merge_constraints(*constraint_groups: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for group in constraint_groups:
        for constraint in group:
            cleaned = sanitize_text(constraint, max_chars=MAX_PROMPT_CONSTRAINT_CHARS)
            cleaned = _LEADING_BULLET.sub("", cleaned).strip()
            if not cleaned:
                continue
            key = _normalize_key(cleaned)
            if key in seen:
                continue
            seen.add(key)
            merged.append(cleaned)
    return merged


def default_constraints() -> list[str]:
    return list(default_prompt_constraints())
