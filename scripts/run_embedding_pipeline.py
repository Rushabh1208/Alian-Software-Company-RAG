from __future__ import annotations

import asyncio

from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.ingestion.embeddings.embedding_manager import EmbeddingManager


async def async_main() -> None:
    settings = load_settings()
    paths = get_pipeline_paths(settings.chroma_db_path)
    paths.ensure_directories()

    embedding_config = settings.config.get("embeddings", {})
    logger = setup_pipeline_logger(
        name="embedding_pipeline",
        log_dir=paths.logs_embeddings,
        log_filename="embedding_pipeline.log",
    )

    manager = EmbeddingManager(
        chunks_path=paths.chunked_documents,
        output_dir=paths.embeddings_dir,
        model_name=str(embedding_config.get("model", "BAAI/bge-small-en-v1.5")),
        batch_size=int(embedding_config.get("batch_size", 32)),
        normalize_embeddings=bool(embedding_config.get("normalize_embeddings", True)),
        logger=logger,
    )
    _, _, summary = await manager.run()

    logger.info("Embedding pipeline completed")
    print()
    print(summary.render())


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()

