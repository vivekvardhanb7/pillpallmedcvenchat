"""Tests for document chunking, metadata hashing, and approval workflow."""

from __future__ import annotations

import hashlib
from pathlib import Path
from services.rag.config import Config
from services.rag.ingest import DocumentIngestionService, split_text_into_section_chunks


def test_split_text_into_section_chunks():
    sample_text = (
        "Bezeichnung des Arzneimittels\n"
        "Paracetamol 500 mg Tabletten\n\n"
        "Anwendungsgebiete\n"
        "Zur Behandlung leichter bis maessig starker Schmerzen und Fieber.\n\n"
        "Gegenanzeigen\n"
        "Schwere Leberfunktionsstoerungen und Ueberempfindlichkeit."
    )
    meta = {
        "document_id": "TEST-DOC-01",
        "title": "Test Title",
        "language": "de",
        "source_date": "2026-01-01",
        "collection": "german_product_info",
    }

    chunks = split_text_into_section_chunks(sample_text, page_num=1, base_metadata=meta)
    assert len(chunks) >= 2

    # Check evidence ID structure and SHA-256 hash preservation
    for chunk in chunks:
        assert chunk.evidence_id.startswith("TEST-DOC-01#p1#")
        assert len(chunk.metadata.content_hash) == 64
        # Verify content hash matches text
        expected_hash = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        assert chunk.metadata.content_hash == expected_hash


def test_approval_and_withdrawal_lifecycle(tmp_path: Path):
    app_index = tmp_path / "approved.json"
    stg_index = tmp_path / "staging.json"
    ingestion = DocumentIngestionService(approved_index_path=app_index, staging_index_path=stg_index)

    # Ingest seed PDF into staging
    pdf_path = Config.SOURCES_DIR / "german_paracetamol_500_smpc.pdf"
    if not pdf_path.exists():
        return

    doc_meta = {
        "document_id": "TEST-LIFECYCLE-DOC",
        "title": "Lifecycle Test",
        "language": "de",
        "source_date": "2026-01-01",
        "collection": "german_product_info",
    }

    staged_passages = ingestion.ingest_document(pdf_path, doc_meta, stage_only=True)
    assert len(staged_passages) > 0
    assert all(p.approved is False for p in staged_passages)
    assert all(p.metadata.approval_status == "pending_review" for p in staged_passages)

    # Promote to approved
    promoted_count = ingestion.approve_document("TEST-LIFECYCLE-DOC")
    assert promoted_count == len(staged_passages)

    # Withdraw document
    withdrawn_count = ingestion.withdraw_document("TEST-LIFECYCLE-DOC")
    assert withdrawn_count == len(staged_passages)
