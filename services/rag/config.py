"""Configuration for PillPal RAG Service."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

# Load .env from project root or service directory
SERVICE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SERVICE_DIR.parent.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(SERVICE_DIR / ".env")


class Config:
    """RAG Service runtime configuration."""

    HOST: str = os.getenv("PILLPAL_RAG_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PILLPAL_RAG_PORT", "5001"))
    
    # Internal service authentication
    SERVICE_TOKEN: str = os.getenv("PILLPAL_RAG_TOKEN", "pillpal-internal-rag-secret")

    # Mode: "offline" (local vector store + local embeddings) or "online" (Pinecone + cloud Gemini)
    MODE: Literal["offline", "online"] = (
        "online" if os.getenv("PILLPAL_RAG_MODE", "offline").lower() == "online" else "offline"
    )

    # Embedding model configuration
    EMBEDDING_MODEL: str = os.getenv(
        "RAG_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    EMBEDDING_DIMENSION: int = int(os.getenv("RAG_EMBEDDING_DIMENSION", "384"))

    # Online vector store (Pinecone)
    PINECONE_API_KEY: str | None = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "medical-chatbot-staging")

    # File paths
    DATA_DIR: Path = SERVICE_DIR / "data"
    APPROVED_DIR: Path = DATA_DIR / "approved"
    STAGING_DIR: Path = DATA_DIR / "staging"
    SOURCES_DIR: Path = DATA_DIR / "sources"
    APPROVED_INDEX_PATH: Path = APPROVED_DIR / "local_index.json"
    STAGING_INDEX_PATH: Path = STAGING_DIR / "local_staging_index.json"

    # Extraction constraints
    MIN_PAGE_CHARS: int = 40
    MIN_PRINTABLE_RATIO: float = 0.82
    MAX_CHUNK_CHARS: int = 600
    CHUNK_OVERLAP_CHARS: int = 60

    @classmethod
    def is_online_ready(cls) -> bool:
        """True only if online mode is requested and Pinecone credentials exist."""
        return cls.MODE == "online" and bool(cls.PINECONE_API_KEY)
