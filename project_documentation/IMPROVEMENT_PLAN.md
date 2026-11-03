# IMPROVEMENT_PLAN.md — PILLPAL MedAssist CHATBOT MVP

**Date:** 2026-11-03 · Basis: `project_documentation/PROJECT_ANALYSIS.md` (verified analysis)
**Scope:** the n8n chatbot is the deliverable — conversational intake → safety rules → Supabase catalog decision → JSON response. Any vending frontend is a future consumer of this webhook; hardware/payments are out of scope for this stage.
**Principle:** preserve every working feature and business rule; no schema/RLS changes without explicit approval; no new runtime dependencies.

Priority scale: **Critical / High / Medium / Low** · Complexity: **Low / Medium / High**

---

## A. Frontend

### F1 · Commit the verified in-flight improvement set
* **Current problem:** 9 modified files contain tested, passing improvements (pathway gating, red flags, duration enforcement, i18n, runbook) that exist only in the working tree. Loss/drift risk; the repo's own drift-control discipline requires committed truth (`d2b21ef` covers none of this).
* **Recommended improvement:** commit the 9 files as one reviewed change once approved; tag it; only then re-import the workflow JSON into n8n (see N1).
* **Why necessary:** unverified-on-server improvements are the exact failure class this project has already been bitten by (PLAN baseline: deployed ≠ src).
* **Expected benefit:** durable, diffable history; deployed/repo parity becomes a 1-command check.
* **Files:** `n8n/src/*`, `n8n/workflows/*.json`, `web/i18n.js`, `RUNBOOK.md`, `scripts/*` (commit only).
* **Complexity:** Low · **Priority:** Critical

### F2 · TTS cache discipline (`server.mjs`)
* **Current problem:** `tmp/tts-cache` WAV cache has no size cap or eviction; every unique synthesized string adds a file forever. On an unauthenticated LAN endpoint this is a slow disk-fill vector.
* **Recommended improvement:** enforce a max cache size (e.g. 200 MB / 4 000 files), evict oldest-by-mtime after synthesis, count and log evictions; keep the existing atomic write behaviour.
* **Why necessary:** kiosks run unattended for weeks; disk exhaustion manifests as a broken voice with a confusing trail.
* **Expected benefit:** bounded disk usage; no customer-visible change (cache miss cost is small).
* **Files:** `web/server.mjs`, `.env.example` (`PIPER_CACHE_MAX_BYTES`, optional), `RUNBOOK.md`.
* **Complexity:** Low · **Priority:** Medium

### F3 · Security headers + favicon for the kiosk origin
* **Current problem:** the static server sends only `nosniff` + `no-store`; no CSP, no `Referrer-Policy`, no favicon (per-boot 404).
* **Recommended improvement:** add a strict CSP (`default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:`; no inline except the existing theme bootstrap → move it to an external self-hosted script or add a hash), `Referrer-Policy: no-referrer`, `Permissions-Policy: microphone=(self)`, and a small inline SVG favicon served as data-URI link.
* **Why necessary:** a browser that renders only first-party code is the cheapest strong defence for a kiosk; CSP hard-stop any future XSS slip.
* **Expected benefit:** materially reduced exploit surface; fewer console 404s.
* **Files:** `web/server.mjs`, `web/index.html`.
* **Complexity:** Low · **Priority:** Medium

### F4 · Accessibility polish pass
* **Current problem:** semantics are largely good (aria-live, roles, labels), but focus handling on result screens and after confirmations is implicit, and theme contrast for small-print (`--subtle`) is unverified against WCAG AA.
* **Recommended improvement:** move focus to the primary actionable control on each render (question card → first option / input; result → Restart button); audit contrast variables for the light theme; verify focus rings are visible on touch kiosks.
* **Why necessary:** pharmacy customers include elderly/low-vision users; focus discipline prevents "invisible state" confusion after errors.
* **Expected benefit:** better first-use success rate on touch; WCAG-AA alignment.
* **Files:** `web/app.js` (`render`, `renderResult`, `renderQuestion`), `web/styles.css`.
* **Complexity:** Low · **Priority:** Medium

### F5 · `spokenNumber()` robustness
* **Current problem:** unrelated number words are summed ("two ten" → 12). Typed digits are unaffected; risk is limited to the age question in voice mode.
* **Recommended improvement:** prefer the first recognized 0–120 number in a plain counting pattern and ignore later number words unless followed by `hundred`; keep German compound handling. Confirmations already guard red-flag answers, but age is not confirmed when digits are present in the transcript — add age confirmation when the transcript contains no digits (already the case) **and** when multiple number words are detected (propose).
* **Why necessary:** a wrong age can flip a product eligibility decision at the margins.
* **Expected benefit:** fewer misheard-age escalations.
* **Files:** `web/voice-input-mapper.js`, `scripts/test-voice-mapper.mjs`.
* **Complexity:** Low · **Priority:** Low

### F6 · Kiosk browser hardening hook (PLAN T21)
* **Current problem:** nothing stops long-press context menus, selection, or accidental reloads on the kiosk unit.
* **Recommended improvement:** kiosk-profile CSS/JS guard (disable context menu on non-operator elements, disable text selection on controls, optional fullscreen button for operators) + document the Edge/Chrome `--kiosk` launch line in RUNBOOK.
* **Why necessary:** public-facing device hygiene; matches the vendored hardware intent.
* **Expected benefit:** consistent customer mechanics; fewer stuck states.
* **Files:** `web/app.js`, `web/styles.css`, `RUNBOOK.md`.
* **Complexity:** Low · **Priority:** Low (needs a kiosk-hardware decision)

### F7 · Explicit small-screen/right-to-left-product note
* **Current problem:** layouts target the kiosk ≥ tablet portrait; mobile behaviour is untested. Morocco implies Arabic/French customers, but the UI ships EN/DE only.
* **Recommended improvement:** no code change yet — record EN/DE as the supported set and treat AR/FR as a product decision (see Open Questions); optionally add a minimal responsive sanity check to Phase 5 instead of a rewrite.
* **Why necessary:** honest documentation beats accidental scope.
* **Expected benefit:** clear expectations; a decision point is forced at design time, not mid-pilot.
* **Files:** `README.md`, this plan.
* **Complexity:** Low · **Priority:** Low

---

## B. Supabase

### S1 · No schema or RLS changes — keep and document
* **Current state (verified):** RLS enabled on all 15 tables + views, no policies, grants only to `service_role`; enable-gating CHECK + trigger; separate security-invoker views; `kiosk_outcome_log` narrow + prunable. **This is the correct posture for this system** and must not be loosened.
* **Recommended improvement:** none to the security model. Document posture in SECURITY_REVIEW and keep migration 005/006 usage discipline.
* **Files:** documentation only.
* **Complexity:** — · **Priority:** — (explicitly approved as "no change")

### S2 · Resolve the fate of the unused lineage tables (PLAN T13/decision)
* **Current problem:** `chat_sessions`, `session_answers`, `chat_events`, `decisions`, `decision_products`, `decision_rule_results`, `ui_messages` exist and are written by nothing; `decisions.outcome` CHECK doesn't even cover `CATALOG_CHECK_REQUIRED`. Dead schema invites accidental writes by future tooling and misleads auditors.
* **Recommended improvement:** owner decision — (a) leave as documented reserve (status quo, zero work), (b) drop them in migration 008, or (c) wire minimal lineage into them later. **No action taken without approval.** If left, add a `comment on table` to each saying "unused by the workflow; see 007 comments".
* **Why necessary:** schema debt becomes someone else's trap.
* **Expected benefit:** no functional change; clear truth for future contributors.
* **Files (option a):** `supabase/migrations/008_*` (new, only if dropping) or comments only (no migration).
* **Complexity:** Low (option a/c) / Medium (b) · **Priority:** Low · **Needs approval:** yes (schema change)

### S3 · Retention automation for `kiosk_outcome_log` (optional)
* **Current problem:** `prune_kiosk_outcome_log(90)` exists but is manual (RUNBOOK documents the manual run).
* **Recommended improvement:** if the owner prefers automation, schedule via a n8n schedule-triggered workflow calling the function (no pg_cron dependency, no new extensions) — **only if approved**; default stays manual.
* **Why necessary:** unbounded log rows are proportional to kiosk traffic (small, but unbounded).
* **Expected benefit:** guaranteed retention compliance (GDPR/data-minimisation posture matches the anonymised design).
* **Files:** `n8n/build-workflow.mjs` (new schedule branch) — schema untouched.
* **Complexity:** Low · **Priority:** Low · **Needs approval:** yes

### S4 · Supabase Auth decision for the future operator dashboard
* **Current problem:** no auth exists at any layer for operators; the analytics view of `kiosk_outcome_log` (PLAN T26) would need operator access.
* **Recommended improvement:** defer. When a dashboard is approved, use Supabase Auth with a dedicated `operator` role + policies on `kiosk_outcome_log` (read-only), MFA on. Do not expose the service key in any new client.
* **Why necessary:** avoids an "operator = shared password" anti-pattern later.
* **Files:** future migration + dashboard (out of scope now).
* **Complexity:** Medium (when built) · **Priority:** Low (future)

---

## C. n8n

### N1 · Re-import the rebuilt workflow after commit (operator step, PLAN M2)
* **Current problem:** the working-tree JSON contains verified improvements not yet confirmable against the deployed instance; deployed/repo parity must be re-established before the pilot-relevant behaviours (red flags, duration block) are trusted on-site.
* **Recommended improvement:** after F1 commit → n8n → Import from File → save → activate → verify single active path (`pillpal-chat-turn`) → `npm run smoke:live` + `npm run test:journeys:live` + `npm run test:product-path` (with `005` applied).
* **Why necessary:** the drift check only proves repo-internal consistency, never live deployment.
* **Expected benefit:** deployed behaviour == verified source; live journeys prove it.
* **Files:** none in repo; n8n UI.
* **Complexity:** Low · **Priority:** Critical

### N2 · Scheduled live watchdog (PLAN T16 completion)
* **Current problem:** silent outage is discovered by customers; `smoke:live` exists but runs only when an operator remembers.
* **Recommended improvement:** run every 15 min: `PILLPAL_WEBHOOK_SECRET=… node scripts/smoke-live.mjs` via Windows Task Scheduler (project-native; no new deps), persist last result in `tmp/watchdog-state.json`, alert channel = owner decision (email/chat/Supabase row). Provide a `scripts/watchdog.mjs` wrapper that also validates an unexpected-outcome signal.
* **Why necessary:** the workflow can go stale (re-import mistakes, credential loss, catalog mis-edit) without any code change.
* **Expected benefit:** ≤15-min detection of auth/contract breakage.
* **Files:** new `scripts/watchdog.mjs`, `RUNBOOK.md`, optional `.env.example` keys.
* **Complexity:** Low–Medium · **Priority:** High

### N3 · Deployment fingerprint reporting (๏i cheap traceability)
* **Current problem:** it's possible to prove *repo* parity but not easily *which engine build* the server runs (only observable by behaviour).
* **Recommended improvement:** add a constant `ENGINE_VERSION`/`ENGINE_BUILD` (hash of src at build time) into the engine response `api_version` fields and print both in smoke-live output. Optional, additive field only (frontend ignores unknown fields).
* **Why necessary:** turns "is the server stale?" from inference into a one-line answer.
* **Expected benefit:** faster diagnosis after re-imports.
* **Files:** `n8n/build-workflow.mjs`, `n8n/src/intake-and-safety-engine.js`, `scripts/smoke-live.mjs`, `scripts/check-workflow-drift.mjs`.
* **Complexity:** Medium (must embed at build time) · **Priority:** Medium

### N4 · Webhook abuse dampening (host-level; pairs with SEC items)
* **Current problem:** header-auth rejects wrong secrets, but correct-secret abuse (or a leaked secret) is unlimited: engine turns + Supabase reads + one log row per finished write path are free, and responses advertise CORS `*`.
* **Recommended improvement:** prefer tightening the shared secret model (SEC2/SEC5) + optional host-level rate limit (reverse proxy on `n8n.naf-cloudsystem.de`, per-IP bucket on the webhook path) — no workflow change.
* **Why necessary:** cost-control and noise-floor for the log table.
* **Expected benefit:** abuse becomes expensive before it becomes effective.
* **Files:** host proxy config (outside repo), documented in SECURITY_REVIEW.
* **Complexity:** Medium · **Priority:** High · **Needs approval:** yes (infra)

### N5 · Local docker-compose parity
* **Current problem:** local n8n allows `$env` (`N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"`) while production denies it — test parity is weaker than prod.
* **Recommended improvement:** flip to `"true"` locally; drift check already asserts no `$env` in the build.
* **Why necessary:** testing under prod-like constraints catches accidental `$env` reliance.
* **Expected benefit:** on-par local behaviour; zero workflow change.
* **Files:** `docker-compose.yml`.
* **Complexity:** Low · **Priority:** Low

---

## D. Code quality

### Q1 · Documentation truth reconciliation
* **Current problem:** PLAN.md is historical (28 tasks, mid-flight status) and contains the leaked secret literal (A2); README's journey counts differ from RUNBOOK's.
* **Recommended improvement:** after secret rotation, replace the secret literals in PLAN.md with a placeholder, add a short header "status → see RUNBOOK + project_documentation/", and align journey counts. (Literal purge in git history only if a remote is added — see SEC1.)
* **Files:** `PLAN.md`, `README.md`.
* **Complexity:** Low · **Priority:** High (pairs with rotation)

### Q2 · Keep the two `cleanText`/`normalize` copies (explicit no-op decision)
* **Current problem:** `intake-and-safety-engine.js` and `catalog-decision.js` duplicate small helper functions.
* **Recommendation:** **do not refactor.** Code nodes must embed as standalone files; extraction would require a bundler step (new dependency/complexity) for ~20 lines of duplication that is already drift-checked by tests.
* **Files:** none.
* **Priority:** — (documented decision)

### Q3 · Test coverage additions (cheap, high-value)
* **Current gap:** no test asserts the log-node column mapping stays aligned with 007; no test for the engine's `warning_signs` screen carrying `red_flags` per pathway; voice mapper lacks multi-number-word cases.
* **Recommended improvement:** extend `test-n8n-engine.mjs` (screen shape assertions), `check-workflow-drift.mjs` (assert Log Outcome columns include the exact 007 column list), `test-voice-mapper.mjs` (ambiguous inputs documented).
* **Why necessary:** mapping drift between workflow and DB would silence outcome logging with no error (it is `onError: continue`).
* **Expected benefit:** logging regressions become loud.
* **Files:** `scripts/test-n8n-engine.mjs`, `scripts/check-workflow-drift.mjs`, `scripts/test-voice-mapper.mjs`.
* **Complexity:** Low · **Priority:** Medium

### Q4 · Optional developer conveniences (no new dependencies)
* **Current gap:** no `lint`/`typecheck`/CI. **Recommendation:** keep zero-dependency stance; if the owner wants CI, GitHub Actions running the existing test scripts is enough. No linters unless requested.
* **Files:** `.github/workflows/test.yml` (optional), `package.json` (`test` alias exists already).
* **Complexity:** Low · **Priority:** Low

---

## Open questions requiring owner decisions before implementation

| # | Question | Blocks |
| --- | --- | --- |
| D1 | Approve F1 commit of the 9 verified files? | F1, N1 |
| D2 | Rotate the kiosk secret (A2/SEC1) — now or only when a remote is added? Rotation voids live journeys until `web/config.js` + credential are updated (operator step) | Q1, SEC1 |
| D3 | Watchdog alert channel + cadence (T16)? | N2 |
| D4 | Engine build-fingerprint field (N3) — additive API change OK? | N3 |
| D5 | Unused-schema decision: leave / comment / drop (S2)? | S2 |
| D6 | Retention automation (S3) — manual OK? | S3 |
| D7 | Rate limiting on the n8n host (N4) — is proxy config available to you? | N4, SEC5 |
| D8 | Kiosk mode hardening + fullscreen (F6) — is this a customer-facing launch target already? | F6, SEC6 |
| D9 | TTS cache cap parameters (F2)? | F2 |

**Explicit non-goals carried over from README/PLAN (unchanged):** no LLM in safety/eligibility/product paths; no third-party paid APIs; no dispensing authorisation; no real-Morocco-product enablement without clinical+legal review.
