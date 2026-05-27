from __future__ import annotations

from config.constants import DEFAULT_TARGET_WEBSITE
from config.logging_setup import setup_pipeline_logger
from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.ingestion.crawler.sitemap import SitemapProcessor


def main() -> None:
    settings = load_settings()
    paths = get_pipeline_paths(settings.chroma_db_path)
    paths.ensure_directories()
    crawler_config = settings.config.get("crawler", {})

    logger = setup_pipeline_logger(
        name="sitemap_pipeline",
        log_dir=paths.logs_crawl,
        log_filename="sitemap_pipeline.log",
    )

    processor = SitemapProcessor(
        target_url=DEFAULT_TARGET_WEBSITE,
        output_dir=paths.sitemap_dir,
        timeout=int(crawler_config.get("timeout", 30)),
        logger=logger,
    )
    result = processor.run()

    logger.info("Sitemap pipeline completed")
    print()
    print(result.summary.render())


if __name__ == "__main__":
    main()

