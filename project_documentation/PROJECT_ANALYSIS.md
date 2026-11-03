# PROJECT_ANALYSIS.md — PILLPAL MedAssist MVP

**Date:** 2026-11-03 · **Mode:** Phase 1 read-only analysis (no source files modified)
**Repo:** `V:\LD Projects\PILLPALMEDVEN` · **Git:** yes — baseline commit `d2b21ef`, 9 uncommitted modified files (see §13)

---

## 1. Executive summary

PILLPAL MedAssist is a **touchscreen medical vending-machine assistant (kiosk)** targeted at Moroccan pharmacies. It performs a deterministic, safety-first intake interview and, when every clinical gate passes, shows approved products from Supabase. It **never authorises dispensing** (`dispense_authorized: false` on every response) and **never uses an LLM** in the safety/eligibility/product path (a documented, enforced invariant).

The stack in the codebase differs from what was described in the request:

| Requested | Verified actual implementation |
| --- | --- |
| Frontend: **React** | **Vanilla JavaScript ES modules** (`web/*.js`), no framework, no bundler, no `node_modules` runtime deps |
| Backend: Supabase | Supabase **Postgres via migrations only** — no Supabase client JS, **no Supabase Auth usage**, REST access only from n8n (service role) and local audit scripts |
| Automation: n8n | Yes — workflow generated from source by `n8n/build-workflow.mjs`, deployed self-hosted at `n8n.naf-cloudsystem.de` |
| Third-party APIs | **None in the active path.** Voice is local Piper TTS. The only external calls are n8n → Supabase REST. (Archived legacy workflows used a Gemini LLM; they are superseded and must not be imported.) |

The project is in a **late MVP, pre-clinical-pilot state**: the live Morocco product catalog is deliberately empty, and the only matchable product is a synthetic `ZZ` test fixture.

---

## 2. Verified technology stack

| Layer | Technology | Version / detail |
| --- | --- | --- |
| Frontend | Vanilla JS ES modules, HTML, CSS | No framework, no build step |
| Kiosk server | Node 20+ plain `node:http` (`web/server.mjs`) | Zero npm dependencies |
| Backend | Supabase Postgres | 8 SQL migrations (000–007) |
| Automation | n8n (self-hosted) | Webhook + Code nodes + Supabase nodes; Dijkstra-style deterministic engine |
| TTS | Piper (local neural TTS, `tools/piper/`) | Windows binary + `en_US-hfc_female-medium` model; German model **not installed** |
| STT | Browser `SpeechRecognition` (Chrome/Edge) | English + German mapping to controlled values |
| Tests | Plain Node scripts (`scripts/*.mjs`) | Engine, i18n parity, voice mapper, drift check, 49 journey checks, live smoke/journey/product-path, catalog audit |
| Container | docker-compose for local n8n | `N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"` (see §11) |

---

## 3. Project structure

```
PILLPALMEDVEN/
├── .env ¹                    # live SUPABASE_URL / service-role key / webhook URL+secret / Piper paths (gitignored)
├── .env.example              # placeholders only
├── .gitignore                # covers .env, web/config.js, node_modules, tools/piper, tmp/, outputs/
├── docker-compose.yml        # self-hosted n8n + env passthrough
├── package.json              # scripts only, zero runtime dependencies
├── README.md                 # product + setup documentation
├── PLAN.md                   # prior improvement plan w/ known-issues table (I1–I13) and tasks T1–T26
├── RUNBOOK.md                # operator manual (updated in working tree, uncommitted)
├── NAF_…Research.md          # research source documents (context)
├── PILLPAL_…Research.md
├── archive/                  # 2 superseded LLM-era n8n exports — reference only, never import
├── n8n/
│   ├── build-workflow.mjs    # deterministic workflow builder (embeds src/*.js as Code nodes)
│   ├── src/
│   │   ├── intake-and-safety-engine.js   # the interview state machine (634 lines)
│   │   └── catalog-decision.js           # deterministic product matcher (196 lines)
│   └── workflows/…json       # built artefact (8 nodes, drift-verified identical to src)
├── supabase/
│   ├── README.md             # schema usage + safe product-enablement procedure
│   └── migrations/000…007    # schema, seed, question templates, catalog view, ZZ fixture, reset, outcome log
├── scripts/                  # 9 test/audit/smoke scripts (no dependencies)
├── tools/piper/              # Piper runtime + voices (gitignored)
├── tmp/                      # TTS WAV cache + scratch (gitignored)
├── outputs/                  # research data template (xlsx + pngs)
└── web/
    ├── index.html            # single-page kiosk shell (theme boot script, aria labels)
    ├── app.js                # 964-line kiosk controller (state, render, fetch, watchdog)
    ├── config.example.js     # template (safe)
    ├── config.js             # LIVE instance config incl. webhook secret (gitignored)
    ├── i18n.js               # EN/DE string tables + localization engine + language detection
    ├── voice-assistant.js    # Piper/browser speech queue, recognition wrapper
    ├── voice-input-mapper.js # free text → controlled answer codes (EN/DE)
    ├── medicine-mentions.js  # brand-name dictionary ("I need Dolo", …)
    ├── styles.css            # dark/light pharmacy-green design system (~21 KB)
    └── server.mjs            # static server + POST /api/tts proxy to Piper
```

¹ Key names verified only; values never recorded in this documentation.

---

## 4. Frontend architecture

### 4.1 Module graph

```
index.html
  ├─ <script src="./config.js">            (global: window.PILLPAL_CONFIG; gitignored, holds secret)
  └─ <script type="module" src="./app.js"> (entry point)
        ├─ voice-assistant.js   (speech queue: Piper → /api/tts, fallback browser TTS/STT)
        ├─ voice-input-mapper.js(normalizeSpeech, spokenNumber, resolveVoiceAnswer)
        ├─ medicine-mentions.js (detectMedicineMention → controlled keys)
        └─ i18n.js              (LANGUAGES, STRINGS en/de, t/tn, localizeScreen/Result/Summary,
                                  translateWorkflowMessage, detectLanguage)
```

### 4.2 Data flow (one conversational turn)

```
customer tap/voice/typed input
  → resolveVoiceAnswer/clarification/confirmation gates (app.js)
  → POST {webhookUrl}  headers: Content-Type text/plain + X-PILLPAL-Auth: <secret>
     body: { session_id, country_code, language_code, reset, state: previousState, answer }
  → n8n Intake engine (validates everything again; never trusts client state)
  → response { outcome, screen, state, summary, ... }
  → app.js render() → DOM (escapeHtml everywhere) + voice.speak() + transcript append
  → state kept ONLY in memory (`current`), and echoed back to the server next turn
```

Key properties:

* **Stateless backend, state-in-browser** — the engine re-sanitises `payload.state` on every call (`sanitizeState`), so tampering cannot skip gates (journey tests #41–#44 prove it).
* **State lives only in the page** — inactivity watchdog (default `120000 ms`) clears the session for privacy; transcript is in-memory only.
* **All dynamic text is HTML-escaped** (`escapeHtml`) before insertion; free-text answers are stripped/truncated by the engine before they can be echoed back.
* **Startup probes** — `runStartupSelfCheck()` posts one authenticated probe turn at boot and shows an operator-only badge on failure (401/403 vs network/5xx wording are differentiated). A config watcher re-fetches `/config.js` every 60 s and shows a "config updated — reload" badge when it changes.
* **i18n** — EN default, DE second. Language auto-detection from typed/voiced text switches the UI mid-session. Question titles/options/summaries/errors are localized; product data from Supabase stays verbatim.

### 4.3 UI/UX design system

* `styles.css`: CSS-variable theming — dark (default) / light theme with pharmacy-green accent, `prefers-color-scheme` fallback before first choice, stored in `localStorage` under `pillpal-theme`; animated canvas voice visualizer with `prefers-reduced-motion` support.
* Four-stage progress indicator (Symptoms → Safety → History → Review) driven by `question_id`.
* Components: start stage, question card, confirmation strip, chat composer (repeat button, text input, send), transcript panel with role avatars, result/product cards, theme + mute + language controls, operator badge (press-to-dismiss).
* All controls with dynamic labels use `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`; live regions `aria-live` used for assessment/transcript/confirmation.

---

## 5. Kiosk local server (`web/server.mjs`)

| Concern | Implementation |
| --- | --- |
| Static files | Whitelist content types, path traversal guard (resolve + prefix check), `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` |
| `/api/tts` GET | Returns per-language Piper availability (`{available, binary, model, config, models}`) |
| `/api/tts` POST | Text sanitized (control chars removed, 800-char cap), 8 KB body cap, language availability check → 503 `tts_language_unavailable`, concurrency cap (2 running / 8 queued busy → 503), SHA-256 cache key in `tmp/tts-cache`, atomic `.tmp → rename` writes, spawn timeout 20 s (configurable) |
| Piper runtime | `tools/piper/piper.exe`, models from `PIPER_MODEL` / `PIPER_MODELS` env, `PIPER_LENGTH_SCALE`, warm-up synthesis on boot |
| Binding | `0.0.0.0:8080` (LAN-exposed, unauthenticated — by design for a kiosk, see security review) |

---

## 6. Supabase architecture

### 6.1 Schema (migrations 000–007)

| Migration | Contents | Status |
| --- | --- | --- |
| `000_catalog_prerequisites` | Bootstrap `countries`, `products` (recovery step; SQL Editor partial-selection guard documented) | Safe bootstrap |
| `001_medical_chatbot_schema` | Full schema: `countries`, `products`, `product_safety`, `symptom_pathways`, `questions`, `ui_messages`, `clinical_rules`, `product_pathways`, `rule_products`, `chat_sessions`, `session_answers`, `chat_events`, `decisions`, `decision_products`, `decision_rule_results`; `set_updated_at` triggers; enable-approval trigger `enforce_product_safety_before_enable`; indexes; security-invoker view `recommendable_products`; RLS enabled on all 15 tables + views; **revoke all from anon/authenticated; grants to service_role only** | Core |
| `002_research_seed` | MA country + 4 draft/disabled Morocco research products (Doliprane, Brufen, Imodium, Zyrtec) + 7 disabled draft English symptom pathways + 4 inactive UI messages | Research only, disabled by design |
| `003_inactive_question_templates` | 7 general intake question templates (all `active=false`), cross-joined per MA pathway | Inactive by design |
| `004_n8n_catalog_api` | `recommendable_product_pathways` view (security_invoker): approved products × approved pathways × enabled/approved pathways only; select for service_role only | The single thing the workflow reads |
| `005_product_path_test_fixture` | Isolated `ZZ` country: enabled synthetic pathway + TEST FIXTURE PRODUCT with full approved safety record + approved pathway mapping → exercises `PRODUCT_ELIGIBLE` and blocking paths | Test only; cannot appear in MA traffic |
| `006_reset_research_catalog` | Reverts any manual enablement of MA products (disabled/draft, no label) with a verification query that must return zero rows | Safety reset |
| `007_outcome_log` | `kiosk_outcome_log`: anonymised counters (session key, country, language, pathway, age **band**, duration, severity, outcome, reasons string ≤500, turns, elapsed_ms); RLS enabled no policies; insert/select to service_role only; `prune_kiosk_outcome_log(90)` function | Live: n8n writes 1 row per finished assessment |

### 6.2 Safety guarantees enforced in the database

* A product cannot be set `chatbot_enabled = true` unless: `market_status='commercialised'` ∧ clinical∧legal approved ∧ label URL+version present (CHECK constraint) **and** an approved `product_safety` row with indications/dose/source **and** an approved `product_pathways` mapping (trigger).
* The kiosk never talks to the database; only n8n's service-role connection reads the catalog view and writes to the log table.
* Real Morocco medicines remain disabled until documented clinical/legal review (README "Current boundary" + RUNBOOK invariants).

### 6.3 Data that exists but is unused (documented decision)

`chat_sessions`, `session_answers`, `chat_events`, `decisions`, `decision_products`, `decision_rule_results`, `ui_messages` are created but written by nothing. `decisions.outcome`'s CHECK constraint cannot even store `CATALOG_CHECK_REQUIRED`. Migration 007's comment records that `kiosk_outcome_log` is the intended (privacy-narrow) log; `ui_messages` is kept in reserve for a possible editor-driven copy pipeline.

### 6.4 Row Level Security posture

Every table: `enable row level security` + **no policies** + revoke from `anon, authenticated` → deny-all except `service_role`. This is a strong, correct posture for a system with no first-party browser client: verified no Supabase Auth is configured and no anon key appears in any code or config. Frontend has no Supabase client at all.

---

## 7. n8n workflow architecture

### 7.1 Node graph (`n8n/workflows/PILLPAL_MedAssist…json`, verified 8 nodes, matches src byte-for-byte)

```
Chat Turn Webhook (POST /pillpal-chat-turn, headerAuth, credential "Backend Service Auth Medtest")
  → Intake and Safety Engine (Code node, embedded from n8n/src/intake-and-safety-engine.js)
  → Needs Approved Product Catalog?  (IF $json.needs_catalog)
      ├─ false → Return Touchscreen Response (respond 200, ACAO *, no-store, nosniff)
      └─ true  → Load Approved Products from Supabase (Supabase node, retry ×2 / 1s,
                 onError continueRegularOutput, alwaysOutputData, credential "PILLPALL CHATBOT")
                 → Deterministic Product Matcher (Code node, embedded from n8n/src/catalog-decision.js)
                 → Return Touchscreen Response
  → Assessment Finished? (IF outcome ≠ MORE_INFORMATION)
      └─ true → Log Outcome (anonymised) (Supabase insert into kiosk_outcome_log,
                onError continueRegularOutput — logging can never break the customer)
```

### 7.2 Intake engine behaviour (`intake-and-safety-engine.js`, includes uncommitted working-tree changes)

* Steps: `symptom → age → duration → severity → warning_signs → pregnancy_breastfeeding → allergy_status → allergy_terms? → medication_status → medication_terms? → condition_status → condition_terms? → confirm → evaluate → catalog`.
* **Question-mismatch guard**: an answer must carry the `question_id` the state currently expects; anything else is rejected.
* **Early refusals at the disqualifying question** (working tree): unsupported pathway `other` → 1 tap; non-serviced category → 1 tap (`SUPPORTED_PATHWAYS` currently `{pain_fever}`); >7 days → tap 3; severe → tap 4; warning sign yes/not-sure → tap 5; pregnant/breastfeeding/both/prefer-not-to-say → tap 6; not-sure history → taps 7–9.
* **Pathway-specific red flags** (working tree): the generic warning-sign list was replaced by a pain/fever alarm list (meningitis/sepsis features, sudden severe headache, fever >39.5 °C, immunosuppression/pregnancy), passed to the screen as `red_flags` plus `pathway_code` so i18n can localize it.
* Honest summary (`Not asked` for untouched fields), `turns` + `elapsed_ms` in every response, 30-turn session cap, session-id normalization, text sanitization/truncation everywhere.

### 7.3 Product matcher (`catalog-decision.js`, includes uncommitted working-tree changes)

* Reads the Supabase node output defensively (error object / REST wrapper / array / items) → `catalog_unavailable` fallback with **no product** on any failure.
* Filters by pathway / country / language (pathway row language). No rows → `no_approved_product_for_pathway`.
* Per-product safety reasons: below minimum age, above maximum age, **symptom longer than the product's `maximum_duration_days`** (new), allergy/condition/interaction term conflicts (bidirectional substring match on normalized text — conservative by design), missing approved dose.
* Selects the first passing product by `display_priority`, else differentiated refusals: age-only → `age_outside_supported_range`; duration-only → `symptom_longer_than_product_allows` with the approved window; otherwise `all_products_blocked` — always with an anonymised `system_detail` array for operators.
* Every response keeps `dispense_authorized: false`.

### 7.4 Workflow reliability measures (verified in builder + drift check)

| Measure | Implementation |
| --- | --- |
| Auth | n8n `headerAuth` on the webhook — rejected **before** any node runs; no `$env` lookup anywhere (drift check fails the build if `$env` appears) |
| Retry | Supabase read node `retryOnFail ×2, wait 1000 ms` |
| Failure containment | Read failure → matcher renders `catalog_unavailable` refusal; log failure → `onError: continueRegularOutput` |
| Duplicate execution prevention | Stateless turn API keyed on `session_id`; each completed assessment inserts exactly one log row after the customer response; webhook is a single production path (imported superseded workflows stay in `archive/`) |
| Drift prevention | `scripts/check-workflow-drift.mjs` compares embedded Code-node JS against `n8n/src`, asserts headerAuth + bound credentials + no `$env` + log node present; `npm run check` wired into `npm test` |
| Credential binding | Builder pins the instance credential names/IDs (Header Auth `Backend Service Auth Medtest`, Supabase `PILLPALL CHATBOT`), so re-imports arrive bound |

---

## 8. API / integration map

| Caller → Callee | Protocol | Auth | Notes |
| --- | --- | --- | --- |
| Browser → `web/server.mjs` | HTTP (static + `/api/tts`) | none (LAN) | `X-Content-Type-Options`, `no-store`; TTS body caps |
| Browser → n8n webhook | HTTPS POST | `X-PILLPAL-Auth` header | CORS `Access-Control-Allow-Origin: *` on responses |
| n8n → Supabase REST | HTTPS | service-role key in n8n credential | Read: `recommendable_product_pathways` (getAll); Write: insert `kiosk_outcome_log` |
| scripts → Supabase REST | HTTPS | service-role key from `.env` | read-only audit |
| scripts → n8n | HTTPS | same header secret | smoke / journeys live / product-path |
| Browser ↔ Piper | local process via server | n/a | No raw audio ever sent to n8n |

No third-party SaaS APIs are used in the active path. The vendor speech-recognition browser service is the only cloud-dependent input, with full touch fallback.

---

## 9. Existing features and implementation status

| Feature | Status (verified) |
| --- | --- |
| Deterministic intake interview + safety gates | ✅ implemented, 49/49 offline journeys pass |
| Pathway scope gating (1-tap refusals) | ✅ implemented in working tree (uncommitted) |
| Pathway-specific red flags (pain_fever) | ✅ implemented in working tree (uncommitted) |
| Product catalog match + age/duration/allergy/interaction blocking | ✅ implemented (working tree) |
| Catalog-empty refusal (`no_approved_product_for_pathway`) | ✅ verified live (MA catalog intentionally empty) |
| Anonymised outcome logging | ✅ implemented (007 + Log Outcome node); prune is manual |
| Operator startup self-check + config watcher badges | ✅ implemented |
| Theme (dark/light), EN/DE i18n + auto-detect, progress indicator | ✅ implemented |
| Piper TTS EN (+ cache + warm-up), browser fallback, DE model **not installed** | ✅ partial — German falls back to text via an honest UI notice |
| Voice input mapping (EN/DE) to controlled values with confirmation gates | ✅ implemented (tested) |
| Typed chat incl. clarification heuristics and medicine-mention routing | ✅ implemented |
| Evaluate live catalog audits (blockers/language coverage) | ✅ implemented; current state: 5 products, 1 enabled (ZZ fixture), no blockers, 1 warning |
| Webhook auth + CORS + no `$env` | ✅ implemented; live smoke 8/8 PASS |
| HTTPS kiosk origin, per-device tokens, kiosk browser hardening, scheduled watchdog | ❌ not implemented (PLAN T19–T21, T16) |
| Stock/price, storage-hosted leaflets, dispensing | ❌ explicitly out of scope for this phase |

---

## 10. Verification I actually executed in this phase (results, not claims)

| Command | Result |
| --- | --- |
| `npm test` (engine + i18n + voice mapper + drift) | ✅ all pass — "Workflow JSON matches n8n/src (8 nodes, no $env, all credentials bound)" |
| `npm run test:journeys` (offline) | ✅ **49/49 PASS** |
| `npm run smoke:live` (production webhook) | ✅ **8/8 PASS** — auth rejected without header, accepts secret, walks 3 questions, `dispense_authorized:false` |
| `npm run audit:catalog` (live Supabase REST) | ✅ Products: 5 total / 1 enabled / 4 disabled; language coverage `ZZ/pain_fever: en`; **0 blockers**; 1 warning (external leaflet host on the ZZ fixture) |
| `git status` / `git diff` | 9 files modified, uncommitted (see §13); working tree = verified state, tests green |

Not executed (deferred to Phase 5 per the plan): `test:journeys:live`, `test:product-path`, browser-based kiosk walkthrough, manual Supabase RLS probes.

---

## 11. Environment & configuration

* `.env` (gitignored, contents verified by key name only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PILLPAL_WEBHOOK_URL`, `PILLPAL_WEBHOOK_SECRET`, `PIPER_BIN`, `PIPER_MODEL` → all live operator tooling works.
* `.env.example`: placeholders only. `web/config.js` (gitignored): live webhook URL + secret + country/language + voice prefs. `web/config.example.js`: safe template.
* `docker-compose.yml` passes `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`N8N_ENCRYPTION_KEY` into n8n and mounts workflow files read-only. Note: `N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"` locally diverges from the production instance's tighter posture (which blocks `$env`); harmless today because the workflow contains no `$env` (drift-checked) but worth aligning.

---

## 12. Identified bugs and issues

Existing issues from the project's own `PLAN.md` (I1–I13) were partially resolved in code/working tree; the outstanding ones are below, plus findings from this analysis. Evidence refs are file:line or live checks.

### Outstanding issues (still true)

| ID | Severity | Issue | Evidence |
| --- | --- | --- | --- |
| A1 | **Critical** | A verified, tested improvement set is **uncommitted** (9 files). Losing the worktree loses the work; the deployed workflow may already lag the working tree until the JSON is re-imported in n8n | `git status` → M `n8n/src/*`, `n8n/workflows/*.json`, `scripts/*`, `web/i18n.js`, `RUNBOOK.md` |
| A2 | **High** | The kiosk shared secret is printed as a literal in **committed** `PLAN.md` (§12 verification runbook) — 2 occurrences in `HEAD`. `web/config.js` is gitignored correctly, but the doc copy means the repo already leaks the secret | `git show HEAD:PLAN.md \| grep` — 2 matches; RUNBOOK §6 already mandates rotation before adding a remote |
| A3 | High | Romanised secret: the current credential value is short and dictionary-derived ("the project name" per PLAN I12); combined with `Access-Control-Allow-Origin: *` and no rate limiting, scripted abuse of the webhook/log is cheap | PLAN I12; workflow response headers; no rate-limit layer exists at any level |
| A4 | High | No scheduled live watchdog: `smoke:live` exists, but nothing runs it periodically (PLAN T16 incomplete). Silent breakage is discovered by customers (exactly what happened per PLAN baseline) | No cron/Task-Scheduler artefact in repo |
| A5 | Medium | TTS cache grows without bound — `tmp/tts-cache/<sha256>.wav` files are never evicted or size-capped; a long-lived kiosk (or LAN scripts hitting `/api/tts`) can fill the disk | `server.mjs` `synthesize()` — cache has no eviction, `/api/tts` is unauthenticated |
| A6 | Medium | Kiosk server exposes no security headers beyond `nosniff`, no CSP; kiosk origin is HTTP (not HTTPS), so microphone permission reliability + integrity on LAN aren't guaranteed (PLAN T20/T21 untouched) | `server.mjs` headers; README §4 note |
| A7 | Medium | German kiosk has no Piper model (`.env` comment: only English installed). Code now handles it honestly (text-only fallback + availability probe), but German voice UX remains degraded (PLAN M4 outstanding) | `audit` of README §4; i18n fallback logic |
| A8 | Medium | Language coverage gap is a **product** gap: matcher is per-pathway-language and Morocco has only `en` pathway rows; a German customer on MA can never see a product. Audit flags it, but enabling DE rows is a clinical/legal decision | `audit:catalog` output `ZZ/pain_fever: en`; `catalog-decision.js` language filter |
| A9 | Medium | Product matcher conflict rules use bidirectional **substring** matching on normalized strings — conservative (safe) but can over-block on generic terms and cannot expand abbreviations/misspellings | `catalog-decision.js` `conflicts()` |
| A10 | Low | `spokenNumber()` sums every number word it finds ("two ten" → 12) instead of taking the most plausible age; typed digits are fine, but odd voice input can produce a wrong age within range | `voice-input-mapper.js` `spokenNumber()` |
| A11 | Low | `elapsed_ms` depends on client-supplied `started_at_ms` (sanitized only to ≤ now); measured times are client-clocked (fine for analytics, not for SLA claims) | engine `responseBase`, matcher `timing()` |
| A12 | Low | Dead schema: `chat_sessions`/`session_answers`/`chat_events`/`decisions`(+products/rules)/`ui_messages` exist but are unwritten; `decisions.outcome` CHECK cannot store `CATALOG_CHECK_REQUIRED`. Documented tradeoff (007 comments) — needs a decision (wire up vs drop) | migration 001 + 007 comments |
| A13 | Low | `docker-compose.yml` sets `N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"`, diverging from production's blocked-`$env` posture. The drift check keeps the JSON clean, so impact is nil — align for least privilege | docker-compose.yml:15 |
| A14 | Low | No favicon (404 noise on every kiosk boot), no `lint`/`typecheck` scripts, no CI — optional hardening for a zero-dependency repo | `index.html`; `package.json` |
| A15 | Info | Loading states etc. are solid; no `console.error` noise in normal flow (browser console will be verified in Phase 5); single-page app intentionally re-renders whole app container per turn (fine at this DOM size) | `app.js` |

### Resolved in working tree (countervidence)

PLAN I1 (honest failure copy — `connectionHintKey()`), I2 (config watcher), I3 (startup self-check badge), I4 ("Not asked" summary), I5 (early refusals), I6 (age-specific message), I7 (TTS fallback), I8 (language-coverage audit), I9 (outcome log + insert node), I11 (credential binding), I13 (`.env` now populated) are addressed; I10 resolved earlier (`d2b21ef` baseline; repo is git-tracked).

---

## 13. Uncommitted working tree (exact contents)

| File | Change summary |
| --- | --- |
| `n8n/src/intake-and-safety-engine.js` | `SUPPORTED_PATHWAYS` gating; `GENERIC_RED_FLAGS`/`RED_FLAGS_BY_PATHWAY` (pain_fever-specific); `screenFor(...pathwayCode)`; 1-tap refusals for non-serviced categories |
| `n8n/src/catalog-decision.js` | `maximum_duration_days` enforcement; duration-only refusal message; detail refactor |
| `n8n/workflows/…json` | Rebuilt from the changed sources (drift-verified identical) |
| `web/i18n.js` | EN/DE keys for the new red-flag subtitles + `pathwayNotServiced`/`symptomTooLong` messages; pathway-aware `localizeScreen`; reason-code map entries |
| `RUNBOOK.md` | Invariants + "Widening the symptom menu" procedure + 49-journey count |
| `scripts/test-n8n-engine.mjs`, `test-customer-journeys.mjs`, `test-i18n.mjs`, `audit-catalog.mjs` | Updated/new expectations (49 journeys) |

**Implication:** the MSC (most important next step) is to commit this verified state, re-import the JSON in n8n (manual M2) and re-run `smoke:live` — otherwise deployed behaviour and repo truth diverge again (the exact failure class the drift check was built for).

---

## 14. Frontend ↔ Supabase ↔ n8n compatibility summary

* The frontend is fully decoupled from Supabase (no client, no key). Changing Supabase credentials affects only n8n + audit scripts.
* The engine/matcher contract is `state`-forwarding JSON; schema changes to `screen`/`state` shape are backward-guarded by `sanitizeState` and i18n fallbacks (`tn(key, lang, fallback)`).
* The outcome log schema (007) matches the Log Outcome node's column mapping exactly (`reasons` string vs `reason_codes` array conversion included).
