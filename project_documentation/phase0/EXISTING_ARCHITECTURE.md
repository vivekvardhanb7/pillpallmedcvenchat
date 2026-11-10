# EXISTING_ARCHITECTURE.md — verified implementation

**Date:** 2026-11-05
**Purpose:** describe the architecture that actually exists, so later phases do
not rebuild something that is already working or assume components that are not
present.

---

## 1. System context

```
+---------------------------- Kiosk machine (Windows) ----------------------------+
|                                                                                 |
|  Chrome / Edge kiosk browser                                                    |
|    index.html  (touchscreen)        voice.html  (premium voice surface)         |
|         |                                  |                                    |
|         +-------- web/app.js --------------+    (single controller)             |
|                    |         |                                                  |
|         voice-assistant.js   question-intent.js   voice-experience.js          |
|         voice-input-mapper.js   medicine-mentions.js   i18n.js                  |
|                    |                                                            |
|         local Node server  web/server.mjs  (port 8080, 0.0.0.0)                 |
|           - static files                                                        |
|           - /api/tts, /api/gemini-tts                                            |
|           - /api/understand, /api/translate                                      |
|           - /api/transcribe, /api/gemini-live-token                              |
|           - spawns tools/piper/piper.exe and tools/whisper/.../whisper-cli.exe   |
|                                                                                 |
+---------------------------------|-----------------------------------------------+
                                  | HTTPS POST + X-PILLPAL-Auth
                                  v
+---------------------- Hosted n8n (n8n.naf-cloudsystem.de) -----------------------+
|  Workflow CtomsWyOIBEuYrtX: PILLPAL MedAssist - Supabase Safety Chat MVP        |
|    Chat Turn Webhook (header auth)                                              |
|      -> Intake and Safety Engine            (deterministic Code node)           |
|      -> Needs Approved Product Catalog?     (IF)                                |
|           -> Load Approved Products from Supabase (Supabase node)               |
|           -> Deterministic Product Matcher  (deterministic Code node)           |
|      -> Return Touchscreen Response         (respondToWebhook)                  |
|      -> Assessment Finished? -> Build Outcome Log Row -> Insert Outcome Log Row |
|                                                                                 |
|  Workflow Tq1UTgrin8HYd9s6: Spoken Answer Understanding (optional sidecar)      |
|    Understand Webhook -> Sanitize -> Usable? -> Ask Gemini -> Validate -> Return |
|    Status Webhook -> Report Status -> Return Status                             |
+---------------------------------|-----------------------------------------------+
                                  | HTTPS + service-role credential
                                  v
+------------------------------ Supabase Postgres --------------------------------+
|  Catalog: countries, products, product_safety, symptom_pathways, questions,     |
|           ui_messages, clinical_rules, product_pathways, rule_products         |
|  Views:   recommendable_products, recommendable_product_pathways                |
|  Unused:  chat_sessions, session_answers, chat_events, decisions,               |
|           decision_products, decision_rule_results                              |
|  Log:     kiosk_outcome_log (anonymised counters)                               |
+----------------------------------------------------------------------------------+
```

There is **no Python service, no FastAPI, no vector database, no RAG index, no
message queue and no vending controller** in this repository.

---

## 2. Trust boundaries

| Boundary | Control | Notes |
|---|---|---|
| Browser → kiosk server | none | LAN-exposed; static assets, TTS, STT, understanding, translation |
| Browser → n8n | `X-PILLPAL-Auth` header | Secret is readable in `web/config.js`; it is a deterrent, not a secret store |
| n8n → Supabase | service-role credential | Never leaves n8n (and `.env` for audit scripts) |
| Browser → Supabase | none | No Supabase client or key in `web/` |
| Browser → Gemini (Live) | one-use token | Server issues a short-lived token; long-lived key stays server-side |
| Server → Piper / whisper.cpp | child process | Local binaries; no audio leaves the machine |

RLS is enabled on every table with no policies; `anon` and `authenticated` have
no privileges. Only `service_role` can read or write.

---

## 3. Frontend

### 3.1 Entry points

- `web/index.html` — touchscreen kiosk.
- `web/voice.html` — full-screen voice-first surface (`body.voice-only-page`),
  reusing the same controller and element IDs. `web/voice-experience.js` adds
  presentation-only behaviour (drawers, connectivity, speaker, end state,
  barge-in button).

### 3.2 Controller responsibilities (`web/app.js`)

- Reads `window.PILLPAL_CONFIG`.
- Holds the entire session state in memory (`current`, `state`); nothing is
  persisted in the browser.
- Renders the screen returned by n8n, localises it through `web/i18n.js`, speaks
  it, appends to the transcript.
- Runs the startup self-check (`{reset:true}` probe), config watcher, inactivity
  watchdog (default 120 s), theme and mute controls.
- Resolves typed/spoken answers:
  `voice-input-mapper.js` (deterministic wording) → optional
  `answer-understanding.js` (model, if enabled) → confirmation read-back →
  `pillpal-chat-turn` request.
- `question-intent.js` performs a local emergency keyword check before any model
  call and shows the emergency notice.
- `medicine-mentions.js` recognises brand names and routes them toward the
  allergy/medicine questions.

### 3.3 Turn contract

Request (from browser to n8n):

```json
{
  "session_id": "8-80 safe chars",
  "country_code": "MA | ZZ",
  "language_code": "en | de | auto",
  "reset": false,
  "state": { "...previous engine state..." },
  "answer": { "question_id": "age", "value": 30 }
}
```

Response (from n8n to browser):

```json
{
  "session_id": "...",
  "outcome": "MORE_INFORMATION | CLINIC_REFERRAL | IMMEDIATE_MEDICAL_CARE | NO_SUITABLE_PRODUCT | PRODUCT_ELIGIBLE",
  "screen": { "question_id": "...", "type": "...", "title": "...", "options": [] },
  "state": { "...new engine state..." },
  "summary": {},
  "product": null,
  "reason_codes": [],
  "dispense_authorized": false,
  "turns": 0,
  "elapsed_ms": 0
}
```

The browser never decides an outcome. It forwards `state` and renders what
comes back.

---

## 4. Kiosk server (`web/server.mjs`)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/`, `/*` | GET/HEAD | Static files under `web/` | none |
| `/api/tts` | GET | Piper availability per language | none |
| `/api/tts` | POST | Synthesise WAV through Piper, cache by SHA-256 | none |
| `/api/gemini-tts` | GET/POST | Gemini TTS (disabled when cloud is off) | none |
| `/api/understand` | GET/POST | Map an answer to an on-screen option | none |
| `/api/translate` | GET/POST | Translate customer-facing text | none |
| `/api/transcribe` | GET/POST | whisper.cpp transcription of an in-memory WAV | none |
| `/api/gemini-live-token` | GET/POST | One-use, five-minute Gemini Live token | per-IP token ceiling |

Limits that exist: 8 KB TTS body, 12 KB translation body, 4 MB understanding
body, text sanitation, 800-character TTS cap, 2 concurrent Piper processes,
spawn timeouts, atomic cache writes, path-traversal guard, `no-store`,
`nosniff`. Missing: authentication, rate limiting, CSP, TLS, cache eviction,
and a static-file allowlist (source files such as `server.mjs` are downloadable).

---

## 5. Decision engine

### 5.1 Intake and safety (`n8n/src/intake-and-safety-engine.js`)

- Steps: `symptom → age → duration → severity → warning_signs →
  pregnancy_breastfeeding → safety_background_status → allergy_status /
  allergy_terms → medication_status / medication_terms → condition_status /
  condition_terms → confirm`.
- `SUPPORTED_PATHWAYS = {pain_fever}` for real countries; `ZZ` exercises every
  pathway except `other`.
- `RED_FLAGS_BY_PATHWAY.pain_fever` includes meningitis/sepsis features, sudden
  severe headache, chest/breathing symptoms, fever > 39.5 °C, and
  immunosuppression/pregnancy.
- Early refusals: unsupported pathway, age < 18, duration > 7 days, severe
  severity, any red flag, pregnancy/breastfeeding/prefer-not-to-say, "not sure"
  on the history questions.
- Every response includes `turns`, `elapsed_ms`, `summary`, `reason_codes`,
  `dispense_authorized: false`.
- 30-turn cap; session id normalisation; 240-character text cap; 90-character
  list items, 12 items per list.

### 5.2 Product matcher (`n8n/src/catalog-decision.js`)

- Reads the Supabase node output defensively; on any read error returns
  `catalog_unavailable` with no product.
- Filters rows by pathway, country and language.
- Per product: minimum/maximum age, `maximum_duration_days`, allergy terms,
  contraindications, interaction rules, approved dose presence.
- Picks the first passing row by `display_priority`; otherwise returns a
  differentiated refusal (`age_outside_supported_range`,
  `symptom_longer_than_product_allows`, `all_products_blocked`).
- `dispense_authorized: false` always.

---

## 6. Workflows

| Workflow | ID | Nodes | Role |
|---|---|---|---|
| PILLPAL MedAssist - Supabase Safety Chat MVP | `CtomsWyOIBEuYrtX` | 9 | Customer safety path |
| PILLPAL MedAssist - Spoken Answer Understanding | `Tq1UTgrin8HYd9s6` | 10 | Optional Gemini answer mapper + status |

The safety workflow contains no `$env` access and binds credentials by id. The
repository JSON is byte-compared against `n8n/src` by
`scripts/check-workflow-drift.mjs`; `npm run check -- --live` compares the
deployed copy too.

---

## 7. Database

- 15 tables in migration `001`, plus `kiosk_outcome_log` in `007`.
- Two security-invoker views: `recommendable_products` (001) and
  `recommendable_product_pathways` (004).
- Enable trigger `enforce_product_safety_before_enable` requires an approved
  safety row and an approved pathway mapping before `chatbot_enabled = true`.
- RLS deny-all, grants to `service_role` only.
- `kiosk_outcome_log` stores: session hash, country, language, pathway, age
  band, duration, severity, outcome, reason string, turns, `elapsed_ms`,
  timestamp. No names, free text, symptom sentences or raw state.

Schema gaps are analysed in `DATABASE_GAP_ANALYSIS.md`.

---

## 8. Voice pipeline (as configured today)

```
microphone
  -> whisper.cpp ggml-base (server /api/transcribe)        [local]
     or browser SpeechRecognition                          [vendor cloud]
     or Gemini Live (code present, disabled)               [cloud]
  -> deterministic mapper (voice-input-mapper.js)          [local]
     -> optional understanding bridge/sidecar              [local model or Gemini]
  -> on-screen option value + confirmation read-back
  -> n8n deterministic engine                              [hosted]
  -> response text
  -> Piper en_US-hfc_female-medium (/api/tts)              [local]
     or Gemini TTS (disabled) / browser synthesis
  -> speaker
```

Barge-in is implemented as a user action (orb or microphone control) that stops
playback and starts listening. There is no acoustic echo cancellation, no
always-on voice activity detection across kiosk speakers, and no wake word.

---

## 9. Deployment topology and operations

- Local kiosk: `npm start` → `http://localhost:8080` (or LAN address).
- n8n: hosted instance; local `docker-compose.yml` is available but Docker is
  not installed on the audit machine.
- Supabase: hosted project; migrations are applied by pasting SQL in the
  dashboard (no CLI/migration runner configured).
- Deployment of engine changes: `npm run build:workflow` → API push or UI import
  → `npm run check -- --live`.
- No CI, no scheduled smoke test, no alert channel, no infrastructure as code.

---

## 10. Components the brief asks for that do not exist

| Component | Status |
|---|---|
| FastAPI service layer | absent |
| Local medicine catalogue / offline database | absent (Supabase only) |
| RAG / vector store / embeddings | absent |
| Alternative-medicine engine (levels 1–4) | absent |
| Fixed-dose-combination validator | absent |
| Regulatory-alert / recall service | absent |
| Vending inventory and controller | absent |
| Pharmacist review queue / human escalation | absent |
| Multi-agent orchestration | absent (two workflows, not services) |
| Per-device authentication / RBAC | absent |
| Telemetry dashboard | absent (raw log table only) |

These are roadmap items, not regressions. The existing deterministic core should
be preserved and reused rather than replaced.
