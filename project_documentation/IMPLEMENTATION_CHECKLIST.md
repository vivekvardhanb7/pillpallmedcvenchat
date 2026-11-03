# IMPLEMENTATION_CHECKLIST.md — PILLPAL MedAssist CHATBOT MVP

**Date:** 2026-11-03 · Derived from `IMPROVEMENT_PLAN.md` + `SECURITY_REVIEW.md`.
**Scope:** chatbot deliverable only (n8n webhook API + Supabase catalog brain + kiosk web client as reference consumer). Vending hardware/payments are out of scope at this stage.
**Status legend:** ☐ pending · 🕓 awaiting owner decision · ✅ done
**Nothing below has been executed yet.** Analysis (Phase 1) and documentation (Phase 2) only.

---

## Stage 0 — Decisions required before code changes

| ID | Task | Priority | Decision question | Blocks |
| --- | --- | --- | --- | --- |
| D1 | Approve committing the 9 verified in-flight files | Critical | "Approve F1 commit?" | A1 |
| D2 | Rotate the kiosk shared secret (n8n credential + `web/config.js` + `.env` + doc scrub) | Critical | "Rotate now, or only when a remote is added?" | SEC1, Q1 |
| D3 | Watchdog cadence + alert channel (email / chat / Supabase row) | High | "Which channel?" | N2 |
| D4 | Additive `ENGINE_BUILD` fingerprint field in responses | Medium | "OK as additive API change?" | N3 |
| D7 | Host-level rate limit on the webhook path | High | "Do you control the proxy at `n8n.naf-cloudsystem.de`?" | N4 |
| D5 | Unused tables: leave / comment / drop (migration 008) | Low | "Which option?" | S2 |
| D6 | Retention automation (schedule workflow) vs manual prune | Low | "Automate?" | S3 |
| D8 | Kiosk hardening scope (context menu/selection/fullscreen) | Low | "Is launch imminent?" | F6 |
| D9 | TTS cache cap parameters | Medium | "Approve defaults (e.g. 200 MB)?" | F2 |

---

## Stage 1 — Immediate (no owner code risk; commit + deploy parity)

| ID | Task | Priority | Files Affected | Dependencies | Testing requirements | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A1-1 | Commit verified in-flight changes (9 files) as one reviewed commit | Critical | `n8n/src/*`, `n8n/workflows/*.json`, `web/i18n.js`, `RUNBOOK.md`, `scripts/*` | D1 approval | `npm test` + `npm run test:journeys` must pass on the committed tree | ☐ |
| N1-1 | Operator: re-import built JSON into n8n, save, activate; confirm single active path | Critical | none (n8n UI) | A1-1 | `npm run smoke:live`; `PILLPAL_WEBHOOK_SECRET=… npm run test:journeys:live` (expect same outcomes as offline); if `005` applied: `npm run test:product-path` | ☐ |
| Q3-1 | Extend drift check: assert Log Outcome column mapping includes exact 007 columns | Medium | `scripts/check-workflow-drift.mjs` | D1 | `npm run check` green; negative test by temporarily renaming a column? (no — verify assertion fires in a scratch copy) | ☐ |
| Q3-2 | Engine tests: assert warning-signs screen carries `red_flags` + `pathway_code` for pain_fever | Medium | `scripts/test-n8n-engine.mjs` | — | `npm run test-n8n-engine` → `npm test` | ☐ |
| Q3-3 | Voice mapper tests for multi-number-word inputs (document chosen behaviour) | Low | `scripts/test-voice-mapper.mjs`, `web/voice-input-mapper.js` (if behaviour changes — decided D-stage) | F5 decision | `npm run test-voice-mapper` → `npm test` | 🕓 |

## Stage 2 — Secret hygiene + docs

| ID | Task | Priority | Files Affected | Dependencies | Testing requirements | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SEC1-1 | Operator rotation of kiosk secret (3 places in one sitting: n8n credential, `web/config.js`, `.env`) | Critical | n8n UI + gitignored files | D2 | `npm run smoke:live` passes with new secret; old secret returns 403 | ☐ |
| SEC1-2 | Replace secret literals in `PLAN.md` §12 with a placeholder note | Critical | `PLAN.md` | SEC1-1 | grep repo for the old literal → 0 matches (outside git history; see SEC1-3) | ☐ |
| SEC1-3 | Decide on git-history scrub **only if** a remote is added | High | none (decision) | SEC1-2 | — | 🕓 |
| Q1-2 | Add status header to PLAN.md ("superseded by project_documentation/ + RUNBOOK"); align journey counts in README | High | `PLAN.md`, `README.md` | SEC1-2 | visual review | ☐ |

## Stage 3 — Frontend resilience (module-local, safe, behind config defaults)

| ID | Task | Priority | Files Affected | Dependencies | Testing requirements | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F2-1 | TTS cache cap + oldest-first eviction + startup log line | Medium | `web/server.mjs`, `.env.example` | D9 | Manual: write >cap → oldest files removed; TTS still works; `npm start` boot log clean | ☐ |
| F3-1 | CSP + Referrer-Policy + Permissions-Policy headers; move theme bootstrap off inline (external file or nonce) | Medium | `web/server.mjs`, `web/index.html` | — | Manual: kiosk loads, both themes toggle, voice works, console clean; CSP violation log empty | ☐ |
| F3-2 | Favicon (inline SVG data-URI link) | Low | `web/index.html` | — | Console 404 gone | ☐ |
| F4-1 | Focus management: primary control focus per render (question/result/error) | Medium | `web/app.js` | — | Manual walkthrough incl. keyboard-only path | ☐ |
| F4-2 | Light-theme contrast audit for `--subtle`/`--muted` text | Low | `web/styles.css` | — | Contrast check ≥4.5:1 body, ≥3:1 large | ☐ |
| F5-1 | `spokenNumber()` counting-pattern fix (if approved) | Low | `web/voice-input-mapper.js` | Q3-3 | mapper tests incl. DE compounds; kiosk sanity on age question | 🕓 |
| F6-1 | Kiosk hardening guards (context menu, selection; fullscreen helper) | Low | `web/app.js`, `web/styles.css`, `RUNBOOK.md` | D8 | Manual on kiosk browser; operator dismissal still possible | 🕓 |

## Stage 4 — n8n / ops

| ID | Task | Priority | Files Affected | Dependencies | Testing requirements | Status |
| --- | --- | --- | --- | --- | --- | --- |
| N2-1 | `scripts/watchdog.mjs` (wraps smoke-live, appends state file, exits non-zero on drift of expected outcome) | High | new `scripts/watchdog.mjs`, `RUNBOOK.md`, `.env.example` | D3 | Run twice: success + deliberately wrong secret (must FAIL loudly) | ☐ |
| N2-2 | Schedule via Windows Task Scheduler 15-min cadence | High | none (OS) | N2-1 | Simulate outage → alert arrives on chosen channel within one cycle | ☐ |
| N3-1 | Build-time `ENGINE_BUILD` hash embedded in engine response + printed in smoke-live | Medium | `n8n/build-workflow.mjs`, `n8n/src/intake-and-safety-engine.js`, `scripts/smoke-live.mjs`, `scripts/check-workflow-drift.mjs` | D4 | `npm run build:workflow` → `npm run check` → `smoke:live` shows matching build id | 🕓 |
| N4-1 | Rate limit on webhook path (host proxy) | High | infra config (outside repo) | D7 | Load test from a second host: sustained abuse throttled; normal kiosk unaffected | 🕓 |
| N5-1 | `N8N_BLOCK_ENV_ACCESS_IN_NODE:"true"` in docker-compose | Low | `docker-compose.yml` | — | `docker compose up -d`; smoke-test locally then restore | ☐ |

## Stage 5 — Supabase (all owner-gated; no default action)

| ID | Task | Priority | Files Affected | Dependencies | Testing requirements | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S2-1 | Owner decision on unused tables (leave / comment-only / drop via 008) | Low | possibly new migration | D5 | If dropping: full journey re-run afterwards; `007` unaffected | 🕓 |
| S3-1 | Scheduled prune workflow (optional) | Low | `n8n/build-workflow.mjs` | D6 | Insert old-dated row via SQL Editor → schedule runs → row removed; customer flow unaffected | 🕓 |
| S4-1 | (future) Operator dashboard auth design — deferred | Low | future | — | — | 🕓 |

---

## Execution order (recommended, collapsible if approved piecemeal)

1. **D1** → A1-1 → N1-1 (make repo truth == deployed truth)
2. **D2** → SEC1-1 → SEC1-2 → Q1-2 (stop leaking the current secret)
3. Q3-1, Q3-2 (make logging regressions loud before anything else moves)
4. **D3** → N2-1 → N2-2 (watchdog)
5. F2-1, F3-1+3, F4-1 (frontend hardening, all reversible config-level)
6. **D7** → N4-1 (host rate limit)
7. 🕓 items after decisions (F5/F6/N3/S2/S3)

## Post-implementation verification bundle (Phase 5 preview)

- `npm test` · `npm run test:journeys` (offline, 49 checks)
- `npm run smoke:live` · `npm run test:journeys:live` · `npm run test:product-path` (needs `005` fixture applied) · `npm run audit:catalog`
- Browser walkthrough of every screen + both themes + EN/DE + voice paths, console clean
- Manual RLS spot-probe: authenticated anon attempt on `kiosk_outcome_log` (expect deny)
- Re-run drift check after any `n8n/src` touch
