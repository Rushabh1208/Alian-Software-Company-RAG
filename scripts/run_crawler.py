from __future__ import annotations

import asyncio

from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.ingestion.crawler.crawl_manager import CrawlManager


async def run() -> None:
    settings = load_settings()
    paths = get_pipeline_paths(settings.chroma_db_path)
    paths.ensure_directories()
    crawler_config = settings.config.get("crawler", {})

    logger = setup_pipeline_logger(
        name="crawl_pipeline",
        log_dir=paths.logs_crawl,
        log_filename="crawler.log",
    )

    manager = CrawlManager(
        targets_path=paths.crawl_targets,
        raw_dir=paths.raw_dir,
        timeout=int(crawler_config.get("timeout", 30)),
        retries=int(crawler_config.get("retries", 3)),
        rate_limit=int(crawler_config.get("rate_limit", 2)),
        logger=logger,
    )
    _, summary = await manager.run()

    logger.info("Crawl pipeline completed")
    print()
    print(summary.render())


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()

