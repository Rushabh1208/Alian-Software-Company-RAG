from __future__ import annotations

from rag.ingestion.cleaner.cleaning_manager import CleaningManager
from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings


def main() -> None:
    paths = get_pipeline_paths(load_settings().chroma_db_path)
    paths.ensure_directories()

    logger = setup_pipeline_logger(
        name="cleaning_pipeline",
        log_dir=paths.logs_parsing,
        log_filename="cleaner.log",
    )

    manager = CleaningManager(
        parsed_dir=paths.parsed_dir,
        cleaned_dir=paths.cleaned_dir,
        logger=logger,
    )
    _, _, summary = manager.run()

    logger.info("Cleaning pipeline completed")
    print()
    print(summary.render())


if __name__ == "__main__":
    main()

