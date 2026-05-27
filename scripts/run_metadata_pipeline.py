from __future__ import annotations

from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.ingestion.metadata.metadata_generator import MetadataGenerator


def main() -> None:
    paths = get_pipeline_paths(load_settings().chroma_db_path)
    paths.ensure_directories()

    logger = setup_pipeline_logger(
        name="metadata_pipeline",
        log_dir=paths.logs_parsing,
        log_filename="metadata.log",
    )

    generator = MetadataGenerator(
        cleaned_path=paths.cleaned_documents,
        output_dir=paths.metadata_dir,
        logger=logger,
    )
    _, summary = generator.run()

    logger.info("Metadata pipeline completed")
    print()
    print(summary.render())


if __name__ == "__main__":
    main()

