"""Tests for offline local vector retrieval and language parity."""

from __future__ import annotations

from services.rag.config import Config
from services.rag.retrieval import LocalVectorIndexAdapter
from services.rag.schemas import RetrieveRequest


def test_offline_retrieval_german_headache():
    adapter = LocalVectorIndexAdapter(index_path=Config.APPROVED_INDEX_PATH)
    assert adapter.is_ready()

    req = RetrieveRequest(
        query="Kopfschmerzen Dosierung Schmerzmittel",
        language="de",
        top_k=3,
    )
    res = adapter.retrieve(req)
    assert res.language == "de"
    assert res.retrieval_mode == "offline_local"
    assert len(res.passages) > 0

    # Ensure all retrieved passages are approved and German
    for p in res.passages:
        assert p.approved is True
        assert p.metadata.language == "de"
        assert p.score > 0.0
        assert p.metadata.collection in ("german_product_info", "gale_encyclopedia")


def test_offline_retrieval_english_gale():
    adapter = LocalVectorIndexAdapter(index_path=Config.APPROVED_INDEX_PATH)
    req = RetrieveRequest(
        query="tension headache emergency warning signs",
        language="en",
        top_k=2,
    )
    res = adapter.retrieve(req)
    assert res.language == "en"
    assert len(res.passages) > 0
    for p in res.passages:
        assert p.metadata.language == "en"
        assert p.metadata.collection == "gale_encyclopedia"


def test_offline_retrieval_product_id_prioritization():
    adapter = LocalVectorIndexAdapter(index_path=Config.APPROVED_INDEX_PATH)
    req = RetrieveRequest(
        query="Dosierung",
        language="de",
        product_ids=["PARACETAMOL"],
        top_k=2,
    )
    res = adapter.retrieve(req)
    assert len(res.passages) > 0
    # Must retrieve Paracetamol SmPC passages
    assert any("PARACETAMOL" in p.metadata.document_id for p in res.passages)
