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

### 1. Prepare the Python environment

```powershell
cd c:\Users\as\Desktop\JS\RAG-PROJECT
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m playwright install
Copy-Item .env.example .env
```

### 2. Run the core RAG ingestion pipeline

Show pipeline status:

```powershell
python -m rag.ingestion.main
```

Run the full implemented ingestion pipeline:

```powershell
python -m scripts.run_pipeline
```

Run one stage at a time:

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

Query the local RAG index:

```powershell
python -m scripts.query_rag "What AI services does Alian offer?"
python -m scripts.query_rag "How fast do engagements ship?" --top-k 3 --show-context
```

Run a stage range:

```powershell
python -m scripts.run_pipeline --from parse --to chunk
python -m scripts.run_pipeline --from embed --to vectordb
```

### 3. Web app wrapper (optional)

The `backend/` and `frontend/` folders provide a thin web UI around the Python pipeline.

Start the backend:

```powershell
cd backend
npm install
npm start
```

Start the Python bridge separately in another terminal:

```powershell
cd c:\Users\as\Desktop\JS\RAG-PROJECT
.venv\Scripts\Activate.ps1
uvicorn rag.api.server:app --host 127.0.0.1 --port 8000
```

For long-running index jobs, increase or disable the backend bridge timeout:

```powershell
$env:RAG_PYTHON_API_TIMEOUT_MS = 3600000
$env:RAG_PYTHON_API_TIMEOUT_MS = 0
```

Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

If the backend is not on `http://localhost:5000`, set:

```powershell
VITE_API_BASE_URL=http://localhost:5000
```

## What is the core RAG pipeline?

The core pipeline is Python-only and consists of:

- `config/` — configuration, paths, constants, and environment loading
- `rag/` — the core RAG engine, ingestion stages, utility functions, and API bridge
- `scripts/` — pipeline entrypoints for stage execution and querying
- `data/` — generated website artifacts, embeddings, and ChromaDB data
- `logs/` — runtime logs for crawler, parser, embedding, and vectordb stages
- `pyproject.toml` / `requirements.txt` — Python packaging and dependencies
- `.env.example` / `.env` — runtime environment variables

The core pipeline does not require `backend/` or `frontend/`.

## What is optional or not used by the core pipeline?

The following directories and files are not required to run the core ingestion pipeline:

- `backend/` — optional Express API wrapper for the web app
- `frontend/` — optional React UI for browser access
- `rag/api/bridge.py` — optional CLI-style JSON bridge wrapper, not required when using `uvicorn rag.api.server:app`
- `backend/chroma/chromaService.js` — helper file not imported anywhere in the current backend code
- `backend/utils/paths.js` — helper file not imported anywhere in the current backend code
- `tests/__init__.py` — placeholder test package, no tests are currently implemented
- `docs/` — documentation files only, not part of runtime execution

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

The repository is split into a core Python RAG pipeline and an optional web app wrapper.

```text
config/              YAML settings, paths, constants, environment loading
rag/                 Python RAG library and ingestion stages
  api/               optional FastAPI bridge and CLI bridge wrapper
  engine/            retrieval, reranking, generation, confidence, query orchestration
  ingestion/         crawler, parser, cleaner, metadata, chunking, embeddings, vectordb pipeline
  models/            query and metric dataclasses
  prompts/           prompt construction and response templates
  utils/             text utilities, website utilities, and helpers
scripts/             executable Python stage runners and query CLI
backend/             optional Express API wrapper for the web frontend
frontend/            optional React UI and browser application
data/                generated artifacts, embeddings, and ChromaDB persistence
logs/                runtime logs for crawls, parsing, embeddings, and vectordb
docs/                project notes and design documentation
tests/               placeholder test package (no tests implemented yet)
```

### Files and folders not required by the core pipeline

- `backend/chroma/chromaService.js` — not imported by the backend or current pipeline
- `backend/utils/paths.js` — not imported by the backend or current pipeline
- `rag/api/bridge.py` — optional CLI bridge wrapper, not needed when using `uvicorn rag.api.server:app`
- `backend/` — optional web API wrapper
- `frontend/` — optional browser UI
- `docs/` — documentation only
- `tests/` — placeholder test package only

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

Before using `POST /api/index-website`, start the Python bridge in a separate terminal:

```powershell
cd c:\Users\as\Desktop\JS\RAG-PROJECT
.venv\Scripts\Activate.ps1
uvicorn rag.api.server:app --host 127.0.0.1 --port 8000
```

If the bridge runs on a different host or port, set `RAG_PYTHON_API_URL` for the backend.

For long-running website indexing, increase the Python bridge request timeout in the backend environment:

```powershell
$env:RAG_PYTHON_API_TIMEOUT_MS = 3600000
```

Set `RAG_PYTHON_API_TIMEOUT_MS=0` to disable the timeout entirely.

Available routes:

- `POST /api/query`
- `POST /api/index-website`
- `GET /api/websites`
- `DELETE /api/websites/:id`

The frontend uses normal query requests and persists chat history in browser local storage.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` if the backend is not running on `http://localhost:5000`.

### Website Collections

- `alian_software` is the base collection used internally by the RAG backend.
- `website_<domain>` is used for each indexed site, for example `website_openai_com`.
- The Python bridge keeps query-time retrieval, reranking, confidence scoring, and metadata handling inside the existing RAG modules.

### Public Widget

The repository now includes a script-based public widget that does not touch the admin frontend.

Backend widget routes:

- `POST /api/widgets`
- `GET /api/widgets/:id`
- `PUT /api/widgets/:id`
- `POST /api/widget/chat`

Widget script server:

```powershell
cd widget\widget-app
npm start
```

The embeddable script is served from `http://localhost:3001/widget.js` in local development. Embed that script on any website to load the matching widget configuration automatically.

## License

Add your preferred license before publishing the repository publicly.
