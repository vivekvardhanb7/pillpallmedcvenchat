# SECURITY_REVIEW.md — PILLPAL MedAssist MVP

**Date:** 2026-11-03 · Scope: whole repo, live deployment checks performed in PROJECT_ANALYSIS §10.
**Rule observed:** this document contains **no secrets, tokens, keys or passwords**. Values are described by shape/name only.

---

## 1. Overview of the trust model

```
Customer browser (kiosk)
  --X-PILLPAL-Auth: shared kiosk secret--> n8n webhook (public hostname)
  --service_role (server-side credential only)--> Supabase Postgres (RLS deny-all to anon/authenticated)
Local Node server: static assets + /api/tts (no auth, LAN)
```

* The **browser never touches Supabase** — no anon key anywhere in `web/`, `web/config.js` holds only the webhook URL + kiosk secret. Verified by reading every `web/*` file.
* The **service-role key** appears only in `.env` (gitignored) and inside n8n credentials ("PILLPALL CHATBOT"). Verified in code paths (`scripts/audit-catalog.mjs`, `web/server.mjs` never reads it; docker-compose passes through env).
* No Supabase Auth tables/flows are used; `anon`/`authenticated` roles are revoked everywhere (migration 001 lines 506–523; 007 revoke).

---

## 2. Findings

| # | Area | Severity | Finding | Detail & recommendation |
| --- | --- | --- | --- | --- |
| SEC1 | Secret handling | **Critical** | The kiosk shared secret exists as a **literal in committed `PLAN.md`** (2 occurrences at `HEAD`), besides the correct-but-gitignored `web/config.js` and `.env` | Rotate the secret (owner decision D2): update the n8n Header Auth credential value + `web/config.js` + any `.env` copy in the same operation. Then scrub PLAN.md §12 (placeholder text). If a remote is ever added without rotation, assume the secret is burned (RUNBOOK §6 already anticipates this). Git-history rewrite (BFG) is only justified before pushing to a remote |
| SEC2 | Secret handling | High | The kiosk secret ships in the browser bundle by design (`web/config.js` is served). It is acknowledged in RUNBOOK as a "casual-abuse deterrent, not a secret store". Current value is short and dictionary-derived (per PLAN I12) | Short-term: rotate + prefer a high-entropy value (it is machine-supplied, not typed by humans). Medium-term: per-device tokens or IP allowlist (PLAN T19 options A/B). Any token an attacker can read in page source has a floor — rate limiting (SEC5) is the real cost lever |
| SEC3 | Secret handling | Info | `.env` and `web/config.js` gitignored correctly; `.env.example` placeholders only; no secrets in test scripts (they refuse to run without env) | Keep. Verified `.gitignore` covers `.env`, `web/config.js`, `node_modules`, `tools/piper`, `tmp/`, `outputs/` |
| SEC4 | AuthZ Supabase | ✅ Strong | RLS enabled on all 15 tables + both views, **no policies** (deny-all), GRANT only to `service_role`; security-invoker views; functions (`set_updated_at`, `enforce_product_safety_before_enable`, `prune_kiosk_outcome_log`) revoked from `public/anon/authenticated` | Maintain. No first-party browser client exists, so "no policies" = correct |
| SEC5 | Webhook/API security | High | Header Auth rejects non-matching requests before any node (verified live: 401/403 without header). But: no rate limiting at any layer; responses carry `Access-Control-Allow-Origin: *`; one log row per finished session is free for an authenticated abuser | Rate-limit at the host/proxy on `/webhook/pillpal-chat-turn` (per-IP bucket) — needs infra access (D7). Keep `ACAO: *` acceptable only while the secret gates all access; revisit if per-device tokens land |
| SEC6 | Webhook/API security | Medium | Kiosk origin is plain HTTP (`http://localhost:8080`, bind `0.0.0.0`); mic permission + integrity not guaranteed on LAN; `/api/tts` is unauthenticated with 8 KB body cap and concurrency guard but unbounded cache (see A5) | PLAN T20: terminate TLS for the kiosk origin (self-signed + kiosk-trusted is fine for a LAN unit); add CSP + favicon (F3); TTS cache cap (F2). Bind to a specific LAN IP if the host has one |
| SEC7 | Data validation | ✅ Good | Three-layer validation: (1) DB CHECK constraints + enable-trigger, (2) engine `sanitizeState` re-validates the echoed state every turn + question-id match guard + text scrub/truncate, (3) frontend maps free text to controlled values only | Verified by journey tests #31–#45 (tampered state, forged flags, HTML injection, oversized input rejected) |
| SEC8 | XSS/HTML | ✅ Good | All dynamic DOM insertion passes `escapeHtml`; URLs rendered only when `/^https?:\/\//i` matches; free-text echo is engine-scrubbed | F3's CSP adds defence-in-depth |
| SEC9 | Sensitive data (privacy) | ✅ Strong | Transcript stays in page memory, cleared on session end; outcome log stores no free-text terms, no exact age (band), no symptom text; retain+prune function; TTS input is text the UI already showed; no raw audio leaves the machine | Keep. Public vendor STT caveat documented in README (browser speech service) |
| SEC10 | Depend. supply chain | ✅ Strong | Zero runtime npm dependencies; no build toolchain; Piper binaries are vendored executables (gitignored) | Keep. Do not add dependencies for cosmetic gains |
| SEC11 | Config drift | Low | Local docker-compose `N8N_BLOCK_ENV_ACCESS_IN_NODE:"false"` vs production block | Align to `"true"` (N5). Drift check already forbids `$env` in the build |
| SEC12 | Ops monitoring | Medium | Auth failure and contract drift are silent in production today (watchdog missing — A4) | N2 watchdog (15-min smoke) closes the loop |
| SEC13 | Legacy artefacts | Info | `archive/` contains 2 older LLM-based workflow exports with different (looser) behaviour | Never import; RUNBOOK already warns; documented refusal |

---

## 3. Attack-surface walkthrough (residual risk)

| Vector | Gained without secret | Gained with secret |
| --- | --- | --- |
| n8n webhook | 401/403 noise only | Full power: unbounded interview turns, Supabase catalog reads, one log row per finished fake session (log spam) → rate limiting is the backstop |
| `web/server.mjs` (LAN) | Read static files (includes `web/config.js` → thus the secret!) | `/api/tts` unauthenticated use + disk-fill via cache (bounded only by latency caps) |
| `tmp/` outputs | nothing sensitive (audio for displayed text) | — |
| Supabase | plausible-denial deny-all (RLS) | service-role is the crown jewel; only ever in n8n credential + `.env` |

**Conclusion:** the highest-value hardening actions, in order: **SEC1 rotation (data already in a committed doc)** → **SEC5 rate limit** → **SEC6 TLS + CSP + TTS cache cap** → per-device tokens when multi-kiosk arrives.
