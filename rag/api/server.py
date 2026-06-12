from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

from rag.prompts.prompt_settings import (
    load_prompt_settings_for_user,
    normalize_prompt_settings,
    reset_prompt_settings_for_user,
    save_prompt_settings_for_user,
)
from rag.services.web_ingestion.service import WebsiteIngestionService


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    collection: str = Field("")
    top_k: int = Field(5, ge=1)


class IndexWebsiteRequest(BaseModel):
    url: str = Field(..., min_length=1)
    force: bool = Field(False)


class PromptSettingsRequest(BaseModel):
    role: str = Field("")
    constraints: list[str] = Field(default_factory=list)


app = FastAPI(title="RAG Python Bridge", version="1.0.0")
service = WebsiteIngestionService()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


# ---------------------------------------------------------------------------
# Query / indexing
# ---------------------------------------------------------------------------

@app.post("/query")
async def query_endpoint(payload: QueryRequest, x_user_id: str | None = Header(default=None)):
    if not str(payload.collection or "").strip():
        raise HTTPException(status_code=400, detail="Collection is required.")
    try:
        result = await service.query(
            payload.question,
            collection_name=payload.collection,
            top_k=payload.top_k,
            user_id=x_user_id,
        )
        return result.to_dict()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Query failed: {error}")


@app.post("/index-website")
async def index_website_endpoint(
    payload: IndexWebsiteRequest,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    Index a website for a specific user.

    When x_user_id is provided the Python layer generates a user-scoped
    collection name (website_<slug>_u_<sanitised_user_id>) so that each user
    gets a completely isolated ChromaDB collection and data directory.

    Multiple users can index the same URL without any conflict — they each
    receive their own independent collection.
    """
    try:
        result = await service.index_website(
            payload.url,
            force=payload.force,
            user_id=x_user_id,
        )
        return result.to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {error}")


@app.get("/websites")
async def list_websites_endpoint(
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    List websites.  When x_user_id is supplied, only that user's websites are
    returned.  Without it (admin calls) all websites are returned.
    """
    try:
        return {"websites": service.list_websites(user_id=x_user_id)}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to list websites: {error}")


@app.delete("/websites/{website_id}")
async def delete_website_endpoint(
    website_id: str,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    try:
        return service.delete_website(website_id, user_id=x_user_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Delete failed: {error}")


@app.get("/websites/{website_id}/status")
async def website_status(
    website_id: str,
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
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


# ---------------------------------------------------------------------------
# Prompt settings — user-scoped, per-collection
#
# The Node layer passes x-user-id (the authenticated user's id) in every
# request.  When present, settings are stored under:
#   data/prompt_settings_users/<user_id>/<collection>.json
#
# When absent (e.g. admin tooling, legacy calls), the global per-collection
# fallback is used instead.
# ---------------------------------------------------------------------------

@app.get("/prompt-settings")
async def get_prompt_settings(
    collection: str = "",
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    if not str(collection or "").strip():
        raise HTTPException(status_code=400, detail="Collection is required.")
    try:
        return load_prompt_settings_for_user(x_user_id, collection).to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to load prompt settings: {error}")


@app.put("/prompt-settings")
async def update_prompt_settings(
    payload: PromptSettingsRequest,
    collection: str = "",
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    if not str(collection or "").strip():
        raise HTTPException(status_code=400, detail="Collection is required.")
    try:
        normalized = normalize_prompt_settings(
            role=payload.role,
            constraints=payload.constraints,
        )
        saved = save_prompt_settings_for_user(
            normalized,
            user_id=x_user_id,
            collection=collection,
        )
        return saved.to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to save prompt settings: {error}")


@app.delete("/prompt-settings")
async def reset_prompt_settings_endpoint(
    collection: str = "",
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    """Delete user-specific override and return the effective settings."""
    if not str(collection or "").strip():
        raise HTTPException(status_code=400, detail="Collection is required.")
    try:
        effective = reset_prompt_settings_for_user(
            user_id=x_user_id,
            collection=collection,
        )
        return effective.to_dict()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to reset prompt settings: {error}")
