"""PDF text extraction, extraction-quality verification, section chunking, and index publishing."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

from pypdf import PdfReader

from services.rag.config import Config
from services.rag.embeddings import BaseEmbeddingAdapter, get_embedding_adapter
from services.rag.schemas import DocumentMetadata, Passage

logger = logging.getLogger(__name__)


class ExtractionQualityError(ValueError):
    """Raised when extracted PDF text fails quality verification checks."""


def verify_text_quality(text: str, page_num: int, min_chars: int = 40, min_printable: float = 0.82) -> str:
    """Verify that extracted page text contains legible, printable clinical content."""
    clean = text.strip()
    if len(clean) < min_chars:
        raise ExtractionQualityError(
            f"Page {page_num} text too short ({len(clean)} chars < {min_chars}). "
            "May be a blank page or raster-only scan without OCR text."
        )

    printable_count = sum(1 for c in clean if c.isprintable() or c in "\n\r\t")
    ratio = printable_count / max(1, len(clean))
    if ratio < min_printable:
        raise ExtractionQualityError(
            f"Page {page_num} failed printable ratio check ({ratio:.2f} < {min_printable:.2f}). "
            "Likely corrupted font encoding or binary artifact."
        )
    return clean


def extract_pdf_pages(pdf_path: Path) -> List[Tuple[int, str]]:
    """Extract and verify text from a PDF file page by page."""
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    reader = PdfReader(str(pdf_path))
    pages: List[Tuple[int, str]] = []
    for idx, page in enumerate(reader.pages, start=1):
        raw_text = page.extract_text() or ""
        clean_text = verify_text_quality(
            raw_text,
            page_num=idx,
            min_chars=Config.MIN_PAGE_CHARS,
            min_printable=Config.MIN_PRINTABLE_RATIO,
        )
        pages.append((idx, clean_text))
    return pages


# Common medical section markers in German and English leaflets/encyclopedias
SECTION_PATTERNS = [
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Bezeichnung des Arzneimittels|Name of the medicinal product)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Qualitative und quantitative Zusammensetzung|Composition)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Anwendungsgebiete|Therapeutic indications|Indications)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Dosierung und Art der Anwendung|Posology and method of administration|Dosage)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Gegenanzeigen|Contraindications)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Besondere Warnhinweise|Special warnings and precautions|Precautions|Warnings)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Wechselwirkungen|Interactions)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Nebenwirkungen|Undesirable effects|Side Effects)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Überdosierung|Overdose)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Pharmakologische Eigenschaften|Pharmacological properties|Description)\b.*$",
    r"^\s*(?:[0-9]+\.?[0-9]*\s+)?(Diagnosis|Treatment|Prognosis|Definition|Causes)\b.*$",
]

SECTION_REGEX = re.compile("|".join(f"(?:{p})" for p in SECTION_PATTERNS), re.IGNORECASE | re.MULTILINE)


def split_text_into_section_chunks(
    text: str,
    page_num: int,
    base_metadata: Dict[str, Any],
    max_chunk_chars: int = 600,
) -> List[Passage]:
    """Segment page text by clinical section headers, ensuring semantic boundaries."""
    passages: List[Passage] = []
    lines = text.split("\n")
    current_section = base_metadata.get("default_section", "General Information")
    buffer: List[str] = []
    current_len = 0

    def flush_buffer():
        nonlocal buffer, current_len
        if not buffer:
            return
        chunk_text = " ".join(" ".join(buffer).split()).strip()
        if len(chunk_text) >= 30:
            content_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
            doc_id = base_metadata["document_id"]
            evidence_id = f"{doc_id}#p{page_num}#{content_hash[:12]}"

            meta = DocumentMetadata(
                document_id=doc_id,
                title=base_metadata["title"],
                section=current_section,
                page=page_num,
                language=base_metadata["language"],
                jurisdiction=base_metadata.get("jurisdiction", "DE"),
                source_date=base_metadata["source_date"],
                version=base_metadata.get("version", "1.0"),
                approval_status=base_metadata.get("approval_status", "pending_review"),
                content_hash=content_hash,
                collection=base_metadata["collection"],
                source_url=base_metadata.get("source_url"),
            )

            passages.append(
                Passage(
                    evidence_id=evidence_id,
                    text=chunk_text,
                    metadata=meta,
                    score=0.0,
                    approved=meta.approval_status == "approved",
                )
            )
        buffer = []
        current_len = 0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        match = SECTION_REGEX.match(stripped)
        if match:
            flush_buffer()
            current_section = stripped[:80]
            continue

        buffer.append(stripped)
        current_len += len(stripped) + 1

        if current_len >= max_chunk_chars:
            flush_buffer()

    flush_buffer()
    return passages


class DocumentIngestionService:
    """Manages document parsing, staging quarantine, vector index building, and approval releases."""

    def __init__(
        self,
        approved_index_path: Path = Config.APPROVED_INDEX_PATH,
        staging_index_path: Path = Config.STAGING_INDEX_PATH,
        embedding_adapter: Optional[BaseEmbeddingAdapter] = None,
    ) -> None:
        self.approved_index_path = approved_index_path
        self.staging_index_path = staging_index_path
        self.embedding_adapter = embedding_adapter or get_embedding_adapter(force_local=True)

    def ingest_document(
        self,
        pdf_path: Path,
        doc_metadata: Dict[str, Any],
        stage_only: bool = True,
    ) -> List[Passage]:
        """Ingest a PDF document into staging (default) or approved release."""
        # 1. Extract pages with quality checks
        pages = extract_pdf_pages(pdf_path)

        # 2. Chunk pages with metadata
        all_passages: List[Passage] = []
        status: Literal["approved", "pending_review"] = "pending_review" if stage_only else "approved"
        doc_metadata["approval_status"] = status

        for page_num, text in pages:
            chunks = split_text_into_section_chunks(
                text=text,
                page_num=page_num,
                base_metadata=doc_metadata,
                max_chunk_chars=Config.MAX_CHUNK_CHARS,
            )
            all_passages.extend(chunks)

        if not all_passages:
            raise ValueError(f"No valid passages generated from {pdf_path}")

        # 3. Generate embeddings
        texts = [p.text for p in all_passages]
        vectors = self.embedding_adapter.embed_documents(texts)

        # 4. Save to target index
        target_path = self.staging_index_path if stage_only else self.approved_index_path
        self._append_to_index(target_path, all_passages, vectors)

        logger.info(
            "Ingested %d passages from %s into %s (status=%s)",
            len(all_passages),
            pdf_path.name,
            target_path.name,
            status,
        )
        return all_passages

    def approve_document(self, document_id: str) -> int:
        """Promote a document from staging quarantine to approved production release."""
        staging_data = self._load_index_raw(self.staging_index_path)
        matching = [item for item in staging_data if item["passage"]["metadata"]["document_id"] == document_id]
        if not matching:
            raise ValueError(f"Document ID {document_id!r} not found in staging index.")

        # Update approval status to approved
        for item in matching:
            item["passage"]["metadata"]["approval_status"] = "approved"
            item["passage"]["approved"] = True

        # Append to approved index
        approved_data = self._load_index_raw(self.approved_index_path)
        # Deduplicate
        existing_ids = {item["passage"]["evidence_id"] for item in approved_data}
        added = [item for item in matching if item["passage"]["evidence_id"] not in existing_ids]
        approved_data.extend(added)

        self._save_index_raw(self.approved_index_path, approved_data)
        logger.info("Promoted document %s (%d passages) to approved release.", document_id, len(added))
        return len(added)

    def withdraw_document(self, document_id: str) -> int:
        """Mark all passages of a document as withdrawn in the approved index."""
        approved_data = self._load_index_raw(self.approved_index_path)
        count = 0
        for item in approved_data:
            if item["passage"]["metadata"]["document_id"] == document_id:
                item["passage"]["metadata"]["approval_status"] = "withdrawn"
                item["passage"]["approved"] = False
                count += 1
        if count:
            self._save_index_raw(self.approved_index_path, approved_data)
        return count

    def _append_to_index(self, path: Path, passages: List[Passage], vectors: List[List[float]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = self._load_index_raw(path)
        existing_ids = {item["passage"]["evidence_id"] for item in data}

        for passage, vector in zip(passages, vectors):
            if passage.evidence_id not in existing_ids:
                data.append({
                    "passage": passage.model_dump(),
                    "vector": vector,
                })
        self._save_index_raw(path, data)

    def _load_index_raw(self, path: Path) -> List[Dict[str, Any]]:
        if not path.exists():
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_index_raw(self, path: Path, data: List[Dict[str, Any]]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
