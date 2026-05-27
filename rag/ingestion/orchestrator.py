from __future__ import annotations

import subprocess
import sys
from collections.abc import Iterable

from rag.ingestion.pipeline import (
    STAGE_ORDER,
    STAGES_BY_ID,
    PipelineStage,
    StageId,
    dependencies_met,
    resolve_stage_range,
)
from config.paths import get_pipeline_paths
from config.settings import load_settings


class PipelineOrchestrator:
    def __init__(self, stages: Iterable[PipelineStage] | None = None) -> None:
        self.stages = list(stages) if stages is not None else resolve_stage_range()

    def run(self) -> list[StageId]:
        paths = get_pipeline_paths(load_settings().chroma_db_path)
        paths.ensure_directories()

        completed: set[StageId] = set()
        if self.stages:
            first_stage_index = STAGE_ORDER.index(self.stages[0].stage_id)
            completed.update(STAGE_ORDER[:first_stage_index])

        executed: list[StageId] = []

        for stage in self.stages:
            if not stage.implemented:
                raise RuntimeError(
                    f"Stage '{stage.stage_id.value}' is not implemented yet "
                    f"({stage.script.name}). Run only implemented stages."
                )
            if not dependencies_met(stage.stage_id, completed):
                missing = [
                    required.value
                    for required in stage.requires
                    if required not in completed
                ]
                raise RuntimeError(
                    f"Cannot run '{stage.stage_id.value}'; missing prior stages: {', '.join(missing)}"
                )

            print(f"\n=== {stage.title} ({stage.stage_id.value}) ===")
            module = f"scripts.{stage.script.stem}"
            subprocess.run(
                [sys.executable, "-m", module],
                cwd=str(paths.root),
                check=True,
            )
            completed.add(stage.stage_id)
            executed.append(stage.stage_id)

        return executed


def run_ingestion_pipeline(
    *,
    from_stage: StageId | None = None,
    to_stage: StageId | None = None,
    only: StageId | None = None,
) -> list[StageId]:
    stages = resolve_stage_range(
        from_stage=from_stage,
        to_stage=to_stage,
        only=only,
        include_unimplemented=False,
    )
    return PipelineOrchestrator(stages).run()


def list_stages() -> str:
    lines = ["Ingestion pipeline stages (in order):"]
    for index, stage_id in enumerate(STAGE_ORDER, start=1):
        stage = STAGES_BY_ID[stage_id]
        status = "ready" if stage.implemented else "planned"
        requires = ", ".join(req.value for req in stage.requires) or "none"
        output = stage.primary_output or "n/a"
        lines.append(
            f"  {index}. {stage.stage_id.value} [{status}]"
            f" -> {stage.script.name}"
            f" | requires: {requires}"
            f" | output: {output}"
        )
    return "\n".join(lines)

