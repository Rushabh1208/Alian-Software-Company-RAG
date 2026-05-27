from __future__ import annotations

from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.ingestion.vectordb.upsert import ChromaUpserter


def main() -> None:
    settings = load_settings()
    paths = get_pipeline_paths(settings.chroma_db_path)
    paths.ensure_directories()

    vectordb_config = settings.config.get("vectordb", {})
    logger = setup_pipeline_logger(
        name="vectordb_pipeline",
        log_dir=paths.logs_vectordb,
        log_filename="vectordb_pipeline.log",
    )

    upserter = ChromaUpserter(
        embeddings_path=paths.embeddings_dir / "embeddings.json",
        persist_directory=paths.chromadb_dir,
        collection_name=str(vectordb_config.get("collection_name", "rag_documents")),
        logger=logger,
    )
    summary = upserter.run()

    logger.info("Vector DB pipeline completed")
    print()
    print(summary.render())


if __name__ == "__main__":
    main()

