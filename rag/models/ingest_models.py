from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class SitemapRecord(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: HttpUrl
    source: str = "discovered"


class ExtractedUrl(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: HttpUrl
    canonical_url: str
    last_modified: str = ""
    priority: float = Field(default=0.5, ge=0.0, le=1.0)
    source_sitemap: HttpUrl

    @field_validator("last_modified", mode="before")
    @classmethod
    def default_last_modified(cls, value: object) -> str:
        return "" if value is None else str(value)


class CrawlTarget(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: HttpUrl
    canonical_url: str
    last_modified: str = ""
    priority: float = Field(default=0.5, ge=0.0, le=1.0)
    status: Literal["pending"] = "pending"
    source_sitemap: HttpUrl

    @classmethod
    def from_extracted_url(cls, extracted_url: ExtractedUrl) -> "CrawlTarget":
        return cls(
            url=extracted_url.url,
            canonical_url=extracted_url.canonical_url,
            last_modified=extracted_url.last_modified,
            priority=extracted_url.priority,
            source_sitemap=extracted_url.source_sitemap,
        )


class CleanedDocumentModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    document_id: str = ""
    url: HttpUrl
    title: str = ""
    content: str = ""
    cleaned_content: str = Field(min_length=1)
    language: str = "en"


class MetadataDocument(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    document_id: str
    source_url: HttpUrl
    canonical_url: str
    title: str
    section_heading: str = ""
    category: str
    language: str = "en"
    source_type: str = "website"
    crawl_timestamp: str
    content_hash: str
    content: str


class ChunkMetadata(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source_url: str
    title: str
    category: str
    heading: str = ""


class ChunkDocument(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    chunk_id: str
    document_id: str
    content: str = Field(min_length=1)
    token_count: int = Field(ge=1)
    metadata: ChunkMetadata


class RejectedChunk(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    document_id: str
    source_url: str
    content: str = ""
    token_count: int = 0
    reason: str

