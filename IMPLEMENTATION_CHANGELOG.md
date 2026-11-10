# IMPLEMENTATION_CHANGELOG.md — Master Project Changelog

**Date:** 2026-11-05  
**Version:** 0.2.0-offline-preview  
**Project:** PILLPAL MedAssist — AI Medical Chatbot & Intelligent Medical Vending Machine

---

## Changes Implemented in this Milestone

### 1. Offline-First Core Implementation
- **New Module `web/local-engine.mjs`:**
  - Standalone local execution of the 11-step clinical triage engine without hosted n8n dependency.
  - Deterministic catalogue matching against local verified snapshot.
  - Local outcome queueing to `tmp/offline_outcome_queue.jsonl`.
- **Extended Kiosk Server `web/server.mjs`:**
  - Added `POST /api/chat-turn` (Offline clinical triage endpoint).
  - Added `GET/POST /api/catalog/search` (Multi-jurisdiction medicine search).
  - Added `GET/POST /api/alternatives` (Level 1–4 alternative search).
  - Added `POST /api/combination/validate` (Fixed-dose combination & duplicate ingredient validator).
  - Added `GET /api/sync/status` (Offline readiness & queue count indicator).
- **Client Resilience `web/app.js`:**
  - Added automatic failover: If external hosted n8n webhook is unreachable or offline, the kiosk automatically routes all subsequent turns to local `/api/chat-turn`.
  - Added `setup.offlineActive` and `setup.onlineActive` status notices in `web/i18n.js` for English and German.

### 2. Multi-Jurisdiction Medicine Catalogue & Data Governance
- **Created `data/local_catalog_snapshot.json`:**
  - Normalized dataset containing 11 verified specialities across Morocco (AMMPS), India (CDSCO), and International references.
  - 5 physical vending machine slots allocated with real-time stock counts.
  - 5 alternative mappings (Level 1 bioequivalent, Level 2 strength/formulation variant, Level 3 therapeutic class, Level 4 prohibited/withdrawn).
  - Sourced from Moroccan AMMPS reports, DMP public pricing, and ANSM/EMC patient leaflets.
- **Created Snapshot Generator `scripts/generate-catalog-snapshot.mjs`:**
  - Computes SHA-256 integrity hash of catalog on build.

### 3. UI & Voice Interface Hardening
- **Fixed Short-Viewport Responsiveness in `web/styles.css`:**
  - Added `@media (max-height: 520px)` rule scaling the voice stage, dock controls, and voice orb. Eliminates clipping on 525×482 screens.
- **Voice Pipeline Validation:**
  - Verified local `whisper-cli.exe` with `ggml-base.bin` on Intel Alder Lake CPU.
  - Verified local `piper.exe` with English voice and Arabic Tashkeel diacritizer.

### 4. Comprehensive Testing & Verification
- **Added Automated Test Suites:**
  - `scripts/test-local-engine.mjs` (Full intake, red flags, under-18 refusal, catalogue search, alternative matching, duplicate ingredient detection).
  - `scripts/test-server-offline-endpoints.mjs` (HTTP server live probe against all offline routes).
- **Expanded `npm test` in `package.json`:**
  - Now runs 11 test suites. All 11 suites pass 100%.
