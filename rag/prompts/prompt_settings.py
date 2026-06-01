from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from config.settings import PROJECT_ROOT
from rag.prompts.defaults import (
    DEFAULT_PROMPT_CONSTRAINTS,
    DEFAULT_PROMPT_ROLE,
    MAX_PROMPT_CONSTRAINTS,
    MAX_PROMPT_CONSTRAINT_CHARS,
    MAX_PROMPT_ROLE_CHARS,
)


PROMPT_SETTINGS_PATH = PROJECT_ROOT / "data" / "prompt_settings.json"
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_WHITESPACE = re.compile(r"\s+")
_LEADING_BULLET = re.compile(r"^\s*[-*]+\s*")


@dataclass(frozen=True)
class PromptSettings:
    role: str = DEFAULT_PROMPT_ROLE
    constraints: list[str] | tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "role": self.role,
            "constraints": list(self.constraints),
        }


def load_prompt_settings(path: Path | None = None) -> PromptSettings:
    settings_path = path or PROMPT_SETTINGS_PATH
    if not settings_path.exists():
        return PromptSettings()

    try:
        with settings_path.open("r", encoding="utf-8") as input_file:
            payload = json.load(input_file)
    except (OSError, json.JSONDecodeError):
        return PromptSettings()

    if not isinstance(payload, dict):
        return PromptSettings()

    role = payload.get("role", DEFAULT_PROMPT_ROLE)
    constraints = payload.get("constraints", [])
    if not isinstance(constraints, list):
        constraints = []

    return normalize_prompt_settings(
        role=str(role or ""),
        constraints=[str(item or "") for item in constraints],
    )


def save_prompt_settings(
    settings: PromptSettings,
    *,
    path: Path | None = None,
) -> PromptSettings:
    normalized = normalize_prompt_settings(
        role=settings.role,
        constraints=list(settings.constraints),
    )
    settings_path = path or PROMPT_SETTINGS_PATH
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    temp_path = settings_path.with_suffix(f"{settings_path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as output_file:
        json.dump(normalized.to_dict(), output_file, ensure_ascii=False, indent=2)
    temp_path.replace(settings_path)
    return normalized


def reset_prompt_settings(*, path: Path | None = None) -> PromptSettings:
    return save_prompt_settings(PromptSettings(), path=path)


def normalize_prompt_settings(*, role: str, constraints: list[str]) -> PromptSettings:
    normalized_role = normalize_role(role)
    normalized_constraints = normalize_constraints(constraints)
    return PromptSettings(role=normalized_role, constraints=normalized_constraints)


def normalize_role(role: str) -> str:
    cleaned = sanitize_text(role, max_chars=MAX_PROMPT_ROLE_CHARS)
    return cleaned or DEFAULT_PROMPT_ROLE


def normalize_constraints(constraints: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for raw_constraint in constraints[:MAX_PROMPT_CONSTRAINTS]:
        cleaned = sanitize_text(raw_constraint, max_chars=MAX_PROMPT_CONSTRAINT_CHARS)
        cleaned = _LEADING_BULLET.sub("", cleaned).strip()
        if not cleaned:
            continue

        normalized_key = _normalize_key(cleaned)
        if normalized_key in seen:
            continue

        seen.add(normalized_key)
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
    return list(DEFAULT_PROMPT_CONSTRAINTS)
