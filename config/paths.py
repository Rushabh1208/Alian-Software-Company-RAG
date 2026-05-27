from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from config.settings import PROJECT_ROOT


@dataclass(frozen=True)
class PipelinePaths:
    """Single source of truth for pipeline artifact and log locations."""

    root: Path

    # Crawl / discovery
    sitemap_dir: Path
    crawl_targets: Path
    raw_dir: Path

    # Parse
    parsed_dir: Path
    parsed_documents: Path

    # Clean
    cleaned_dir: Path
    cleaned_documents: Path
    rejected_documents: Path

    # Metadata
    metadata_dir: Path
    metadata_documents: Path

    # Chunk
    chunks_dir: Path
    chunked_documents: Path
    rejected_chunks: Path

    # Future stages (placeholders; safe to keep even if modules are empty)
    embeddings_dir: Path
    chromadb_dir: Path

    # Logs
    logs_crawl: Path
    logs_parsing: Path
    logs_embeddings: Path
    logs_vectordb: Path

    def ensure_directories(self) -> None:
        for directory in (
            self.sitemap_dir,
            self.raw_dir,
            self.parsed_dir,
            self.cleaned_dir,
            self.metadata_dir,
            self.chunks_dir,
            self.embeddings_dir,
            self.chromadb_dir,
            self.logs_crawl,
            self.logs_parsing,
            self.logs_embeddings,
            self.logs_vectordb,
        ):
            directory.mkdir(parents=True, exist_ok=True)


def get_pipeline_paths(chromadb_dir: Path | None = None) -> PipelinePaths:
    root = PROJECT_ROOT
    data = root / "data"
    logs = root / "logs"

    if chromadb_dir is None:
        chromadb_dir = data / "chromadb"

    return PipelinePaths(
        root=root,
        sitemap_dir=data / "sitemap",
        crawl_targets=data / "sitemap" / "crawl_targets.json",
        raw_dir=data / "raw",
        parsed_dir=data / "parsed",
        parsed_documents=data / "parsed" / "parsed_documents.json",
        cleaned_dir=data / "cleaned",
        cleaned_documents=data / "cleaned" / "cleaned_documents.json",
        rejected_documents=data / "cleaned" / "rejected_documents.json",
        metadata_dir=data / "metadata",
        metadata_documents=data / "metadata" / "metadata_documents.json",
        chunks_dir=data / "chunks",
        chunked_documents=data / "chunks" / "chunked_documents.json",
        rejected_chunks=data / "chunks" / "rejected_chunks.json",
        embeddings_dir=data / "embeddings",
        chromadb_dir=chromadb_dir,
        logs_crawl=logs / "crawl",
        logs_parsing=logs / "parsing",
        logs_embeddings=logs / "embeddings",
        logs_vectordb=logs / "vectordb",
    )

