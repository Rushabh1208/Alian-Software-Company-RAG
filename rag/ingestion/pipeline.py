from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from config.paths import PipelinePaths, get_pipeline_paths


class StageId(str, Enum):
    SITEMAP = "sitemap"
    CRAWL = "crawl"
    PARSE = "parse"
    CLEAN = "clean"
    METADATA = "metadata"
    CHUNK = "chunk"
    EMBED = "embed"
    VECTORDB = "vectordb"


@dataclass(frozen=True)
class PipelineStage:
    """One ingestion stage. Scripts are the supported entrypoints."""

    stage_id: StageId
    title: str
    script: Path
    requires: tuple[StageId, ...]
    primary_output: Path | None
    implemented: bool = True


def _build_stages(paths: PipelinePaths) -> tuple[PipelineStage, ...]:
    scripts = paths.root / "scripts"
    return (
        PipelineStage(
            stage_id=StageId.SITEMAP,
            title="Sitemap discovery",
            script=scripts / "run_sitemap_pipeline.py",
            requires=(),
            primary_output=paths.crawl_targets,
        ),
        PipelineStage(
            stage_id=StageId.CRAWL,
            title="Web crawl",
            script=scripts / "run_crawler.py",
            requires=(StageId.SITEMAP,),
            primary_output=paths.raw_dir,
        ),
        PipelineStage(
            stage_id=StageId.PARSE,
            title="HTML parsing",
            script=scripts / "run_parser.py",
            requires=(StageId.CRAWL,),
            primary_output=paths.parsed_documents,
        ),
        PipelineStage(
            stage_id=StageId.CLEAN,
            title="Content cleaning",
            script=scripts / "run_cleaner.py",
            requires=(StageId.PARSE,),
            primary_output=paths.cleaned_documents,
        ),
        PipelineStage(
            stage_id=StageId.METADATA,
            title="Metadata generation",
            script=scripts / "run_metadata_pipeline.py",
            requires=(StageId.CLEAN,),
            primary_output=paths.metadata_documents,
        ),
        PipelineStage(
            stage_id=StageId.CHUNK,
            title="Document chunking",
            script=scripts / "run_chunking_pipeline.py",
            requires=(StageId.METADATA,),
            primary_output=paths.chunked_documents,
        ),
        PipelineStage(
            stage_id=StageId.EMBED,
            title="Embedding generation",
            script=scripts / "run_embedding_pipeline.py",
            requires=(StageId.CHUNK,),
            primary_output=paths.embeddings_dir / "embeddings.json",
        ),
        PipelineStage(
            stage_id=StageId.VECTORDB,
            title="Vector database upsert",
            script=scripts / "run_vectordb_pipeline.py",
            requires=(StageId.EMBED,),
            primary_output=paths.chromadb_dir,
        ),
    )


PIPELINE_STAGES: tuple[PipelineStage, ...] = _build_stages(get_pipeline_paths())
STAGE_ORDER: tuple[StageId, ...] = tuple(stage.stage_id for stage in PIPELINE_STAGES)
STAGES_BY_ID: dict[StageId, PipelineStage] = {
    stage.stage_id: stage for stage in PIPELINE_STAGES
}


def dependencies_met(stage_id: StageId, completed: set[StageId]) -> bool:
    stage = STAGES_BY_ID[stage_id]
    return all(required in completed for required in stage.requires)


def resolve_stage_range(
    *,
    from_stage: StageId | None = None,
    to_stage: StageId | None = None,
    only: StageId | None = None,
    include_unimplemented: bool = False,
) -> list[PipelineStage]:
    if only is not None:
        selected = [STAGES_BY_ID[only]]
    else:
        start = STAGE_ORDER.index(from_stage) if from_stage else 0
        end = STAGE_ORDER.index(to_stage) if to_stage else len(STAGE_ORDER) - 1
        if start > end:
            raise ValueError(f"from_stage ({from_stage}) must come before to_stage ({to_stage})")
        selected = [
            STAGES_BY_ID[stage_id] for stage_id in STAGE_ORDER[start : end + 1]
        ]

    if include_unimplemented:
        return selected

    return [stage for stage in selected if stage.implemented]

