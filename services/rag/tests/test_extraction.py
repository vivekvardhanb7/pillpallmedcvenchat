"""Tests for PDF extraction and text quality verification."""

from __future__ import annotations

import pytest
from services.rag.config import Config
from services.rag.ingest import (
    ExtractionQualityError,
    extract_pdf_pages,
    verify_text_quality,
)


def test_verify_text_quality_valid():
    legit_text = (
        "Symptomatische Behandlung von leichten bis maessig starken Schmerzen "
        "und Fieber bei Erwachsenen und Jugendlichen ab 12 Jahren."
    )
    res = verify_text_quality(legit_text, page_num=1)
    assert res == legit_text


def test_verify_text_quality_rejects_too_short():
    short_text = "Page 1"
    with pytest.raises(ExtractionQualityError, match="too short"):
        verify_text_quality(short_text, page_num=1, min_chars=40)


def test_verify_text_quality_rejects_binary_garbage():
    garbage_text = "Good prefix text but mostly corrupt \x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c" * 10
    with pytest.raises(ExtractionQualityError, match="printable ratio"):
        verify_text_quality(garbage_text, page_num=1, min_chars=10, min_printable=0.82)


def test_extract_pdf_pages_existing_seeds():
    paracetamol_pdf = Config.SOURCES_DIR / "german_paracetamol_500_smpc.pdf"
    if not paracetamol_pdf.exists():
        pytest.skip("Seed PDF not generated yet")

    pages = extract_pdf_pages(paracetamol_pdf)
    assert len(pages) >= 1
    assert pages[0][0] == 1  # page 1
    assert "Paracetamol" in pages[0][1]
