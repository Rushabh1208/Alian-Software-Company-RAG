from __future__ import annotations

from rag.ingestion.chunking.chunk_manager import ChunkManager
from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings


def main() -> None:
    settings = load_settings()
    paths = get_pipeline_paths(settings.chroma_db_path)
    paths.ensure_directories()
    chunking_config = settings.config.get("chunking", {})

    logger = setup_pipeline_logger(
        name="chunking_pipeline",
        log_dir=paths.logs_parsing,
        log_filename="chunking.log",
    )

    manager = ChunkManager(
        metadata_path=paths.metadata_documents,
        output_dir=paths.chunks_dir,
        chunk_size=int(chunking_config.get("chunk_size", 500)),
        overlap=int(chunking_config.get("overlap", 100)),
        collection_name=str(settings.config.get("vectordb", {}).get("collection_name", "rag_documents")),
        logger=logger,
    )
    _, _, summary = manager.run()

    logger.info("Chunking pipeline completed")
    print()
    print(summary.render())


if __name__ == "__main__":
    main()

