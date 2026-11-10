"""Vector retrieval adapters for local offline index and online Pinecone index."""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

from services.rag.config import Config
from services.rag.embeddings import BaseEmbeddingAdapter, get_embedding_adapter
from services.rag.schemas import Passage, RetrieveRequest, RetrieveResponse

logger = logging.getLogger(__name__)


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if len(v1) != len(v2) or not v1:
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 <= 0.0 or norm2 <= 0.0:
        return 0.0
    val = dot / (norm1 * norm2)
    return max(0.0, min(1.0, (val + 1.0) / 2.0))  # normalize to [0, 1]


class BaseRetrievalAdapter:
    """Abstract retrieval adapter interface."""

    def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        raise NotImplementedError

    def is_ready(self) -> bool:
        raise NotImplementedError

    def count_approved_passages(self) -> int:
        raise NotImplementedError


class LocalVectorIndexAdapter(BaseRetrievalAdapter):
    """Offline-first local vector index adapter.

    Reads approved passages and pre-computed vectors from local JSON storage.
    Enforces that pending or withdrawn documents are never returned.
    """

    def __init__(
        self,
        index_path: Path = Config.APPROVED_INDEX_PATH,
        embedding_adapter: Optional[BaseEmbeddingAdapter] = None,
    ) -> None:
        self.index_path = index_path
        self.embedding_adapter = embedding_adapter or get_embedding_adapter(force_local=True)

    def is_ready(self) -> bool:
        return self.index_path.exists()

    def _load_approved_items(self) -> List[Dict[str, Any]]:
        if not self.index_path.exists():
            return []
        try:
            with open(self.index_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            # Strictly filter for approved passages only
            return [
                item for item in raw
                if item.get("passage", {}).get("approved") is True
                and item.get("passage", {}).get("metadata", {}).get("approval_status") == "approved"
            ]
        except Exception as e:
            logger.error("Failed to load approved local index from %s: %e", self.index_path, e)
            return []

    def count_approved_passages(self) -> int:
        return len(self._load_approved_items())

    def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        items = self._load_approved_items()
        if not items:
            return RetrieveResponse(
                query=request.query,
                language=request.language,
                passages=[],
                total_found=0,
                retrieval_mode="offline_local",
            )

        # 1. Filter by language and optional collection
        filtered = [
            it for it in items
            if it["passage"]["metadata"]["language"] == request.language
            and (request.collection is None or it["passage"]["metadata"]["collection"] == request.collection)
        ]

        # If product_ids provided, optionally prioritize matching documents
        if request.product_ids:
            matching_products = [
                it for it in filtered
                if any(pid.lower() in it["passage"]["metadata"]["document_id"].lower() for pid in request.product_ids)
            ]
            if matching_products:
                filtered = matching_products

        if not filtered:
            return RetrieveResponse(
                query=request.query,
                language=request.language,
                passages=[],
                total_found=0,
                retrieval_mode="offline_local",
            )

        # 2. Embed the query
        query_vec = self.embedding_adapter.embed_query(request.query)

        # 3. Score and rank candidates
        scored: List[Passage] = []
        q_tokens = set(request.query.lower().split())

        for item in filtered:
            passage_dict = item["passage"]
            doc_vec = item.get("vector") or []
            base_score = cosine_similarity(query_vec, doc_vec)

            # Keyword lexical overlap boost for exact clinical terms
            p_text = passage_dict["text"].lower()
            overlap = sum(1 for tok in q_tokens if len(tok) >= 4 and tok in p_text)
            term_boost = min(0.2, overlap * 0.05)
            final_score = round(min(1.0, base_score + term_boost), 4)

            p_obj = Passage.model_validate({
                **passage_dict,
                "score": final_score,
            })
            scored.append(p_obj)

        # Sort descending by relevance score
        scored.sort(key=lambda p: p.score, reverse=True)
        top_passages = scored[: request.top_k]

        return RetrieveResponse(
            query=request.query,
            language=request.language,
            passages=top_passages,
            total_found=len(top_passages),
            retrieval_mode="offline_local",
        )


class PineconeRetrievalAdapter(BaseRetrievalAdapter):
    """Online Pinecone retrieval adapter with local fallback."""

    def __init__(
        self,
        api_key: str,
        index_name: str,
        embedding_adapter: Optional[BaseEmbeddingAdapter] = None,
        fallback_adapter: Optional[BaseRetrievalAdapter] = None,
    ) -> None:
        self.api_key = api_key
        self.index_name = index_name
        self.embedding_adapter = embedding_adapter or get_embedding_adapter()
        self.fallback_adapter = fallback_adapter or LocalVectorIndexAdapter()
        self._index = None

    def _get_index(self):
        if self._index is None:
            try:
                from pinecone import Pinecone
                pc = Pinecone(api_key=self.api_key)
                self._index = pc.Index(self.index_name)
            except Exception as e:
                logger.warning("Pinecone connection initialization failed: %s", e)
                self._index = None
        return self._index

    def is_ready(self) -> bool:
        idx = self._get_index()
        return idx is not None

    def count_approved_passages(self) -> int:
        idx = self._get_index()
        if idx:
            try:
                stats = idx.describe_index_stats()
                return stats.get("total_vector_count", 0)
            except Exception:
                pass
        return self.fallback_adapter.count_approved_passages()

    def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        idx = self._get_index()
        if not idx:
            logger.warning("Pinecone unavailable; falling back to offline local vector index.")
            return self.fallback_adapter.retrieve(request)

        try:
            query_vec = self.embedding_adapter.embed_query(request.query)
            pinecone_filter = {
                "approval_status": {"$eq": "approved"},
                "language": {"$eq": request.language},
            }
            if request.collection:
                pinecone_filter["collection"] = {"$eq": request.collection}

            res = idx.query(
                vector=query_vec,
                top_k=request.top_k,
                include_metadata=True,
                filter=pinecone_filter,
            )

            passages: List[Passage] = []
            for match in res.get("matches", []):
                meta_dict = match.get("metadata", {})
                meta = DocumentMetadata.model_validate(meta_dict)
                passages.append(
                    Passage(
                        evidence_id=match["id"],
                        text=meta_dict.get("text", ""),
                        metadata=meta,
                        score=float(match.get("score", 0.0)),
                        approved=meta.approval_status == "approved",
                    )
                )

            return RetrieveResponse(
                query=request.query,
                language=request.language,
                passages=passages,
                total_found=len(passages),
                retrieval_mode="online_pinecone",
            )
        except Exception as e:
            logger.error("Pinecone query failed: %s; falling back to local index.", e)
            return self.fallback_adapter.retrieve(request)


def get_retrieval_adapter(config: type[Config] = Config) -> BaseRetrievalAdapter:
    """Factory returning Pinecone adapter if online mode is configured, else local vector index."""
    local_adapter = LocalVectorIndexAdapter(index_path=config.APPROVED_INDEX_PATH)
    if config.is_online_ready() and config.PINECONE_API_KEY:
        return PineconeRetrievalAdapter(
            api_key=config.PINECONE_API_KEY,
            index_name=config.PINECONE_INDEX_NAME,
            fallback_adapter=local_adapter,
        )
    return local_adapter
