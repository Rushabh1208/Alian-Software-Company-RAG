from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import os

import yaml
from dotenv import load_dotenv

from config.admin_config import load_admin_config


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "config.yaml"


@dataclass(frozen=True)
class AppSettings:
    chroma_db_path: Path
    config: dict[str, Any]


def load_yaml_config(config_path: Path = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as config_file:
        config = yaml.safe_load(config_file) or {}

    if not isinstance(config, dict):
        raise ValueError(f"Configuration file must contain a mapping: {config_path}")

    return config


def load_settings(config_path: Path = DEFAULT_CONFIG_PATH) -> AppSettings:
    load_dotenv(PROJECT_ROOT / ".env")
    config = load_yaml_config(config_path)
    admin_config = load_admin_config()
    vectordb_config = config.get("vectordb", {})
    streaming_config = config.setdefault("streaming_ingestion", {})
    chunking_config = config.setdefault("chunking", {})
    embeddings_config = config.setdefault("embeddings", {})
    crawler_config = config.setdefault("crawler", {})
    config["retrieval"] = admin_config.get("retrieval", {})
    config["reranking"] = admin_config.get("reranking", {})
    config["registration"] = admin_config.get("registration", {})
    config["prompt_seed"] = admin_config.get("prompt_seed", {})

    _maybe_override_number(streaming_config, "batch_size", os.getenv("RAG_BATCH_SIZE"), int)
    _maybe_override_number(
        streaming_config,
        "batch_pause_seconds",
        os.getenv("RAG_BATCH_PAUSE_SECONDS"),
        float,
    )
    _maybe_override_number(
        streaming_config,
        "embedding_batch_size",
        os.getenv("RAG_EMBEDDING_BATCH_SIZE"),
        int,
    )
    _maybe_override_number(
        streaming_config,
        "max_retries",
        os.getenv("RAG_MAX_RETRIES"),
        int,
    )
    _maybe_override_number(
        streaming_config,
        "backoff_multiplier",
        os.getenv("RAG_BACKOFF_MULTIPLIER"),
        float,
    )

    ingestion_config = admin_config.get("ingestion", {})
    if isinstance(ingestion_config, dict):
        _merge_numeric_fields(
            streaming_config,
            ingestion_config,
            {
                "batch_size": ("batch_size", int),
                "batch_pause_seconds": ("batch_pause_seconds", float),
                "embedding_batch_size": ("embedding_batch_size", int),
                "max_retries": ("max_retries", int),
                "backoff_multiplier": ("backoff_multiplier", float),
            },
        )
        _merge_numeric_fields(
            chunking_config,
            ingestion_config,
            {
                "chunk_size": ("chunk_size", int),
                "overlap": ("chunk_overlap", int),
            },
        )
        _merge_numeric_fields(
            crawler_config,
            ingestion_config,
            {
                "timeout": ("timeout", int),
                "retries": ("max_retries", int),
                "recursive_fallback_depth": ("recursive_fallback_depth", int),
                "recursive_fallback_pages": ("recursive_fallback_pages", int),
                "max_backoff_seconds": ("max_backoff_seconds", float),
                "rate_limit_retries": ("rate_limit_retries", int),
                "rate_limit_base_seconds": ("rate_limit_base_seconds", float),
            },
        )

    embedding_config = admin_config.get("embedding", {})
    if isinstance(embedding_config, dict):
        _merge_value(embeddings_config, "provider", embedding_config.get("provider"))
        _merge_value(embeddings_config, "model", embedding_config.get("model"))
        _merge_numeric_fields(embeddings_config, embedding_config, {
            "batch_size": ("batch_size", int),
        })
        _merge_value(embeddings_config, "normalize_embeddings", embedding_config.get("normalize_embeddings"))

    configured_path = vectordb_config.get("persist_directory", "./data/chromadb")
    chroma_db_path = Path(os.getenv("CHROMA_DB_PATH", configured_path))
    if not chroma_db_path.is_absolute():
        chroma_db_path = PROJECT_ROOT / chroma_db_path

    return AppSettings(
        chroma_db_path=chroma_db_path,
        config=config,
    )


def _maybe_override_number(
    mapping: dict[str, Any],
    key: str,
    raw_value: str | None,
    caster: type[int] | type[float],
) -> None:
    if raw_value is None or not raw_value.strip():
        return

    try:
        mapping[key] = caster(raw_value)
    except ValueError:
        pass


def _merge_numeric_fields(
    target: dict[str, Any],
    source: dict[str, Any],
    mapping: dict[str, tuple[str, type[int] | type[float]]],
) -> None:
    for target_key, (source_key, caster) in mapping.items():
        if source_key not in source:
            continue
        raw_value = source.get(source_key)
        try:
            target[target_key] = caster(raw_value)
        except (TypeError, ValueError):
            continue


def _merge_value(target: dict[str, Any], key: str, value: Any) -> None:
    if value is None:
        return
    target[key] = value

