"""PillPal RAG Flask Service.

Provides internal REST API endpoints for Node.js:
- GET /health/live
- GET /health/ready
- POST /retrieve
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from flask import Flask, jsonify, request
from pydantic import ValidationError

from services.rag.config import Config
from services.rag.retrieval import get_retrieval_adapter
from services.rag.schemas import HealthStatus, RetrieveRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("pillpal-rag")

app = Flask("pillpal_rag")


def check_auth() -> bool:
    """Verify internal microservice bearer token."""
    expected_token = Config.SERVICE_TOKEN
    if not expected_token:
        return True

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token == expected_token:
            return True

    custom_header = request.headers.get("X-PillPal-RAG-Token", "")
    if custom_header.strip() == expected_token:
        return True

    return False


@app.route("/health/live", methods=["GET"])
def health_live():
    """Liveness probe: returns 200 if process is up."""
    return jsonify({"status": "ok", "service": "pillpal-rag"}), 200


@app.route("/health/ready", methods=["GET"])
def health_ready():
    """Readiness probe: checks index readiness and approved passages."""
    adapter = get_retrieval_adapter()
    ready = adapter.is_ready()
    count = adapter.count_approved_passages()

    status_code = 200 if ready else 503
    status_str = "ready" if (ready and count > 0) else ("degraded" if ready else "error")

    health = HealthStatus(
        status=status_str if status_str in ("ready", "degraded") else "error",
        service="pillpal-rag",
        mode=Config.MODE,
        index_type="pinecone" if Config.MODE == "online" and Config.is_online_ready() else "local_vector_json",
        approved_passages_count=count,
        collections=["gale_encyclopedia", "german_product_info", "reviewed_clinical_guidance"],
        dimension=Config.EMBEDDING_DIMENSION,
    )
    return jsonify(health.model_dump()), status_code


@app.route("/retrieve", methods=["POST"])
def retrieve_passages():
    """Retrieve clinically approved passages matching query and context."""
    if not check_auth():
        return jsonify({"error": "Unauthorized: Invalid or missing microservice token"}), 401

    raw_body = request.get_json(silent=True)
    if raw_body is None:
        return jsonify({"error": "Invalid request body; JSON expected"}), 400

    try:
        req = RetrieveRequest.model_validate(raw_body)
    except ValidationError as err:
        return jsonify({"error": "Validation error", "details": err.errors()}), 400

    try:
        adapter = get_retrieval_adapter()
        response = adapter.retrieve(req)
        return jsonify(response.model_dump()), 200
    except Exception as e:
        logger.exception("Retrieval execution failed: %s", e)
        return jsonify({"error": "Internal retrieval error", "message": str(e)}), 500


if __name__ == "__main__":
    logger.info("Starting PillPal RAG Flask service on %s:%d (mode=%s)...", Config.HOST, Config.PORT, Config.MODE)
    app.run(host=Config.HOST, port=Config.PORT, debug=False)
