# IMPLEMENTATION_ROADMAP.md

**Date:** 2026-11-05
**Basis:** the verified Phase 0 audit. This roadmap replaces the generic phase
list with work that fits the actual codebase.

**Guiding rule:** keep the deterministic safety core. Add capability around it,
never inside it.

---

## 1. Where the project is

| Area | Readiness |
|---|---|
| Deterministic interview and product blocking | Working, tested |
| Live catalogue data | **Not trustworthy** (fixture + demo placeholders) |
| Real Morocco catalogue | Drafted, disabled, unsigned |
| Voice (English) | Working locally; hardware untested |
| Multilingual voice/UI | Mostly absent |
| Offline core | Absent |
| Alternatives / combinations / regulatory alerts | Absent |
| Security hardening | Partial |
| Clinical validation | Not performed |

The project is a strong **pre-clinical prototype**, not an MVP for customers.

---

## 2. Phase plan

### Phase 0 — Audit and documentation ✅ complete

Deliverables: the ten documents in `project_documentation/phase0/`.
No source code changed.

**Exit gate:** the owner accepts the audit and the P0 data findings.

---

### Phase 1 — Research completion (next)

| Task | Output | Effort |
|---|---|---|
| Verify OneDose / Pharmacy1st.ai first-party | Notes in `COMPETITOR_RESEARCH.md` | S |
| Confirm Infermedica/Ada developer details | Notes | S |
| Licence matrix for every dataset and model | Table in `MEDICAL_DATA_SOURCE_RESEARCH.md` / `OFFLINE_AI_RESEARCH.md` | M |
| Decide primary languages (FR, Darija, MSA, EN, DE, HI, TE) | Written decision | S |
| Document Morocco/EU privacy position for cloud audio/text | Legal note | M |

**Exit gate:** no unverified vendor claim remains as fact; language scope is
signed off.

---

### Phase 2 — Hardware and model selection

| Task | Output | Effort |
|---|---|---|
| Run the benchmark plan in `OFFLINE_AI_RESEARCH.md` | `MODEL_BENCHMARK_RESULTS.md` | M |
| Test MedGemma 4B / Qwen3 4B as understanding-only | Accept/reject with numbers | M |
| Test French/Arabic/German Piper voices | Listening results | S |
| Verify disk and RAM budget on the kiosk | Compatibility report | S |

**Exit gate:** a model and voice list that fits 5 GB RAM and meets latency.
**Do not download > 4 GB without confirming free disk.**

---

### Phase 3 — Offline-first architecture (largest change)

Recommended option: **extract the deterministic engine into a shared module and
run it locally**, while keeping n8n as an optional online orchestrator.

```
shared engine module
  ├─ n8n Code node (current deployment)
  └─ local Node runner in web/server.mjs
        + local catalogue snapshot (SQLite or JSON, versioned)
        + local outcome queue (SQLite)
        + sync process when online
```

| Task | Output | Effort |
|---|---|---|
| Extract engine/matcher from `n8n/src` into a runtime-neutral module | Shared code + tests | M |
| Local assessment endpoint | `/api/assess` on the kiosk server | M |
| Catalogue snapshot + version + integrity hash | Local DB/JSON | M |
| Local outcome queue + sync | SQLite + retry | M |
| Connectivity detection and mode switch | UI + server status | S |
| Offline acceptance test (network disabled) | Report | M |

**Why not duplicate the rules in the browser:** two copies will diverge. One
module, two runners.

**Why not a Python/FastAPI rewrite:** it adds a runtime the project has
deliberately avoided and does not solve the offline data problem.

**Exit gate:** a full 11-turn assessment and a voice loop complete with the
network cable unplugged.

---

### Phase 4 — Morocco-first catalogue

| Task | Output | Effort |
|---|---|---|
| Resolve the AMMPS-unreachable problem | Documented manual verification process | M |
| Apply `009` and obtain clinical/legal signatures | 16 reviewed MA products (or fewer) | M |
| Remove/disable every synthetic row from customer reach | Clean catalogue | S |
| Add provenance, registration and version fields | Migrations 010–011 | M |
| Build a repeatable import pipeline | Staging → review → activate | L |

**Exit gate:** every enabled MA product has a named reviewer, a working source,
a registration status and a max duration.

---

### Phase 5 — Conversation engine

| Task | Output | Effort |
|---|---|---|
| Add clinician-authored clarification trees for ambiguous symptoms | Rules + tests | M |
| Pathway-specific red flags for every enabled pathway | Rules + clinical sign-off | M |
| Structured "unknown/not asked" provenance | State + log | S |
| Bounded volunteered-context handling | Tests | S |

**Do not** let a model choose the next clinical question. It may only rephrase a
fixed question or extract a value for confirmation.

---

### Phase 6 — Alternatives, combinations and regulatory validation

| Task | Output | Effort |
|---|---|---|
| Normalised ingredient model | Migrations 011–012 | M |
| Level 1–4 alternative classifier | Deterministic engine + tests | L |
| Fixed-dose-combination validator | Ingredient/strength/ratio comparison | L |
| Recall/withdrawal blocking | `regulatory_alerts` + hard block | M |
| Pharmacist review queue | Table + UI/ops flow | M |

**Dependency:** none of this is safe before Phase 4 data is trustworthy.

---

### Phase 7 — Clinical safety expansion

| Task | Output | Effort |
|---|---|---|
| Duplicate-ingredient and cumulative-dose checks | Rules + tests | M |
| Coded interactions/contraindications with severity | Rules + tests | L |
| Pregnancy/age/renal policy per product | Rules + clinical sign-off | M |
| Adverse-event capture | Minimal privacy-safe flow | M |
| Rule/catalogue versioning in responses and logs | Schema + engine | S |

**Exit gate:** the checklist in `MEDICAL_SAFETY_GAP_ANALYSIS.md` §5 is complete.

---

### Phase 8 — Voice agent

| Task | Output | Effort |
|---|---|---|
| Truthful language list + voice-page i18n | UI change | S |
| French/Arabic/German Piper voices | Voices + tests | M |
| Darija/MSA/French ASR acceptance tests | Recorded corpus + WER | L |
| Acoustic test: echo, noise, barge-in | Hardware report | M |
| End-to-end latency/RAM benchmark | Report | M |
| Consent/privacy flow for cloud audio | UI + legal note | S |

---

### Phase 9 — Modular services

Only after Phase 3:

- Split the local runner into clear modules (intake, catalogue, safety,
  alternatives, voice) with typed contracts.
- One LLM at most, for language only.
- n8n remains an orchestrator, not the clinical authority.

Do not create ten services for a single-kiosk deployment.

---

### Phase 10 — Supabase / n8n integration hardening

- Migration runner and schema version tracking.
- Automated catalogue sync with integrity hash.
- Retry/queue for outcome log when offline.
- Execution-data retention and transcript policy.
- Remove or wire the unused tables.

---

### Phase 11 — Frontend

- Fix short-viewport voice layout.
- Online/offline and last-sync indicators.
- Language truthfulness (tested languages only).
- Product source, regulatory status and stock status display.
- Clearer "not verified / no safe alternative / pharmacist review" states.
- Accessibility labels on mobile dock controls.

---

### Phase 12 — Security and privacy

| Task | Priority |
|---|---|
| Rotate any historically exposed secret | P0 if repo shared |
| Rate limiting on webhook and local APIs | P1 |
| TLS for the kiosk origin | P1 |
| CSP and static-file allowlist | P1 |
| Per-device tokens or IP allowlist | P2 |
| Operator authentication and audit log | P2 |
| n8n execution retention | P1 |
| Data-protection impact assessment | P1 |

---

### Phase 13 — Testing

- Keep the current 9 suites.
- Add data-integrity tests (no fixture/demo row enabled).
- Add duplicate-ingredient, dose, interaction-severity, recall and language
  tests.
- Add offline end-to-end and hardware voice tests.
- Add a scheduled live watchdog with an alert channel.
- Add CI (even a local pre-commit hook is better than none).

---

### Phase 14 — Performance

- p50/p95 for text and voice, cold and warm.
- Peak RSS per stage.
- 30-minute thermal run.
- TTS cache cap and eviction.
- Concurrent kiosk simulation.

---

### Phase 15 — Documentation and release

- Update `README.md`, `RUNBOOK.md`, `PLAN.md` and this roadmap after each phase.
- Produce the remaining brief documents as the work completes:
  `MODEL_SELECTION_REPORT.md`, `LAPTOP_COMPATIBILITY_REPORT.md`,
  `MEDICAL_SAFETY_ENGINE.md`, `VOICE_AGENT_ARCHITECTURE.md`,
  `DATABASE_SCHEMA.md`, `OFFLINE_TEST_REPORT.md`, `SECURITY_REPORT.md`,
  `KNOWN_LIMITATIONS.md`.
- Do not claim clinical validation without a named reviewer and evidence.

---

## 3. Immediate order of work (recommended)

1. **Approve and fix the P0 data issues** (destructive DB change — needs explicit
   approval).
2. **Tighten the live journey expectations** so a regression cannot pass.
3. **Add the data-integrity guard migration** (010).
4. **Commit the current verified work** in logical commits after gitignoring
   `tools/whisper*` — do not `git add .` before that.
5. **Finish Phase 1 research and licence matrix.**
6. **Benchmark Phase 2 models.**
7. **Start Phase 3 offline extraction** (the largest architectural change).
8. Only then expand pathways, alternatives and languages.

---

## 4. Decisions required from the owner

| ID | Decision | Why it blocks work |
|---|---|---|
| D1 | Authorise disabling/cleaning the live synthetic catalogue | Destructive DB change; P0 |
| D2 | Demo vs reviewed catalogue strategy | Determines whether `ZZ` is kept as a sandbox |
| D3 | Offline architecture option (recommended: shared engine + local runner) | Determines the largest build |
| D4 | Languages to support first | Drives voice models and content |
| D5 | Named clinical and legal reviewers | Required to enable real products |
| D6 | Moroccan data source while AMMPS is unreachable | Required for provenance |
| D7 | Kiosk hardware and count | Drives performance and auth |
| D8 | Privacy/legal position for Gemini | Required before cloud audio/text |
| D9 | Hosted n8n vs local-only | Drives sync and ops |
| D10 | Vending scope and timing | Determines whether hardware work starts |

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Building features on synthetic data | Data guard first |
| Two diverging rule copies in offline mode | One shared module |
| Model creep into the safety path | Architectural tests + review gate |
| Claiming languages before testing | Truthful selector + test matrix |
| Model download filling the disk | Disk check + size limit |
| Clinical review becoming a bottleneck | Start with fewer, well-sourced products |
| Repo loss of uncommitted work | Commit after gitignore fix |

---

## 6. P0 execution log (2026-11-05)

Done in this pass:

- Live catalogue: `ZZ-FIXTURE-TEST-500` disabled; 15 enabled rows cleared of
  `demo ...` / `test ...` matching terms; the two rows whose only leaflet URL
  was `example.invalid` disabled (`ZZ-DEMO-PLASTER-10`, `ZZ-DEMO-GAUZE-10`).
  Backup written under `tmp/` (gitignored). The original values remain
  reproducible from migrations `008`/`009` and `scripts/update-actual-medicines.mjs`.
- `scripts/audit-catalog.mjs`: detects fixtures, placeholder terms, unreachable
  provenance, missing maximum duration/reviewer, and reports the catalogue as
  a demo sandbox. `--strict` makes demo data a release blocker (exit 1).
- `supabase/migrations/010_data_integrity_guard.sql`: provenance columns,
  fixture block, ZZ-only synthetic origin, reviewer/source/max-duration checks,
  matcher view excludes fixtures, `catalogue_readiness` view.
- Live tests tightened: exact live outcomes instead of dual outcomes, real
  conflicting terms instead of demo terms, fixture name explicitly rejected.
- `scripts/update-actual-medicines.mjs`: no longer reintroduces placeholder
  terms; refuses to run without `PILLPAL_ALLOW_DEMO_REWRITE=1`.
- Kiosk server: static allowlist (no `.mjs`/`.md` fetches), CSP and frame/referrer
  headers; short-viewport voice layout; whisper artifacts gitignored.

Still blocked on the owner:

1. Apply migration `010` in the Supabase SQL editor (DDL access is not
   available from this session).
2. Decide D2: keep `ZZ` as a demo sandbox or replace it with a reviewed MA
   catalogue. Until then `npm run audit:catalog -- --strict` must fail.
3. Do not enable real products without D5 (named clinical/legal reviewers).
