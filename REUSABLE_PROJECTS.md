# REUSABLE_PROJECTS.md — Reusable Open-Source Assets & Component Integration Matrix

**Date:** 2026-11-05  
**Audience:** Software Engineers, System Integrators  
**Scope:** Specific open-source repositories, components, libraries, and integration strategies authorized for reuse within PILLPAL MedAssist.

---

## 1. Selected and Approved Reusable Components

| Component | Upstream Origin | License | Role in PILLPAL | Status in Repo |
|---|---|---|---|---|
| **whisper.cpp** | [ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp) | MIT | Standalone offline Speech-to-Text binary with Alder Lake CPU vectorization | Integrated in `tools/whisper/Release/` with `ggml-base.bin` |
| **Piper TTS** | [rhasspy/piper](https://github.com/rhasspy/piper) | MIT | Standalone offline fast neural speech synthesis with ONNX Runtime | Integrated in `tools/piper/` with English voice and Arabic Tashkeel |
| **Qwen2.5 GGUF** | [QwenLM/Qwen2.5](https://github.com/QwenLM/Qwen2.5) | Apache 2.0 | Lightweight (1.5B/3B) offline conversational NLU and multilingual parsing | Selected for optional offline assistant layer |
| **SQLite with FTS5** | Native Node.js / SQLite3 | Public Domain | Offline local medicine database with fast indexed text & ingredient search | Architecture for Phase 3 offline catalogue |
| **Deterministic Code Nodes** | PILLPAL Team | Proprietary / Internal | Rigid 11-step clinical triage and conservative product matcher | Integrated in `n8n/src/` |

---

## 2. Component Integration & Interface Specifications

### 2.1 Whisper.cpp STT Pipeline
- **Invocation Interface:** Child process execution from `web/server.mjs`:
  ```bash
  whisper-cli.exe -m tools/whisper/models/ggml-base.bin -f <input_temp.wav> -l auto -nt -otxt
  ```
- **Language Detection:** Whisper outputs detected language token (e.g. `[fr]`, `[ar]`, `[en]`, `[de]`, `[hi]`, `[te]`).
- **Optimization:** Keep `ggml-base.bin` in disk cache; use Alder Lake CPU threads (`-t 6`) for optimal latency (~2.2-2.5s).

### 2.2 Piper TTS Engine
- **Invocation Interface:** Standard input stream to WAV file output:
  ```bash
  echo "<safe_sanitized_text>" | piper.exe --model tools/piper/voices/<voice>.onnx --output_file <cache_hash.wav>
  ```
- **Caching Mechanism:** SHA-256 hash of `[voice_id + text]` stored in `tmp/tts-cache/`. Repeated prompts evaluate in **~30ms**.

### 2.3 Local Medical Database Engine (SQLite / JSON Snapshot)
- **Design:** Instead of an external database service (like Postgres or ChromaDB), the offline kiosk uses an indexed local data store:
  - Normalized tables: `active_ingredients`, `products`, `product_safety`, `country_registrations`, `vending_inventory`.
  - In-memory indices for `active_ingredient_id`, `atc_code`, `pathway_id`, and `sku`.
  - Lookup performance: **< 1.0 ms** deterministic response time with zero external network overhead.

---

## 3. License & Compliance Verification

| Project | License Type | Commercial Restrictions | Attribution Requirement |
|---|---|---|---|
| whisper.cpp | MIT | None | Preserve copyright notice in binaries |
| Piper | MIT | None | Preserve copyright notice in binary distribution |
| Qwen2.5 | Apache 2.0 | None (for < 100M monthly active users) | Include Apache 2.0 notice in documentation |
| Gemma / MedGemma | Gemma Terms | Prohibited for unapproved medical device diagnostic claims | Clinical disclaimers mandatory; no clinical autonomy claims |

---

## 4. Components Specifically Excluded from Runtime

1. **Heavy PyTorch Runtimes:** Avoid installing 3+ GB PyTorch distributions on the kiosk laptop to conserve RAM and prevent Windows DLL conflicts.
2. **Paid Cloud Voice APIs (ElevenLabs / Vapi):** Prohibited as core dependencies to ensure strict zero-cost offline resilience.
3. **Black-box End-to-End LLM Agent Frameworks:** Prohibited from making clinical, dosing, or dispensing decisions.
