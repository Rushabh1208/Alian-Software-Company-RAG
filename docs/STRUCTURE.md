# Project structure and safe maintenance

This repository is organized around a small, production-friendly RAG stack plus a separate ingestion pipeline under `rag/ingestion/`.

## Core layout

```text
rag/
  engine/      query retrieval, reranking, confidence, and generation
  models/      query results, metrics, and shared ingestion schemas
  prompts/     Gemini prompt and fallback answer helpers
  utils/       text, similarity, token, and metric utilities
  ingestion/   sitemap, crawl, parse, clean, metadata, chunking, embeddings, vectordb, pipeline
scripts/       thin CLI entrypoints
config/        settings, paths, constants, and logging
data/          generated artifacts
logs/          runtime logs
tests/         regression tests
```

## Pipeline order

| Order | Stage ID   | Script                    | Package                | Primary output                         |
|------:|------------|---------------------------|------------------------|----------------------------------------|
| 1     | `sitemap`  | `run_sitemap_pipeline.py` | `rag/ingestion/crawler` | `data/sitemap/crawl_targets.json`      |
| 2     | `crawl`    | `run_crawler.py`         | `rag/ingestion/crawler` | `data/raw/`                            |
| 3     | `parse`    | `run_parser.py`          | `rag/ingestion/parser`  | `data/parsed/parsed_documents.json`    |
| 4     | `clean`    | `run_cleaner.py`         | `rag/ingestion/cleaner` | `data/cleaned/cleaned_documents.json`  |
| 5     | `metadata` | `run_metadata_pipeline.py` | `rag/ingestion/metadata` | `data/metadata/metadata_documents.json` |
| 6     | `chunk`    | `run_chunking_pipeline.py` | `rag/ingestion/chunking` | `data/chunks/chunked_documents.json`   |
| 7     | `embed`    | `run_embedding_pipeline.py` | `rag/ingestion/embeddings` | `data/embeddings/embeddings.json`  |
| 8     | `vectordb` | `run_vectordb_pipeline.py` | `rag/ingestion/vectordb` | `data/chromadb/`                      |

## Safe cleanup rules

- Regenerated artifacts under `data/` and `logs/` can be removed and rebuilt by rerunning the corresponding stage.
- Source packages under `rag/`, `scripts/`, and `config/` should stay under version control.
- Before removing a module, search for imports with:

```powershell
rg "from rag\.ingestion|from rag\.engine|from rag\.models|from rag\.utils" --glob "*.py"
```

## Maintenance notes

- Keep the query-time path stable: `rag.query_engine.RagQueryEngine`.
- Keep CLI entrypoints in `scripts/` thin and import logic from package modules.
- Prefer updating shared behavior in `rag/engine/` and `rag/ingestion/` instead of duplicating logic in scripts.
