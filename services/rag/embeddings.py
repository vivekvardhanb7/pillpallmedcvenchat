"""Embedding adapters and dimensional integrity guards."""

from __future__ import annotations

import hashlib
import math
import re
from typing import List


class DimensionMismatchError(ValueError):
    """Raised when an embedding vector does not match the index dimension."""


class BaseEmbeddingAdapter:
    """Abstract interface for document and query embeddings."""

    @property
    def dimension(self) -> int:
        raise NotImplementedError

    def embed_query(self, text: str) -> List[float]:
        raise NotImplementedError

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError


class DeterministicLocalEmbeddings(BaseEmbeddingAdapter):
    """High-speed, offline-safe deterministic projection adapter (384 dimensions).

    Provides zero-network vectorization using normalized multi-hash n-gram projection.
    Guarantees consistent cosine similarity in pure offline environments and test suites.
    """

    def __init__(self, dimension: int = 384) -> None:
        self._dim = dimension

    @property
    def dimension(self) -> int:
        return self._dim

    def _vectorize(self, text: str) -> List[float]:
        vec = [0.0] * self._dim
        tokens = re.findall(r"\w+", text.lower(), re.UNICODE)
        if not tokens:
            return [1.0 / math.sqrt(self._dim)] * self._dim

        # Project 1-grams and 2-grams into dimensional space
        ngrams = tokens + [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
        for token in ngrams:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            # Map hash to index and sign
            idx = int.from_bytes(digest[:4], "little") % self._dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            weight = 1.0 + (len(token) / 10.0)
            vec[idx] += sign * weight

        # L2 Normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        else:
            vec = [1.0 / math.sqrt(self._dim)] * self._dim
        return vec

    def embed_query(self, text: str) -> List[float]:
        return self._vectorize(text)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._vectorize(t) for t in texts]


class SentenceTransformerEmbeddings(BaseEmbeddingAdapter):
    """Neural embedding adapter using sentence-transformers (all-MiniLM-L6-v2)."""

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", dimension: int = 384) -> None:
        self._dim = dimension
        self._model_name = model_name
        self._model = None

    def _load_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self._model_name)
            except Exception as e:
                raise RuntimeError(
                    f"Failed to load neural embedding model '{self._model_name}': {e}. "
                    "Ensure sentence-transformers and PyTorch are installed or use DeterministicLocalEmbeddings."
                ) from e
        return self._model

    @property
    def dimension(self) -> int:
        return self._dim

    def embed_query(self, text: str) -> List[float]:
        model = self._load_model()
        vec = model.encode(text, normalize_embeddings=True).tolist()
        validate_dimension(vec, self._dim)
        return vec

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        model = self._load_model()
        vectors = model.encode(texts, normalize_embeddings=True).tolist()
        for vec in vectors:
            validate_dimension(vec, self._dim)
        return vectors


def validate_dimension(vector: List[float], expected_dimension: int = 384) -> None:
    """Validate that vector dimension exactly matches expected index dimensions."""
    if len(vector) != expected_dimension:
        raise DimensionMismatchError(
            f"Embedding vector dimension {len(vector)} does not match index dimension {expected_dimension}."
        )


def get_embedding_adapter(model_name: str = "sentence-transformers/all-MiniLM-L6-v2", force_local: bool = False) -> BaseEmbeddingAdapter:
    """Factory returning the appropriate embedding adapter."""
    if not force_local:
        try:
            import sentence_transformers  # noqa: F401
            return SentenceTransformerEmbeddings(model_name=model_name, dimension=384)
        except ImportError:
            pass
    return DeterministicLocalEmbeddings(dimension=384)
