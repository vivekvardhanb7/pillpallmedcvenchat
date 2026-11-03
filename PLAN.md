# PILLPAL MedAssist — Improvement & Implementation Plan

**Date:** 2026-11-03 · **Status of production:** working, authenticated, deterministic
**Owner:** solo operator · **Stack:** static kiosk (`web/`) + n8n Code workflow + Supabase + Piper TTS

---

## 1. Verified baseline (measured today, not assumed)

| Check | Result |
|---|---|
| Deployed workflow vs `n8n/src` | **Identical, byte-for-byte** (intake engine + product matcher) |
| Webhook auth | `headerAuth` on `Chat Turn Webhook`, credential `Backend Service Auth Medtest` |
| `$env` usage in workflow | **Zero** — the "access to env vars denied" failure is gone permanently |
| POST without header / wrong header | `403` from n8n, before any node runs |
| `OPTIONS` preflight | `204` + `Access-Control-Allow-Headers: x-pillpal-auth,content-type` — CORS is fine |
| Offline journey suite (`npm run test:journeys`) | **42/42 pass** |
| Live journey suite against production | **31/31 pass** |
| Browser walk against production (real kiosk, 10 taps) | Reaches `NO SUITABLE PRODUCT` result screen, all requests `200`, **console clean** |
| Under-18 / warning-signs live | `CLINIC_REFERRAL` at 2 taps / `IMMEDIATE_MEDICAL_CARE` at 5 taps |
| Live product catalogue | **Empty** — every completed pathway returns `no_approved_product_for_pathway` |

---

## 2. Known issues (each with evidence)

| ID | Issue | Evidence | Severity |
|---|---|---|---|
| I1 | Kiosk shows a misleading hint when auth fails | `web/i18n.js:122` + `:413` say "check n8n is running / workflow active / webhook URL" for **all** failures; a 403 is a secret problem | High |
| I2 | A stale kiosk tab keeps the old empty secret in memory | `web/app.js:15` reads `window.PILLPAL_CONFIG` once at load | High |
| I3 | No signal when the kiosk is broken — discovered by a customer | Today's outage produced 403s silently | High |
| I4 | Summary lies on early exits | Age-12 run printed `WARNING SIGNS: Not sure`, `ALLERGIES: None reported` for never-asked questions (`summaryFor`, `n8n/src/intake-and-safety-engine.js:246`) | Medium |
| I5 | Refusal comes after all 10 questions | severe / >7 days / pregnancy / not-sure / `other` are only evaluated at `confirm` | Medium |
| I6 | Over-age customers get product-fault wording | `all_products_blocked` → "products did not pass all safety checks" | Medium |
| I7 | German kiosk is silent but claims to speak | `GET /api/tts` → `de.available=false, model=false`; UI still shows "SPEAKING…" | Medium |
| I8 | `en`-only product is invisible to a German customer, with no hint | Verified in browser: DE journey → `no_approved_product_for_pathway` | Medium |
| I9 | Zero traceability of what the kiosk is asked | `chat_sessions` / `decisions` exist in `supabase/migrations/001_medical_chatbot_schema.sql`; **no code writes to them** | High |
| I10 | No version control | Project is not a git repo — this is why the deployed workflow drifted from `n8n/src` unnoticed | High |
| I11 | Re-import leaves credentials unbound | Repo builder names them `Header Auth account` / `Supabase account`; instance has `Backend Service Auth Medtest` / `PILLPALL CHATBOT` | Medium |
| I12 | Shared secret is guessable and ships in the browser bundle | `web/config.js` is public; current value is the project name | Medium |
| I13 | `npm run audit:catalog` cannot run | No `.env` (`SUPABASE_URL` + service-role key) | Low |

---

## 3. Phase 1 — Kiosk resilience and honest errors
*Local code only. No server, no database access needed.*

### T1 · Startup self-check + operator badge — fixes I3
- **What:** on page load, POST one probe turn (`{reset:true}`) to the real webhook. On 401/403 show a small persistent badge "ENDPOINT NOT CONFIGURED — check webhookSecret"; on network failure show "ENDPOINT UNREACHABLE". Keep the customer UI usable for the offline-safe screens.
- **Files:** `web/app.js` (init), `web/i18n.js` (new keys EN + DE), `web/styles.css`
- **Accept:** with `webhookSecret: ''`, the badge appears within 3 s of load; with the correct secret, no badge and no extra visible request.
- **Effort:** S · **Owner:** me · **Risk:** one extra request per kiosk boot

### T2 · Correct failure copy — fixes I1
- **What:** split `connectionHint` into three cases: `401/403` → "the kiosk secret does not match the n8n credential"; `5xx` → "n8n or the workflow failed"; network error → "n8n unreachable / not activated".
- **Files:** `web/app.js:401`, `web/i18n.js:121-123` and `:412-413`
- **Accept:** force a wrong secret, tap Start, read the 403-specific line in EN and DE.
- **Effort:** S · **Owner:** me · **Risk:** none

### T3 · Config-change awareness — fixes I2
- **What:** fetch `/config.js` text at boot, hash it, re-check every 60 s; if it changed, show "restart the kiosk page to apply the new configuration" (or auto-reload when idle).
- **Files:** `web/app.js`, `web/server.mjs` (already serves `Cache-Control: no-store`)
- **Accept:** edit the secret while the page is open → notice within 60 s.
- **Effort:** M · **Owner:** me · **Risk:** auto-reload must never fire mid-assessment

### T4 · Honest summary on early exits — fixes I4
- **What:** `summaryFor()` must print `Not asked` for any field still `null`/untouched, instead of `Not sure` / `None reported`.
- **Files:** `n8n/src/intake-and-safety-engine.js:246` → `npm run build:workflow` → re-import
- **Accept:** age-12 journey summary shows `WARNING SIGNS: Not asked`, `ALLERGIES: Not asked`.
- **Effort:** S · **Owner:** me + your re-import

### T5 · TTS failure fallback — fixes I7
- **What:** when `/api/tts` returns 503, do not enter the "speaking" state; show text only and mark the voice chip as unavailable. Probe `GET /api/tts` once at boot for the active language.
- **Files:** `web/voice-assistant.js`, `web/app.js`
- **Accept:** switch to DE with no German model installed → UI says text-only, never "SPEAKING…".
- **Effort:** M · **Owner:** me

---

## 4. Phase 2 — Customer time on screen
*Changes the clinical flow shape — needs your approval (decision D).*

### T6 · Early refusals at the disqualifying question — fixes I5
- **What:** return the final response at the step that disqualifies instead of at `confirm`:
  `other` symptom → tap 1 · `more_than_7_days` → tap 3 · `severe` → tap 4 · pregnancy/breastfeeding/both/prefer-not-to-say → tap 6 · `not_sure` on allergy/medicines/conditions → tap 7-9.
- **Files:** `n8n/src/intake-and-safety-engine.js` (each `case` block) → rebuild → re-import
- **Accept:** journeys 8, 13, 16-20 in `scripts/test-customer-journeys.mjs` drop from 10 taps to the numbers above; no outcome or reason code changes.
- **Effort:** M · **Owner:** me + your re-import · **Risk:** fewer completed data points per refusal (T10 logging is unaffected — reason codes stay)

### T7 · Age-limit copy — fixes I6
- **What:** when every block reason is age-based, return `message` "This assessment supports adults aged 18 to 65 only…" and reason `age_outside_supported_range`.
- **Files:** `n8n/src/catalog-decision.js` (`all_products_blocked` branch)
- **Accept:** age-120 journey shows the age message, not "did not pass all safety checks".
- **Effort:** S · **Owner:** me + re-import

### T8 · Language coverage audit — fixes I8
- **What:** `npm run audit:catalog` reports, per enabled product, which `language_code` rows exist, and flags any product enabled in only one language.
- **Files:** `scripts/audit-catalog.mjs`
- **Accept:** with an `en`-only product enabled, the audit prints a coverage warning.
- **Effort:** S · **Owner:** me (needs `.env`, see M3)

### T9 · Per-step timing in the response — supports I5 measurement
- **What:** add `elapsed_ms` and `turns` to each response so abandonment can be measured later.
- **Files:** `n8n/src/intake-and-safety-engine.js`
- **Effort:** S · **Owner:** me + re-import

---

## 5. Phase 3 — Traceability (needs your SQL)

### T10 · Migration `007_outcome_log.sql` — fixes I9
- **What:** one table `kiosk_outcome_log`: `id, session_key (hash), country_code, language_code, pathway_code, age_band, duration_code, severity_code, outcome, reason_codes text[], turns, created_at`. **No names, no free text, no symptom sentences, no raw state.**
- **Files:** new `supabase/migrations/007_outcome_log.sql` (I write it, **you paste it** in the SQL Editor)
- **Accept:** `select count(*) from kiosk_outcome_log;` grows after a kiosk session; RLS enabled with no public read.
- **Effort:** S · **Owner:** me writes / you run

### T11 · Deterministic insert node in n8n
- **What:** one Supabase *Insert* node fed only from the terminal branches (after `Return Touchscreen Response` is not possible — use a second branch before it), `onError: continueRegularOutput` so logging failure never blocks the customer.
- **Files:** `n8n/build-workflow.mjs` → rebuild → re-import
- **Accept:** a completed session writes exactly one log row; killing the insert (bad credential) still returns a normal customer response.

### T12 · Retention rule
- **What:** `delete from kiosk_outcome_log where created_at < now() - interval 'X days'` via a scheduled job or in-migration policy; X from decision C (30 / 90 / 365).
- **Owner:** me writes, you run

### T13 · Dead schema decision
- **What:** `ui_messages` is unused. Wire it or `drop table ui_messages`.
- **Owner:** you decide (decision F)

---

## 6. Phase 4 — Operations

### T14 · `git init` + baseline commit — fixes I10
- **What:** repo with `.gitignore` (`node_modules/`, `tmp/`, `.env`, `tools/piper/**` binaries), first commit of the current verified state.
- **Accept:** `git status` clean; `git log` shows the baseline; future drift is a diff.
- **Effort:** 10 min · **Owner:** me, with your approval (decision B)

### T15 · `npm run check`
- **What:** `test` + `test:journeys` + `build:workflow` + a drift check that fails if the committed workflow JSON differs from a fresh build.
- **Files:** `package.json`, new `scripts/check-workflow-drift.mjs`
- **Accept:** edit `n8n/src` without rebuilding → `npm run check` fails with "re-import needed".

### T16 · Scheduled live smoke test
- **What:** every 15 min, one authenticated probe turn against production; alert on non-200 or on an unexpected `outcome`.
- **Owner:** me (Qoder cron or Windows Task), you pick the alert channel (decision E)
- **Accept:** temporarily break the secret → alert within 15 min.

### T17 · Credential binding on re-import — fixes I11
- **What:** put the real credential names/IDs into `n8n/build-workflow.mjs` (`Backend Service Auth Medtest` = `sKKZe6liXy5SsWfl`, `PILLPALL CHATBOT` = `2LlBAYIF92xtHmcJ`).
- **Accept:** a fresh import arrives with both credentials already selected.
- **Note:** IDs are not secrets; names must match your instance exactly.

### T18 · Runbook + archive
- **What:** a `RUNBOOK.md` with the exact click-path (import → credential → activate → secret → verify) and the curl one-liner; move `oldtest/` to `archive/`.

---

## 7. Phase 5 — Real security (decision needed first)

### T19 · Per-device tokens — fixes I12
- **Option A:** one Header Auth credential per kiosk, token stored in that machine's local `config.js` (never committed).
- **Option B:** nginx source-IP allowlist on `/webhook/pillpal-chat-turn` if the kiosks sit on a fixed network.
- **Reality:** any secret sent by a browser is readable from page source; this only raises the cost of casual abuse.

### T20 · HTTPS for the kiosk origin — required for reliable microphone permission once deployed.
### T21 · Kiosk browser hardening — fullscreen, no context menu, no devtools shortcut, auto-restart on crash.

---

## 8. Phase 6 — Product data and vending readiness
*Blocked on clinical + legal review, not on code.*
- **T22** Leaflets in Supabase Storage (AMMPS has no per-product PDFs; use ANSM notices) + `label_url` must be `http(s)`.
- **T23** Stock and price columns (pre-vending only; `dispense_authorized` stays `false`).
- **T24** Clinic referral reference code on the terminal screen.
- **T25** Brief speech mode for noisy pharmacies.
- **T26** Analytics view over `kiosk_outcome_log` (top pathways, refusal reasons, abandonment step).

---

## 9. Manual steps — only you can do these

| # | Step | Where |
|---|---|---|
| M1 | Confirm the Header Auth credential **Name** is exactly `x-pillpal-auth` and the **Value** matches `web/config.js` | n8n → Credentials → Backend Service Auth Medtest |
| M2 | Re-import `n8n/workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json` after every `n8n/src` change, then re-activate | n8n → Workflows → Import from File |
| M3 | Create `.env` from `.env.example` with `SUPABASE_URL` + service-role key, so `npm run audit:catalog` works | project root |
| M4 | Download `de_DE-thorsten-medium.onnx` + `.onnx.json` into `tools/piper/voices/` for German voice | piper VOICES repo |
| M5 | Run migration SQL I provide (007, retention) in the Supabase SQL Editor | Supabase dashboard |
| M6 | **To test the product path at all:** run `supabase/migrations/005_product_path_test_fixture.sql` (adds the synthetic `ZZ` test product only; no real medicine is enabled), then `npm run test:product-path` | Supabase SQL Editor |
| M7 | Verify only one active workflow uses path `pillpal-chat-turn` | n8n → Workflows |

---

## 10. Decisions I need from you

- **A** — approve Phase 1 (T1-T5)?
- **B** — may I run `git init` and commit the baseline (T14)?
- **C** — outcome log retention: 30 / 90 / 365 days (T12)?
- **D** — approve early refusals changing the flow shape (T6)?
- **E** — smoke-test alert channel: chat message, email, or a Supabase row (T16)?
- **F** — `ui_messages`: wire it or drop it (T13)?
- **G** — real auth route: per-device tokens or IP allowlist (T19)?

## 11. Explicitly out of scope
- No LLM (Gemini, MedGemma, or any model) in the safety, eligibility, or product-selection path. Rephrasing-only sidecar is the only permitted future use.
- No paid API services — the stack stays self-hosted (n8n, Supabase, Piper).
- No dispensing authorisation; `dispense_authorized` stays `false` on every response.
- No enabling of real Morocco medicines without documented clinical and legal review.

## 12. Verification runbook (copy-paste)

```powershell
cd "V:\LD Projects\PILLPALMEDVEN"
npm test                     # engine, i18n, voice mapper
npm run test:journeys        # 42 offline checks
$env:PILLPAL_WEBHOOK_SECRET="PillPalMedVend"
npm run test:journeys:live   # 31 journeys against production
npm run build:workflow       # after any n8n/src change, then re-import (M2)
curl.exe -s -o NUL -w "%{http_code}" -X POST https://n8n.naf-cloudsystem.de/webhook/pillpal-chat-turn -H "Content-Type: text/plain" -H "x-pillpal-auth: PillPalMedVend" -d '{\"reset\":true}'
```

`200` = healthy. `403` = secret mismatch. Anything else = workflow not active.

---

## 13. Suggested order

1. **T14** (git baseline) — do this first so everything after is diffable
2. **T2, T1, T4** — the failure modes that actually bit today
3. **T17, T15** — stop re-import friction and silent drift
4. **T10, T11, T12** — you finally see what the kiosk is asked
5. **T6, T7, T8** — customer time and clarity, after decision D
6. **T16** — the watchdog
7. **T19** — real security, after decision G

**Effort:** Phase 1 ≈ one session · Phase 2 ≈ half a session + re-import · Phase 3 ≈ half a session + your SQL · Phase 4 ≈ one hour · Phases 5-6 need decisions first.
