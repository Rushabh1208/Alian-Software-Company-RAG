# Website RAG Ingestion Pipeline

Lightweight Python RAG for the website:

```text
https://aliansoftware.com/en
```

This project crawls the site, parses and cleans pages, generates chunks and local embeddings, stores them in ChromaDB, and answers questions with deterministic retrieval, cross-encoder reranking, confidence gating, and Gemini-based final generation.

## Overview

The system is designed to stay small, local, and production-friendly:

- Local HuggingFace embeddings
- JSON-based embedding storage
- Cross-encoder reranking
- Confidence scoring and rejection logic
- Gemini 2.5 Flash for final response generation only
- CLI querying with metrics and source display

## Architecture Flow

1. Crawl the website from sitemap and public pages.
2. Parse and clean HTML content.
3. Generate metadata and chunk the content.
4. Create local embeddings and persist them to `data/embeddings/embeddings.json`.
5. Retrieve top chunks for a query using embedding similarity.
6. Rerank retrieved chunks with a cross encoder.
7. Validate confidence and grounding.
8. Generate the final answer with Gemini or fallback extraction.
9. Print answer, confidence, sources, and efficiency metrics.

## Setup

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install
```

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

## Environment Variables

```text
CHROMA_DB_PATH=./data/chromadb
GOOGLE_API_KEY=your_google_api_key
```

- `CHROMA_DB_PATH` overrides the local ChromaDB persistence directory.
- `GOOGLE_API_KEY` enables Gemini 2.5 Flash for final answer generation.

## Usage

Show pipeline status:

```powershell
python -m rag.ingestion.main
```

Run the ingestion pipeline:

```powershell
python -m scripts.run_pipeline
```

Run one stage:

```powershell
python -m scripts.run_sitemap_pipeline
python -m scripts.run_crawler
python -m scripts.run_parser
python -m scripts.run_cleaner
python -m scripts.run_metadata_pipeline
python -m scripts.run_chunking_pipeline
python -m scripts.run_embedding_pipeline
python -m scripts.run_vectordb_pipeline
```

Query the RAG system:

```powershell
python -m scripts.query_rag "What AI services does Alian offer?"
python -m scripts.query_rag "How fast do engagements ship?" --top-k 3 --show-context
```

Run a stage range:

```powershell
python -m scripts.run_pipeline --from parse --to chunk
python -m scripts.run_pipeline --from embed --to vectordb
```

## Query Output

The query CLI prints:

- `QUESTION`
- `ANSWER`
- `CONFIDENCE SCORE`
- `LEVEL`
- confidence factor weights
- latency metrics
- token metrics
- throughput
- retrieved chunks and scores

## Metrics

The query output includes:

- `embedding_latency_ms`
- `retrieval_latency_ms`
- `rerank_latency_ms`
- `generation_latency_ms`
- `total_latency_ms`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `throughput_tokens_per_sec`
- `retrieved_chunks`
- `accepted_chunks`
- `avg_semantic_score`
- `avg_rerank_score`

Confidence is grouped as:

- `low`
- `med`
- `high`

The factor breakdown currently weights:

- semantic score
- rerank score
- top chunk score

## Folder Structure

```text
config/              YAML settings, paths, constants, logging
rag/
  engine/            retrieval, reranking, generation, confidence, orchestration
  models/            query and metrics dataclasses
  ingestion/         crawl, parse, clean, metadata, chunk, embed, vectordb, pipeline
  prompts/           Gemini prompt and answer helpers
  utils/             text, similarity, token, and metric utilities
scripts/             CLI entrypoints
data/                generated artifacts
logs/                runtime logs
```

## Current Design Notes

- The public import path remains `rag.query_engine.RagQueryEngine`.
- Retrieval and reranking stay lightweight and local.
- Gemini is only used after retrieval passes validation.
- Unsupported questions are rejected with:

```text
I don't know from the indexed website content.
```

## Future Improvements

- Add a JSON output mode for the query CLI.
- Add offline evaluation scripts for confidence threshold tuning.
- Add small test fixtures for retrieval and generation regression checks.
- Add structured logging for pipeline stages and query metrics.

## Web App

The repository now includes a thin Express API and a React frontend that reuse the existing Python RAG pipeline.

### Backend

```powershell
cd backend
npm install
npm start
```

Available routes:

- `POST /api/query`
- `POST /api/index-website`
- `GET /api/websites`
- `DELETE /api/websites/:id`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` if the backend is not running on `http://localhost:5000`.

### Website Collections

- `alian_software` is the default company collection.
- `website_<domain>` is used for each indexed site, for example `website_openai_com`.
- The Python bridge keeps query-time retrieval, reranking, confidence scoring, and metadata handling inside the existing RAG modules.

## License

Add your preferred license before publishing the repository publicly.
