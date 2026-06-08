from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from config.constants import DEFAULT_BASE_COLLECTION_NAME
from rag.prompts.prompt_settings import (
    load_prompt_settings,
    normalize_prompt_settings,
    save_prompt_settings,
)
from rag.services.web_ingestion.service import WebsiteIngestionService


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    collection: str = Field(DEFAULT_BASE_COLLECTION_NAME)
    top_k: int = Field(5, ge=1)


class IndexWebsiteRequest(BaseModel):
    url: str = Field(..., min_length=1)
    force: bool = Field(False)


class PromptSettingsRequest(BaseModel):
    role: str = Field("")
    constraints: list[str] = Field(default_factory=list)


app = FastAPI(title="RAG Python Bridge", version="1.0.0")
service = WebsiteIngestionService()


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/query")
async def query_endpoint(payload: QueryRequest) -> dict[str, Any]:
    try:
        result = await service.query(
            payload.question,
            collection_name=payload.collection,
            top_k=payload.top_k,
        )
        return result.to_dict()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Query failed: {error}")


@app.post("/index-website")
async def index_website_endpoint(payload: IndexWebsiteRequest) -> dict[str, Any]:
    try:
        result = await service.index_website(payload.url, force=payload.force)
        return result.to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {error}")


@app.get("/websites")
async def list_websites_endpoint() -> dict[str, Any]:
    try:
        return {"websites": service.list_websites()}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to list websites: {error}")


@app.delete("/websites/{website_id}")
async def delete_website_endpoint(website_id: str) -> dict[str, Any]:
    try:
        return service.delete_website(website_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Delete failed: {error}")


@app.get("/prompt-settings")
async def get_prompt_settings() -> dict[str, Any]:
    try:
        return load_prompt_settings().to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to load prompt settings: {error}")


@app.put("/prompt-settings")
async def update_prompt_settings(payload: PromptSettingsRequest) -> dict[str, Any]:
    try:
        normalized = normalize_prompt_settings(
            role=payload.role,
            constraints=payload.constraints,
        )
        saved = save_prompt_settings(normalized)
        return saved.to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to save prompt settings: {error}")


@app.get("/websites/{website_id}/status")
async def website_status(website_id: str) -> dict[str, Any]:
    try:
        return service.get_indexing_status(website_id)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to get indexing status: {error}")


@app.post("/websites/sync")
async def sync_websites() -> dict[str, Any]:
    try:
        return service.sync_collections()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to sync collections: {error}")
