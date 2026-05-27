from __future__ import annotations

from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.ingestion.parser.parser_manager import ParserManager


def main() -> None:
    paths = get_pipeline_paths(load_settings().chroma_db_path)
    paths.ensure_directories()

    logger = setup_pipeline_logger(
        name="parser_pipeline",
        log_dir=paths.logs_parsing,
        log_filename="parser.log",
    )

    manager = ParserManager(
        raw_dir=paths.raw_dir,
        parsed_dir=paths.parsed_dir,
        logger=logger,
    )
    _, summary = manager.run()

    logger.info("Parser pipeline completed")
    print()
    print(summary.render())


if __name__ == "__main__":
    main()

