# PillPal Clinical RAG Service

The PillPal RAG service (`services/rag/`) is an internal Python/Flask microservice providing verified clinical evidence retrieval for the PillPal kiosk platform. It ingests official pharmaceutical product summaries (BfArM SmPCs) and clinical reference encyclopedias (Gale Encyclopedia of Medicine), segments them by section headers, embeds them using exact 384-dimensional representations, and serves them to Node.js via authenticated endpoints.

---

## 1. Architectural Guardrails & Authority Boundary

1. **Deterministic Authority Boundary**:
   - The Node.js backend and deterministic state engine remain **authoritative** for customer assessment questions, red-flag emergency triage, and dispensing authorization.
   - The RAG service supplies background evidence, dosage guidance, and clinical explanations **only**. Retrieval scores reflect textual relevance and are **never** presented as medical certainty or diagnostic confidence.
2. **Clinical Staging Quarantine (Fail-Closed)**:
   - Newly ingested documents are stored in `data/staging/local_staging_index.json` with status `pending_review`.
   - Production retrieval endpoints (`POST /retrieve`) strictly query `data/approved/local_index.json` where `approval_status == "approved"`.
   - Pending or withdrawn documents are **never** returned in customer interactions.
3. **Resilience (Fail-Safe Informational)**:
   - If the RAG service times out (2500ms bounded threshold) or is offline, core triage, questions, greetings, and approved medicine recommendations proceed unaffected without crashing.

---

## 2. Directory Structure

```
services/rag/
├── app.py                # Flask REST API (/health/live, /health/ready, /retrieve)
├── cli.py                # Administrative CLI for ingest, approve, withdraw, and status
├── config.py             # Environment configuration and file paths
├── embeddings.py         # 384-dim SentenceTransformer and deterministic local vectorizer
├── generate_seeds.py     # Generates baseline source PDFs and seeds approved index
├── ingest.py             # PDF extraction, quality verification, section chunking, hashing
├── requirements.txt      # Python dependencies
├── requirements.lock     # Reproducible dependency lockfile
├── retrieval.py          # Local vector index (offline) & Pinecone adapter (online)
├── schemas.py            # Pydantic schemas and prompt-injection sanitization
├── data/
│   ├── approved/         # Released clinical index (local_index.json)
│   ├── staging/          # Unreviewed quarantined documents
│   └── sources/          # Official source PDFs
└── tests/                # Automated pytest suite (19 unit & security tests)
```

---

## 3. Installation & Local Startup

### Prerequisites
- Python 3.10+
- Node.js 20+

### Setup Python Environment
```bash
# Install dependencies from requirements.txt
pip install -r services/rag/requirements.txt
```

### Seed Knowledge Base
```bash
# Generates baseline German SmPCs and Gale Encyclopedia PDFs, then builds the approved index
python -m services.rag.generate_seeds
```

### Run Administrative CLI
```bash
# Check knowledge base status
python -m services.rag.cli status

# Ingest a new PDF into staging quarantine
python -m services.rag.cli ingest path/to/leaflet.pdf --id DOC-NEW-01 --title "SmPC Title" --lang de --collection german_product_info

# Review and promote a document to approved release
python -m services.rag.cli approve DOC-NEW-01

# Immediately withdraw a document from production retrieval
python -m services.rag.cli withdraw DOC-NEW-01
```

### Start the Services

**Terminal 1 — Python RAG Service:**
```bash
python -m services.rag.app
# Runs on http://127.0.0.1:5001
```

**Terminal 2 — Node.js Kiosk Server:**
```bash
npm start
# Runs on http://127.0.0.1:8091 (or configured PORT)
```

---

## 4. Operational Modes

### Offline Mode (`PILLPAL_RAG_MODE=offline`, default)
- **Vector Index**: Reads `services/rag/data/approved/local_index.json`.
- **Embeddings**: Uses `sentence-transformers/all-MiniLM-L6-v2` (or zero-network `DeterministicLocalEmbeddings`).
- **Voice**: Local Whisper STT and Piper TTS.
- **Language Models**: Local deterministic mapper / local Ollama if configured.
- Zero network egress to cloud APIs.

### Online Mode (`PILLPAL_RAG_MODE=online`)
- **Vector Index**: Pinecone vector database (`PINECONE_INDEX_NAME`).
- **Embeddings**: 384-dimensional embeddings matching Pinecone index.
- **Language Models**: Gemini 1.5/2.0 for conversational understanding.
- Falls back automatically to local index if Pinecone connectivity fails.

---

## 5. Verification & Automated Testing

Run the RAG verification test suite:
```bash
# Runs Node integration tests and Python pytest suite
npm run test:rag
```

Run the entire platform test suite (20 suites, 100% pass):
```bash
npm test
```
