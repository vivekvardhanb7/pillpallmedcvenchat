"""Tests for Flask API endpoints and microservice token authentication."""

from __future__ import annotations

import json
from services.rag.app import app
from services.rag.config import Config


def test_health_live():
    client = app.test_client()
    res = client.get("/health/live")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "pillpal-rag"


def test_health_ready():
    client = app.test_client()
    res = client.get("/health/ready")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ready"
    assert data["approved_passages_count"] > 0
    assert data["dimension"] == 384


def test_retrieve_unauthorized():
    client = app.test_client()
    payload = {"query": "Kopfschmerzen", "language": "de"}
    res = client.post("/retrieve", json=payload)
    assert res.status_code == 401


def test_retrieve_authorized():
    client = app.test_client()
    headers = {"Authorization": f"Bearer {Config.SERVICE_TOKEN}"}
    payload = {
        "query": "Kopfschmerzen Dosierung Paracetamol",
        "language": "de",
        "product_ids": ["PARACETAMOL"],
        "top_k": 2,
    }
    res = client.post("/retrieve", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["query"] == "Kopfschmerzen Dosierung Paracetamol"
    assert data["language"] == "de"
    assert len(data["passages"]) > 0
    assert "disclaimer" in data


def test_retrieve_custom_header_authorized():
    client = app.test_client()
    headers = {"X-PillPal-RAG-Token": Config.SERVICE_TOKEN}
    payload = {"query": "headache treatment", "language": "en", "top_k": 1}
    res = client.post("/retrieve", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["passages"]) == 1


def test_retrieve_invalid_schema():
    client = app.test_client()
    headers = {"Authorization": f"Bearer {Config.SERVICE_TOKEN}"}
    payload = {"query": "", "language": "de"}  # min_length=1
    res = client.post("/retrieve", json=payload, headers=headers)
    assert res.status_code == 400
