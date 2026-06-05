from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import os

import yaml
from dotenv import load_dotenv


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
    vectordb_config = config.get("vectordb", {})
    streaming_config = config.setdefault("streaming_ingestion", {})

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

