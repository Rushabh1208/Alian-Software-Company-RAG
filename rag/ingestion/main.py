from __future__ import annotations

from rag.ingestion.orchestrator import list_stages
from config.constants import DEFAULT_TARGET_WEBSITE
from config.settings import load_settings


def main() -> None:
    settings = load_settings()
    collection = settings.config["vectordb"]["collection_name"]

    print("Website RAG Ingestion Pipeline")
    print(f"Target website: {DEFAULT_TARGET_WEBSITE}")
    print(f"Vector collection: {collection}")
    print(f"ChromaDB path: {settings.chroma_db_path}")
    print()
    print(list_stages())
    print()
    print("Run implemented stages: python -m scripts.run_pipeline")
    print("Run one stage:          python -m scripts.run_embedding_pipeline")


if __name__ == "__main__":
    main()

