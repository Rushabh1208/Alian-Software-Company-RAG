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

    configured_path = vectordb_config.get("persist_directory", "./data/chromadb")
    chroma_db_path = Path(os.getenv("CHROMA_DB_PATH", configured_path))
    if not chroma_db_path.is_absolute():
        chroma_db_path = PROJECT_ROOT / chroma_db_path

    return AppSettings(
        chroma_db_path=chroma_db_path,
        config=config,
    )

