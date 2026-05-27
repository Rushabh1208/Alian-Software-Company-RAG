from __future__ import annotations

import argparse

from rag.ingestion.orchestrator import list_stages, run_ingestion_pipeline
from rag.ingestion.pipeline import STAGE_ORDER, StageId


def _parse_stage(value: str) -> StageId:
    try:
        return StageId(value)
    except ValueError as exc:
        valid = ", ".join(stage.value for stage in STAGE_ORDER)
        raise argparse.ArgumentTypeError(
            f"Unknown stage '{value}'. Valid stages: {valid}"
        ) from exc


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the website RAG ingestion pipeline (implemented stages only).",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all pipeline stages and exit.",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--from",
        dest="from_stage",
        type=_parse_stage,
        metavar="STAGE",
        help="First stage to run (inclusive).",
    )
    group.add_argument(
        "--only",
        dest="only_stage",
        type=_parse_stage,
        metavar="STAGE",
        help="Run a single stage (dependencies must already be satisfied on disk).",
    )
    parser.add_argument(
        "--to",
        dest="to_stage",
        type=_parse_stage,
        metavar="STAGE",
        help="Last stage to run (inclusive). Defaults to the last implemented stage.",
    )
    args = parser.parse_args()

    if args.list:
        print(list_stages())
        return

    executed = run_ingestion_pipeline(
        from_stage=args.from_stage,
        to_stage=args.to_stage,
        only=args.only_stage,
    )
    print("\nCompleted stages:", ", ".join(stage.value for stage in executed))


if __name__ == "__main__":
    main()

