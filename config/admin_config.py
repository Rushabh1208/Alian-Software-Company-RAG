from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ADMIN_CONFIG_PATH = PROJECT_ROOT / "data" / "admin_config.json"

DEFAULT_ADMIN_CONFIG: dict[str, Any] = {
    "prompt_seed": {
        "role": (
            "You are a friendly, helpful website assistant. "
            "You speak naturally like a real customer support representative. "
            "You are warm, professional, concise and easy to understand. "
            "You help users find information available on the website while maintaining a natural conversation."
        ),
        "constraints": [
            "Answer only using information supported by the website knowledge.",
            "Speak naturally like a real customer support representative.",
            "Be warm, friendly and professional.",
            "Address the user directly using 'you' and 'your'.",
            "Write short paragraphs or clean bullet points.",
            "Never create large walls of text.",
            "If information exists, answer confidently.",
            "If information is partial, share what is available.",
            "If related information exists, use it to provide guidance.",
            "Always try to be helpful before refusing.",
            "Never mention chunks, context, retrieval, sources or internal systems.",
            "Never expose technical implementation details.",
            "Never invent facts not supported by retrieved information.",
        ],
    },
    "ingestion": {
        "chunk_size": 500,
        "chunk_overlap": 100,
        "batch_size": 100,
        "batch_pause_seconds": 5,
        "embedding_batch_size": 32,
        "max_retries": 3,
        "backoff_multiplier": 2.0,
        "timeout": 30,
        "recursive_fallback_depth": 2,
        "recursive_fallback_pages": 80,
        "max_backoff_seconds": 120.0,
        "rate_limit_retries": 5,
        "rate_limit_base_seconds": 30.0,
    },
    "retrieval": {
        "vector_top_k": 20,
        "final_top_k": 5,
        "max_search_distance": 1.15,
    },
    "reranking": {
        "enabled": True,
        "backend": "auto",
        "model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
    },
    "embedding": {
        "provider": "huggingface",
        "model": "BAAI/bge-small-en-v1.5",
        "batch_size": 32,
        "normalize_embeddings": True,
    },
    "registration": {
        "enabled": True,
        "signup_default_model": "gemini-3.1-flash-lite",
        "signup_default_token_limit": 50000,
        "max_website_contexts_per_user": 2,
        "max_chatbots_per_user": 2,
        "cooldown_minutes": 120,
    },
}


def default_admin_config() -> dict[str, Any]:
    return deepcopy(DEFAULT_ADMIN_CONFIG)


def load_admin_config(config_path: Path = ADMIN_CONFIG_PATH) -> dict[str, Any]:
    config = default_admin_config()
    if not config_path.exists():
        return config

    try:
        with config_path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return config

    if isinstance(raw, dict):
        return merge_admin_config(config, raw)
    return config


def save_admin_config(config: dict[str, Any], config_path: Path = ADMIN_CONFIG_PATH) -> dict[str, Any]:
    normalized = normalize_admin_config(config)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = config_path.with_suffix(f"{config_path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(normalized, handle, ensure_ascii=False, indent=2)
    temp_path.replace(config_path)
    return normalized


def normalize_admin_config(config: dict[str, Any]) -> dict[str, Any]:
    current = default_admin_config()
    return merge_admin_config(current, config or {})


def merge_admin_config(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)

    for section, values in (patch or {}).items():
        if section not in result or not isinstance(values, dict):
            continue
        section_defaults = result.get(section, {})
        if not isinstance(section_defaults, dict):
            continue
        merged_section = deepcopy(section_defaults)
        for key, value in values.items():
            if key not in merged_section:
                continue
            merged_section[key] = _coerce_value(section, key, value, merged_section[key])
        result[section] = merged_section

    return result


def get_prompt_seed(config_path: Path = ADMIN_CONFIG_PATH) -> dict[str, Any]:
    config = load_admin_config(config_path)
    prompt_seed = config.get("prompt_seed", {})
    if not isinstance(prompt_seed, dict):
        return deepcopy(DEFAULT_ADMIN_CONFIG["prompt_seed"])
    return {
        "role": str(prompt_seed.get("role") or DEFAULT_ADMIN_CONFIG["prompt_seed"]["role"]),
        "constraints": [
            str(item)
            for item in prompt_seed.get("constraints") or DEFAULT_ADMIN_CONFIG["prompt_seed"]["constraints"]
            if str(item).strip()
        ],
    }


def _coerce_value(section: str, key: str, value: Any, fallback: Any) -> Any:
    if isinstance(fallback, bool):
        return bool(value)
    if isinstance(fallback, int) and not isinstance(fallback, bool):
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback
    if isinstance(fallback, float):
        try:
            return float(value)
        except (TypeError, ValueError):
            return fallback
    if isinstance(fallback, list):
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return fallback
    if section == "prompt_seed" and key == "role":
        return str(value or "").strip() or fallback
    return str(value) if value is not None else fallback
