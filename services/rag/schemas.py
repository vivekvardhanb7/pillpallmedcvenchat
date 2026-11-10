"""Pydantic schemas for PillPal RAG service contracts."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocumentMetadata(BaseModel):
    """Metadata preserved for each ingested document passage."""

    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., description="Unique persistent identifier for the document")
    title: str = Field(..., description="Human-readable title of the document or SmPC")
    section: str = Field(..., description="Section or heading the chunk belongs to")
    page: int = Field(default=1, ge=0, description="Page number in original document")
    language: Literal["de", "en"] = Field(..., description="Language of the document")
    jurisdiction: str = Field(default="DE", description="Country/Regulatory jurisdiction code (e.g. DE, MA)")
    source_date: str = Field(..., description="ISO publication or revision date YYYY-MM-DD")
    version: str = Field(..., description="Version of the document / leaflet")
    approval_status: Literal["approved", "pending_review", "withdrawn"] = Field(
        default="pending_review", description="Clinical approval and release status"
    )
    content_hash: str = Field(..., description="SHA-256 hex digest of the chunk content")
    collection: Literal[
        "gale_encyclopedia", "german_product_info", "reviewed_clinical_guidance"
    ] = Field(..., description="Knowledge collection partition")
    source_url: Optional[str] = Field(default=None, description="Official regulatory or publication URL")


class Passage(BaseModel):
    """An approved or retrieved text passage with provenance."""

    model_config = ConfigDict(extra="forbid")

    evidence_id: str = Field(..., description="Deterministic evidence identifier")
    text: str = Field(..., description="Extracted passage text")
    metadata: DocumentMetadata
    score: float = Field(default=0.0, ge=0.0, le=1.0, description="Retrieval similarity score (0.0 to 1.0)")
    approved: bool = Field(default=False, description="Whether this passage is approved for clinical release")


class RetrieveRequest(BaseModel):
    """Validated retrieve request payload from Node.js."""

    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1, max_length=500, description="Natural language medical question or keyword query")
    language: Literal["de", "en"] = Field(default="de", description="Requested response language")
    collection: Optional[
        Literal["gale_encyclopedia", "german_product_info", "reviewed_clinical_guidance"]
    ] = Field(default=None, description="Optional partition filter")
    symptoms: List[str] = Field(default_factory=list, max_length=10, description="Minimal symptom codes/names")
    confirmed_facts: Dict[str, Any] = Field(default_factory=dict, description="Confirmed facts (e.g. age, duration, severity)")
    product_ids: List[str] = Field(default_factory=list, max_length=10, description="Applicable product SKUs/IDs")
    top_k: int = Field(default=3, ge=1, le=10, description="Maximum passages to retrieve")

    @field_validator("query")
    @classmethod
    def sanitize_query(cls, value: str) -> str:
        # Strip potential prompt injection prefixes or system tags
        cleaned = re.sub(r"<\s*/?(?:system|assistant|user|instructions?|prompt)[^>]*>", "", value, flags=re.I)
        cleaned = " ".join(cleaned.split()).strip()
        if not cleaned:
            raise ValueError("Query contains no valid text after sanitization.")
        return cleaned[:500]


class RetrieveResponse(BaseModel):
    """Validated response containing retrieved passages and mandatory disclaimer."""

    model_config = ConfigDict(extra="forbid")

    query: str
    language: Literal["de", "en"]
    passages: List[Passage]
    total_found: int
    retrieval_mode: Literal["online_pinecone", "offline_local", "mock"]
    disclaimer: str = (
        "Retrieval scores reflect text matching relevance only, not clinical safety, "
        "medical diagnosis, or personal suitability."
    )


class HealthStatus(BaseModel):
    """Service health and readiness contract."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "ready", "degraded", "error"]
    service: str = "pillpal-rag"
    mode: Literal["offline", "online"]
    index_type: str
    approved_passages_count: int
    collections: List[str]
    dimension: int
