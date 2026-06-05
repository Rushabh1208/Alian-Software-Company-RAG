from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from config.settings import PROJECT_ROOT


@dataclass(frozen=True)
class PipelinePaths:
    """Single source of truth for pipeline artifact and log locations."""

    root: Path
    workspace_dir: Path

    # Crawl / discovery
    websites_dir: Path
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
    checkpoint: Path

    # Future stages (placeholders; safe to keep even if modules are empty)
    embeddings_dir: Path
    chromadb_dir: Path

    # Logs
    logs_crawl: Path
    logs_parsing: Path
    logs_embeddings: Path
    logs_vectordb: Path
    website_registry: Path

    def ensure_directories(self) -> None:
        for directory in (
            self.websites_dir,
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
        self.website_registry.parent.mkdir(parents=True, exist_ok=True)


def get_pipeline_paths(
    chromadb_dir: Path | None = None,
    *,
    workspace_name: str | None = None,
) -> PipelinePaths:
    root = PROJECT_ROOT
    data = root / "data"
    logs = root / "logs"
    websites_dir = data / "websites"

    if workspace_name:
        workspace_dir = websites_dir / workspace_name
        logs_root = logs / "websites" / workspace_name
    else:
        workspace_dir = data
        logs_root = logs

    if chromadb_dir is None:
        chromadb_dir = data / "chromadb"

    return PipelinePaths(
        root=root,
        workspace_dir=workspace_dir,
        websites_dir=websites_dir,
        sitemap_dir=workspace_dir / "sitemap",
        crawl_targets=workspace_dir / "sitemap" / "crawl_targets.json",
        raw_dir=workspace_dir / "raw",
        parsed_dir=workspace_dir / "parsed",
        parsed_documents=workspace_dir / "parsed" / "parsed_documents.json",
        cleaned_dir=workspace_dir / "cleaned",
        cleaned_documents=workspace_dir / "cleaned" / "cleaned_documents.json",
        rejected_documents=workspace_dir / "cleaned" / "rejected_documents.json",
        metadata_dir=workspace_dir / "metadata",
        metadata_documents=workspace_dir / "metadata" / "metadata_documents.json",
        chunks_dir=workspace_dir / "chunks",
        chunked_documents=workspace_dir / "chunks" / "chunked_documents.json",
        rejected_chunks=workspace_dir / "chunks" / "rejected_chunks.json",
        embeddings_dir=workspace_dir / "embeddings",
        chromadb_dir=chromadb_dir,
        checkpoint=workspace_dir / "ingestion_checkpoint.json",
        logs_crawl=logs_root / "crawl",
        logs_parsing=logs_root / "parsing",
        logs_embeddings=logs_root / "embeddings",
        logs_vectordb=logs_root / "vectordb",
        website_registry=websites_dir / "websites.json",
    )

