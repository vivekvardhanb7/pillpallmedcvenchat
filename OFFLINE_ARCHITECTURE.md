# OFFLINE_ARCHITECTURE.md — Offline-First System Topology & Execution Contract

**Date:** 2026-11-05  
**Audience:** Systems Architects, Network Engineers, Full-Stack Developers  
**Scope:** Architecture and execution guarantees for full offline autonomy of PILLPAL MedAssist.

---

## 1. Architectural Philosophy: True Offline-First

Offline operation is a mandatory primary requirement, not an error fallback. 
When internet connectivity is absent:
1. **Local Speech-to-Text:** whisper.cpp (`tools/whisper/Release/whisper-cli.exe`) executes locally on the Intel Alder Lake CPU.
2. **Local Conversational NLU:** Deterministic regex & brand normalizer runs locally in Node.js (with optional Qwen2.5-1.5B via llama.cpp).
3. **Local Clinical Decision Engine:** The 11-step clinical triage engine runs directly in the Node.js process inside `web/server.mjs`.
4. **Local Medicine Catalogue & Alternative Search:** Fast indexed local database evaluates Level 1–4 alternatives and fixed-dose combinations with zero network calls.
5. **Local Safety & Interlock Engine:** Validates allergies, duplicate active ingredients, drug interactions, and contraindications.
6. **Local Speech Synthesis:** Piper TTS (`tools/piper/piper.exe`) generates audio locally.
7. **Local Outcome Logging:** Completed sessions are saved to an append-only local audit file (`tmp/offline_outcome_queue.jsonl`) for deferred synchronization when online.

**Zero Cloud Calls:** In offline mode, no HTTP/WebSocket requests leave the local host (`localhost:8080`).

---

## 2. Dual-Mode Topology

```
+─────────────────────────────────────────────────────────────────────────────+
│                                KIOSK MACHINE                                │
│                                                                             │
│  [Touchscreen GUI / Voice UI]                                               │
│       │                                                                     │
│       ├── (Local HTTP) ──► [Kiosk Engine: web/server.mjs]                   │
│       │                         │                                           │
│       │                         ├──► Whisper.cpp (Local STT)                │
│       │                         ├──► Piper TTS (Local TTS)                  │
│       │                         ├──► Deterministic Triage Engine            │
│       │                         ├──► Local Verified Medicine Catalogue      │
│       │                         ├──► Safety & Alternative Matcher           │
│       │                         └──► Local Outcome Queue (SQLite/JSONL)     │
│       │                                      │                              │
+───────┼──────────────────────────────────────┼──────────────────────────────+
        │                                      │
        │ IF ONLINE:                           │ BACKGROUND SYNC (IF ONLINE):
        ▼                                      ▼
[Hosted n8n / Supabase]              [Supabase Outcome Log & Catalogue Update]
```

---

## 3. Local Endpoint Contracts

The local server (`web/server.mjs`) provides the following endpoints for offline autonomy:

| Endpoint | Method | Offline Role | Execution Latency |
|---|---|---|---|
| `/api/chat-turn` | POST | Executes clinical triage and product matching locally | < 5 ms |
| `/api/transcribe` | POST | Executes whisper.cpp STT | ~2.4 s |
| `/api/tts` | POST | Executes Piper TTS | ~30 ms (cached) / ~180 ms (fresh) |
| `/api/catalog/search` | GET/POST | Searches local medicine catalogue across Morocco, India, and International | < 2 ms |
| `/api/alternatives` | POST | Evaluates Level 1–4 alternatives & fixed-dose combinations | < 2 ms |
| `/api/sync/status` | GET | Reports online/offline state, model health, and pending sync count | < 1 ms |
| `/api/sync/push` | POST | Pushes queued offline outcomes to Supabase when network is restored | Variable |

---

## 4. Connectivity Transition Protocol

1. **Detection:** The browser client continuously monitors `navigator.onLine` and issues a periodic lightweight ping (`/api/sync/status`).
2. **Graceful Fallback:** If `config.webhookUrl` is configured to an external hosted URL (e.g. n8n) and fails with `TypeError: Failed to fetch` or timeout (>3s), `web/app.js` automatically routes all subsequent turns to local `/api/chat-turn`.
3. **UI Indicator:** Displays clear connectivity status:
   - `🟢 Online — Connected to Cloud Formularies`
   - `🟠 Offline Mode — Running Local Verified Catalogue & AI`
