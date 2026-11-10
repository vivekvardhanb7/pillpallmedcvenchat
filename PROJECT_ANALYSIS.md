# PROJECT_ANALYSIS.md — Phase 0 audit (current state)

**Audit date:** 2026-11-05
**Repository:** `V:\LD Projects\PILLPALMEDVEN`
**Branch:** `master` — 2 commits (`6ab8374`, `d2b21ef`), no remote configured
**Scope:** read-only inspection plus non-destructive test runs. No source file was
modified for this phase.
**Companion documents:** `EXISTING_ARCHITECTURE.md`, `CURRENT_FEATURE_STATUS.md`,
`COMPETITOR_RESEARCH.md`, `OFFLINE_AI_RESEARCH.md`,
`MEDICAL_DATA_SOURCE_RESEARCH.md`, `MEDICAL_SAFETY_GAP_ANALYSIS.md`,
`VOICE_AGENT_GAP_ANALYSIS.md`, `DATABASE_GAP_ANALYSIS.md`,
`IMPLEMENTATION_ROADMAP.md`.

---

## 1. Executive summary

PILLPAL MedAssist is a **working kiosk prototype**, not yet the offline-first
multilingual pharmacy agent described in the master brief. It is a deterministic
symptom interview that ends in either a referral or a product that exists in an
approved Supabase catalogue. It never authorises dispensing
(`dispense_authorized: false` on every response).

What is genuinely strong:

- The clinical decision path is deterministic JavaScript, tested, and has no LLM
  in it. An optional model only maps a spoken answer onto an option already on
  the screen.
- The database enforces an enable-approval trigger, RLS deny-all for `anon` and
  `authenticated`, and a service-role-only catalogue view.
- The repository is dependency-free at runtime (Node 20+, no npm packages) and
  has nine automated suites that pass.
- A local voice loop works today: whisper.cpp speech recognition, deterministic
  answer mapping, Piper speech output, with fallbacks.

What the brief assumes but the repository does not contain:

| Brief assumption | Verified reality |
|---|---|
| React frontend | Vanilla ES-module JavaScript, no framework, no build step |
| Python / FastAPI backend | None. `web/server.mjs` is a plain Node HTTP server; the decision engine runs inside n8n Code nodes |
| Local LLM in the product | Disabled by default. Qwen3 1.7B failed multilingual safety-answer checks; Qwen3 4B exceeded latency on this laptop |
| Offline-first core | **No.** The kiosk, n8n and Supabase are three tiers; n8n is hosted. With the network down, no assessment can be completed |
| Medicine search beyond vending stock | Not implemented. There is one catalogue, one matcher, and no alternative / combination / regulatory engine |
| Multi-agent architecture | Two n8n workflows and deterministic code nodes, not independent services |
| Vending hardware control | Not implemented. Dispensing is explicitly out of scope |
| 60-language support | 60 entries in the dropdown, but only English and German UI dictionaries; product safety text is English-only; only an English Piper voice is installed |

The most urgent problems are **data integrity in the live demo catalogue**, not
missing features: an automated-test fixture and fifteen synthetic rows are
enabled and customer-reachable under the reserved `ZZ` country, several of them
displaying real medicine brand names with placeholder allergy text.

---

## 2. Verified stack

| Layer | Technology | Evidence |
|---|---|---|
| Kiosk UI | HTML + CSS + vanilla ES modules | `web/index.html`, `web/app.js` (2,358 lines), `web/styles.css` |
| Kiosk server | Node `node:http`, zero npm dependencies | `web/server.mjs` (928 lines), `package.json` |
| Decision engine | Deterministic JavaScript embedded in n8n Code nodes | `n8n/src/intake-and-safety-engine.js` (729 lines), `n8n/src/catalog-decision.js` (203 lines) |
| Workflow runtime | n8n, hosted at `n8n.naf-cloudsystem.de` | `docker-compose.yml`, `RUNBOOK.md` |
| Database | Supabase Postgres, PostgREST access from n8n | 10 migrations (`000`–`009`), `supabase/README.md` |
| STT | whisper.cpp `ggml-base` (installed), browser `SpeechRecognition` fallback, Gemini Live code (disabled) | `web/local-whisper-transcriber.js`, `web/gemini-live-transcriber.js`, `.env` |
| TTS | Piper `en_US-hfc_female-medium` (installed), Gemini TTS code, browser synthesis fallback | `tools/piper/`, `web/voice-assistant.js` |
| Answer understanding | Deterministic mapper first, optional Gemini / Ollama bridge or n8n sidecar | `web/answer-understanding.js`, `web/voice-input-mapper.js`, `n8n/understand-workflow.mjs` |
| Tests | Plain Node scripts, no framework | 19 scripts in `scripts/` |

Runtime present on the audit machine: Node 24.13.1, npm 10.8.2, Python 3.14.6,
**Docker CLI not installed** (the compose file exists but cannot run here).

---

## 3. Repository state at audit time

- **26 tracked files modified, uncommitted**, including almost the entire voice
  stack: `web/app.js` (+1,544 lines), `web/styles.css` (+1,370), `web/server.mjs`
  (+478), `web/i18n.js` (+406), `web/voice-assistant.js` (+399), engine and
  matcher changes, rebuilt workflow JSON, and many test changes.
- **20 untracked paths**, including `web/voice.html`, `web/voice-experience.js`,
  `web/gemini-live-transcriber.js`, `web/local-whisper-transcriber.js`,
  `web/question-intent.js`, `scripts/update-actual-medicines.mjs`,
  `supabase/migrations/008_demo_catalogue.sql`,
  `supabase/migrations/009_real_products_draft.sql`, `docs/`, `output/`,
  `PROJECT_INFORMATION.md`, and `VOICE_INTERFACE_IMPLEMENTATION.md`.
- `tools/` is entirely untracked: **98 MB Piper, 627 MB whisper.cpp, 7.9 MB zip**.
  `.gitignore` does **not** mention `whisper`, so `git add .` would commit the
  binaries. Free disk at audit: 34.6 GB on `C:`, 41.5 GB on `V:`.
- `web/config.js` and `.env` are correctly ignored. The kiosk secret is still
  shipped to the browser **by design** because `config.js` is a client asset.
- The historical plain-text secret in `PLAN.md` has been scrubbed in the current
  tree; only the environment-variable name remains. Rotation is still advisable
  if the repository was ever copied or shared.

---

## 4. Functional audit

### 4.1 Working

- Deterministic interview for the `pain_fever` pathway: symptom, age, duration,
  severity, pathway-specific red flags, pregnancy/breastfeeding, allergy,
  medication, condition, confirmation.
- Early refusal at the disqualifying answer (unsupported pathway, age < 18,
  > 7 days, severe, red flag, pregnancy, "not sure" history).
- State tampering resistance: the engine re-sanitises every echoed field and
  rejects an answer whose `question_id` does not match the current step.
- Product matching against the approved catalogue with age, duration, allergy,
  contraindication and interaction blocking. Conservative substring matching.
- Honest fallbacks: catalogue unavailable, no product for pathway, all products
  blocked, age-only block, duration-only block.
- Anonymous outcome logging to `kiosk_outcome_log` through PostgREST, with a
  failure that cannot block the customer.
- Startup self-check, config-change badge, inactivity reset, theme toggle,
  EN/DE interface translation, transcript, typed-answer path, medicine-name
  detection.
- Local TTS with caching and browser fallback; local whisper.cpp transcription;
  optional Gemini Live transcription and Gemini TTS code paths.

### 4.2 Incomplete

- Only `pain_fever` is clinically in scope for a real country
  (`SUPPORTED_PATHWAYS`). The other six menu entries produce a one-tap refusal in
  `MA`; the `ZZ` demo country exercises all six against synthetic rows.
- Red-flag lists exist only for `pain_fever`; other pathways fall back to a
  generic list.
- German voice output is degraded: no German Piper model is installed.
- `voice.html` static copy and `naturalVoiceQuestion()` are English-only.
- The 60-language selector is not backed by 60 dictionaries; translation of
  dynamic copy depends on a disabled Gemini/Ollama service.
- Product facts, doses and warnings are English-only; translated copy is not
  persisted and can vary per request.
- The outcome log has a prune function but no scheduled job. n8n execution data
  retention is unset, so transcripts can persist in n8n.
- No stock, price, pharmacy availability, vending inventory, or dispensing.

### 4.3 Broken or unsafe

1. **Synthetic fixture is live and enabled.** `ZZ-FIXTURE-TEST-500` is
   `chatbot_enabled = true`, `review_status = approved`, priority 40. Reproduced
   live: when real pain products are blocked by allergy, the engine returns
   `PRODUCT_ELIGIBLE` with the title `TEST FIXTURE PRODUCT`.
2. **Placeholder clinical text is shown to customers.** 15 of 16 enabled products
   still carry `demo ...` allergy terms. The DOLIPRANE result screen told the
   customer to avoid "paracetamol, acetaminophen, demo analgesic ingredient".
3. **Synthetic rows were renamed to real brands.** Migration `008` defines
   `DEMO ... (synthetic)` rows, but `scripts/update-actual-medicines.mjs` has
   rewritten the live rows to DOLIPRANE, BRUFEN, ZYRTEC and others, with real
   prices and doses, while retaining demo allergy terms and the reviewer string
   "Synthetic demo data - NOT clinical approval". The live table therefore
   claims `clinical_status=approved`, `legal_status=approved` and
   `review_status=approved` on records whose own reviewer says it is not an
   approval.
4. **Live journey tests accept opposite outcomes.** In
   `scripts/test-customer-journeys.mjs`, allergy, condition, interaction,
   duration and age cases all list both `PRODUCT_ELIGIBLE` and
   `NO_SUITABLE_PRODUCT` as acceptable live results (lines 117–155). That is how
   the fixture reached a "safe" test run.
5. **The local server serves its own source.** `serveStatic()` serves any file
   under `web/`, including `server.mjs` (HTTP 200). There is no CSP, no TLS, and
   `/api/tts`, `/api/transcribe`, `/api/understand` are unauthenticated on the
   LAN.
6. **Voice page clips on short viewports.** At 525×482 CSS pixels the premium
   stage overflows; the `max-height: 650px` media query only fixes the legacy
   `.voice-stage`.
7. **No offline core.** The kiosk still calls a hosted n8n webhook and n8n calls
   Supabase. Disconnecting the internet stops the assessment. "Local voice mode"
   only removes Gemini, not the network dependency for decisions.

### 4.4 Duplicate or confusing implementations

- Two answer-understanding routes (kiosk `/api/understand` and n8n sidecar) with
  the same contract. Intentional, but doubles the privacy and configuration
  surface.
- Three speech-output paths (Piper, Gemini TTS, browser synthesis) and three
  speech-input paths (whisper.cpp, browser recognition, Gemini Live). Only one
  of each is enabled in the current `.env`.
- `archive/` holds two superseded LLM-era workflows. They must never be imported.
- `project_documentation/PROJECT_ANALYSIS.md` (2026-11-03) and this Phase 0
  document describe different points in time; the older one is historical.

### 4.5 Paid / external dependencies

- **No mandatory paid API.** The active path needs only the local server, hosted
  n8n and Supabase.
- Gemini is optional and currently disabled (`PILLPAL_AI_PROVIDER=off`,
  `GEMINI_CLOUD_ENABLED=0`, `GEMINI_LIVE_TRANSCRIBE=0`).
- Browser speech recognition may call the browser vendor's cloud service.
- n8n and Supabase are self-hostable, but the current deployment is hosted;
  cost and data-residency terms were not verified in this phase.

### 4.6 Missing safety mechanisms

Detailed in `MEDICAL_SAFETY_GAP_ANALYSIS.md`. Summary: no dose-limit
enforcement, no duplicate-ingredient detection, no renal/hepatic or
drug-specific contraindication model, no prescription-status check, no recalls or
regulatory alerts, no pharmacist-review queue, no emergency contact/location
hand-off, no structured adverse-event capture, and no evidence that the red-flag
lists are clinically reviewed.

### 4.7 Performance observations

Measured earlier in this project, on this laptop:

| Measurement | Result |
|---|---|
| Whisper `ggml-base`, clean sentence | ~2.5 s |
| Whisper `ggml-small`, same sentence | ~11.3 s (not enabled) |
| Piper cached fixed prompt | ~0.03 s |
| Gemini Live one-use token | ~0.77 s |
| Hosted answer understanding | ~0.9–1.5 s; one request ~8.8 s |
| Gemini TTS / translate | disabled locally |

No end-to-end p50/p95 latency or RAM profile exists for a full 11-turn
assessment, and no load test exists for concurrent kiosks. TTS synthesis is
limited to two concurrent processes and the cache has no size cap.

### 4.8 Security and privacy

Strong: RLS deny-all, service-role only on the server, header-authenticated
webhook, three-layer input validation, HTML escaping, no runtime npm
dependencies, transcript held in page memory only, anonymised outcome log with
age bands.

Weak: shared secret readable in the browser bundle, no rate limiting, no TLS on
the kiosk origin, unauthenticated LAN APIs, no CSP, server source downloadable,
no operator authentication, no audit log for configuration changes, n8n
execution data may retain health transcripts, and sending a symptom to Gemini is
a personal-data transfer that needs a legal position for Morocco/EU.

### 4.9 Integration problems

- The UI import path in n8n strips Supabase node parameters; the project works
  around this with the API push and an HTTP Request insert.
- The deployed workflow can drift from `n8n/src`; the drift check catches it, but
  deployment is still manual.
- No CI, no scheduled watchdog, no alert channel.
- `scripts/audit-catalog.mjs` reports "no blockers" for the synthetic fixture
  and the renamed demo rows, because it checks approval fields, not provenance.

---

## 5. Verification executed in this phase

| Command / check | Result |
|---|---|
| `npm test` (9 suites) | **PASS** — engine, answer understanding, sidecar nodes, i18n, voice mapper, voice lifecycle, Gemini Live transport, premium interface contract, workflow drift (9 nodes, no `$env`, credentials bound) |
| `npm run test:journeys` (offline) | **52/52 PASS** (run earlier in the same audit session) |
| `npm run test:journeys:live` | **36/37 PASS, 1 skipped** |
| `npm run test:product-path` | **PASS** (eligible + allergy-blocked) |
| `npm run test:ai:sidecar` | **19/19 PASS** |
| `npm run audit:catalog` | 62 products, 16 enabled (all `ZZ`), 46 disabled, 16 warnings about external leaflet hosts, 0 blockers *by its current rules* |
| Live kiosk walkthrough | Full assessment reaches a product screen; webhook 200, TTS 200, console clean |
| Live upload / error probes | Whisper transcript correct; bad audio 400; disabled services 503; path traversal 404 |
| Live catalogue probe | 16/16 enabled rows have `clinical/legal/review = approved`; 15/16 have `demo ...` allergy terms; fixture enabled at priority 40 |
| Browser viewport probe | Voice page overflows at 525×482 |

Not executed in this phase: physical microphone/speaker tests, real Darija /
French / Telugu speech accuracy, load tests, Supabase RLS probes from an
attacker role, n8n execution-data inspection, vending hardware.

---

## 6. Phase 0 exit criteria

Phase 0 is complete when this document set exists and the following are agreed:

1. The authoritative architecture is the one in `EXISTING_ARCHITECTURE.md`, not
   the Python/FastAPI assumption in the brief.
2. The P0 data issues are accepted as blockers for any customer-facing demo.
3. The offline-first requirement is understood as a **new architecture**, not a
   configuration flag.
4. Phase 1 research and Phase 2 model selection are authorised before any
   feature work.
