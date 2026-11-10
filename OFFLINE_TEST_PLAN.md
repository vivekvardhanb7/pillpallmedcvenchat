# OFFLINE_TEST_PLAN.md — Comprehensive Offline Verification Protocol

**Date:** 2026-11-05  
**Auditor:** Software Quality & Clinical Safety Test Engineer  
**Scope:** Step-by-step verification protocol to confirm 100% offline operational autonomy.

---

## 1. Test Environment Setup

1. **Host Machine:** Reference Intel i5-1240P Windows laptop.
2. **Network State:** Network adapter disabled (`Disable-NetAdapter`) or airplane mode enabled to ensure zero internet access.
3. **Execution Port:** Kiosk server running on `http://127.0.0.1:8080`.

---

## 2. Test Execution Matrix

| Test ID | Test Scenario | Offline Mechanism | Expected Result | Pass Criteria |
|---|---|---|---|---|
| **OFF-01** | Kiosk Initial Boot | Loads local assets from `web/` | UI loads cleanly with logo, categories, and offline indicator | Page renders in < 200ms; status shows `Offline Mode` |
| **OFF-02** | Local STT Transcription | Spawns `whisper-cli.exe` with `ggml-base.bin` | Converts local WAV audio to text string without cloud API | Valid transcript in < 3.0s |
| **OFF-03** | Local Clinical Intake (Pain/Fever) | Local `/api/chat-turn` engine in `server.mjs` | Runs 11-step interview, early exit on red flags | Correct screens, < 10ms per turn |
| **OFF-04** | Local Product Matching | Reads `local_catalog_snapshot.json` | Matches DOLIPRANE 500mg for eligible adult | Displays verified product, dose, warnings |
| **OFF-05** | Local TTS Synthesis | Spawns `piper.exe` | Synthesizes spoken WAV audio | Generates audio in < 200ms, plays through browser audio |
| **OFF-06** | Broader Catalogue Search | Queries local Morocco, India, and International datasets | Finds medicines outside vending stock (e.g. Paracetamol, Brufen, Cetirizine) | Displays registration details and stock status |
| **OFF-07** | Alternative Engine (Levels 1–4) | Evaluates Level 1 equivalent vs Level 2 different strength | Classifies equivalence correctly with warnings | Strict clinical match rules; no generic hallucinations |
| **OFF-08** | Fixed-Dose Combination Check | Evaluates ingredient ratio and indications | Rejects unverified combination replacements | Blocks dangerous multi-drug substitutions |
| **OFF-09** | Safety Interlock Check | Customer states Paracetamol allergy | Candidate Paracetamol product is strictly blocked | Outcome: `NO_SUITABLE_PRODUCT` or alternative |
| **OFF-10** | Offline Outcome Queueing | Assessment reaches completion | Writes outcome row to `tmp/offline_outcome_queue.jsonl` | File contains valid JSON row with session hash |
| **OFF-11** | Zero External Leakage | Wireshark / Netstat traffic capture | Zero outbound TCP/UDP connections outside `127.0.0.1` | No traffic to Google, Supabase, or n8n |
| **OFF-12** | Reconnect & Sync | Network re-enabled | Calls `/api/sync/push` and flushes queued logs to Supabase | All queued rows marked synced in Supabase |
