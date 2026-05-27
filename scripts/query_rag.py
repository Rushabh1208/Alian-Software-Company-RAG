from __future__ import annotations

import argparse
import asyncio
import os
import sys

os.environ.setdefault(
    "HF_HUB_DISABLE_PROGRESS_BARS",
    "1",
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8",
        errors="replace",
    )

from config.paths import get_pipeline_paths
from config.settings import load_settings
from rag.query_engine import RagQueryEngine


def print_separator() -> None:
    print("=" * 80)


async def async_main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "Ask questions against your local semantic RAG pipeline."
        )
    )

    parser.add_argument(
        "question",
        help="Question to ask the RAG system.",
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of retrieved chunks.",
    )

    parser.add_argument(
        "--show-context",
        action="store_true",
        help="Show retrieved chunk content.",
    )

    args = parser.parse_args()

    settings = load_settings()

    paths = get_pipeline_paths(
        settings.chroma_db_path
    )

    embedding_config = settings.config.get(
        "embeddings",
        {},
    )

    vectordb_config = settings.config.get(
        "vectordb",
        {},
    )

    engine = RagQueryEngine(
        persist_directory=paths.chromadb_dir,
        collection_name=str(
            vectordb_config.get(
                "collection_name",
                "rag_documents",
            )
        ),
        model_name=str(
            embedding_config.get(
                "model",
                "BAAI/bge-small-en-v1.5",
            )
        ),
        normalize_embeddings=bool(
            embedding_config.get(
                "normalize_embeddings",
                True,
            )
        ),
        model_cache_dir=(
            paths.embeddings_dir / "model_cache"
        ),
        embeddings_path=(
            paths.embeddings_dir / "embeddings.json"
        ),
    )

    result = await engine.ask(
        args.question,
        top_k=max(args.top_k, 1),
    )

    print_separator()

    print("QUESTION:\n")
    print(result.question)

    print_separator()

    print("ANSWER:\n")
    print(result.answer)

    print_separator()

    print("CONFIDENCE SCORE:\n")

    print(f"{result.confidence:.2f}")

    print(f"LEVEL: {result.confidence_label}")

    if result.confidence_factors:

        print("FACTOR WEIGHTS (%):")

        print(
            f"semantic={result.confidence_factors.get('semantic', 0.0):.1f} | "
            f"rerank={result.confidence_factors.get('rerank', 0.0):.1f} | "
            f"top_score={result.confidence_factors.get('top_score', 0.0):.1f}"
        )

    print_separator()

    metrics = result.metrics or {}

    print("EFFICIENCY METRICS:\n")

    print(
        f"embedding_latency_ms="
        f"{metrics.get('embedding_latency_ms', 0.0):.2f}"
    )

    print(
        f"retrieval_latency_ms="
        f"{metrics.get('retrieval_latency_ms', 0.0):.2f}"
    )

    print(
        f"rerank_latency_ms="
        f"{metrics.get('rerank_latency_ms', 0.0):.2f}"
    )

    print(
        f"generation_latency_ms="
        f"{metrics.get('generation_latency_ms', 0.0):.2f}"
    )

    print(
        f"total_latency_ms="
        f"{metrics.get('total_latency_ms', 0.0):.2f}"
    )

    print()

    print(
        f"input_tokens="
        f"{int(metrics.get('input_tokens', 0))}"
    )

    print(
        f"output_tokens="
        f"{int(metrics.get('output_tokens', 0))}"
    )

    print(
        f"total_tokens="
        f"{int(metrics.get('total_tokens', 0))}"
    )

    print()

    print(
        f"throughput_tokens_per_sec="
        f"{metrics.get('throughput_tokens_per_sec', 0.0):.2f}"
    )

    print()

    print(
        f"retrieved_chunks="
        f"{int(metrics.get('retrieved_chunks', 0))}"
    )

    print(
        f"accepted_chunks="
        f"{int(metrics.get('accepted_chunks', 0))}"
    )

    print()

    print(
        f"avg_semantic_score="
        f"{metrics.get('avg_semantic_score', 0.0):.4f}"
    )

    print(
        f"avg_rerank_score="
        f"{metrics.get('avg_rerank_score', 0.0):.4f}"
    )

    print_separator()

    if not result.chunks:

        print("NO SOURCES RETRIEVED")

        print_separator()

        return

    print("RETRIEVED SOURCES:\n")

    for index, chunk in enumerate(
        result.chunks,
        start=1,
    ):

        title = chunk.title or "Untitled"

        heading = chunk.heading or "No Heading"

        print(
            f"{index}. "
            f"{title} | "
            f"{heading}"
        )

        print(
            f"semantic_score="
            f"{chunk.semantic_score:.4f} | "
            f"rerank_score="
            f"{chunk.rerank_score:.4f}"
        )

        if chunk.source_url:
            print(chunk.source_url)

        if args.show_context:

            context = chunk.document.strip()

            if len(context) > 1000:
                context = context[:1000] + "..."

            print("\nCONTEXT:")
            print(context)

        print()

    print_separator()


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
