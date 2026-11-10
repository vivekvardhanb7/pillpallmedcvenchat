# CURRENT_FEATURE_STATUS.md

**Date:** 2026-11-05
**Legend:** ✅ implemented and tested · 🟡 partial · ❌ not implemented · ⛔ blocked by
data/clinical decision

Status describes the **repository working tree**, not the deployed n8n copy. The
drift check confirms they match at audit time.

---

## 1. Safety and conversation

| Feature | Status | Evidence / limitation |
|---|---|---|
| Deterministic symptom interview | ✅ | 11-step state machine, 52 offline journeys |
| Question-id match guard | ✅ | Engine rejects an answer for the wrong step |
| State tamper re-validation | ✅ | `sanitizeState` on every turn; journey abuse cases |
| Early refusal at disqualifying answer | ✅ | Unsupported pathway, age, duration, severity, red flag, pregnancy, unsure history |
| Under-18 referral | ✅ | Age < 18 returns clinic referral immediately |
| > 7-day duration referral | ✅ | `more_than_7_days` refusal |
| Severe symptom referral | ✅ | `severe` refusal |
| Pathway-specific red flags | 🟡 | Full list for `pain_fever`; other pathways use a generic list |
| Pregnancy / breastfeeding gate | ✅ (conservative) | Any pregnancy/breastfeeding/prefer-not-to-say → referral; no product-specific exception |
| Allergy conflict blocking | ✅ | Conservative substring match |
| Contraindication blocking | ✅ | Same matcher |
| Drug-interaction blocking | ✅ | Same matcher |
| Duplicate active-ingredient detection | ❌ | Not implemented |
| Dose-limit / cumulative-dose enforcement | ❌ | Dose text is displayed, not validated |
| Renal/hepatic or drug-specific restrictions | 🟡 | Only whatever is written in free-text contraindication terms |
| Prescription-status enforcement | ❌ | No prescription field in the active path |
| Recall / regulatory-alert check | ❌ | No service or table |
| Pharmacist review / human escalation | ❌ | Referral text only; no queue or contact hand-off |
| Emergency contact and location display | 🟡 | Emergency notice exists; local numbers/location not configured |
| Conversation memory | 🟡 | State forwarded per turn; no persistent or cross-session memory; 30-turn cap |
| Repeat-question avoidance | ✅ | State-driven steps; volunteered-value handling for age/duration/severity |
| Ambiguous symptom clarification | 🟡 | Local intent/regex plus optional model; no clinician-authored disambiguation tree |
| Unsupported-pathway scope gate | ✅ | One-tap refusal in real countries |

## 2. Catalogue and product matching

| Feature | Status | Evidence / limitation |
|---|---|---|
| Approved-catalogue read | ✅ | `recommendable_product_pathways` |
| Age / duration / allergy / interaction / contraindication blocking | ✅ | `catalog-decision.js` |
| Priority-based substitution | ✅ | First passing row by `display_priority` |
| Differentiated refusal reasons | ✅ | Age-only, duration-only, all-blocked, catalogue-unavailable |
| Real Morocco product coverage | ⛔ | Migration `009` drafts 16 products as `in_review`, disabled; not applied/signed |
| Demo catalogue (ZZ) | 🟡 | 15 demo rows + 1 fixture enabled; data integrity problems (see below) |
| Alternative-medicine search (levels 1–4) | ❌ | Only same-pathway products |
| Fixed-dose-combination validation | ❌ | No combination model |
| Medicine name / synonym resolution | 🟡 | `medicine-mentions.js` brand dictionary; no ingredient synonym table |
| Stock / price / pharmacy availability | ❌ | No inventory or pharmacy API |
| Regulatory status per country | 🟡 | Status columns exist; no registration table or alert feed |
| Source/provenance per product | 🟡 | `clinical_source_url`, `label_url`; many external hosts, some `example.invalid` |
| Catalogue audit | 🟡 | `audit:catalog` checks approval fields, not provenance or synthetic origin |

## 3. Voice

| Feature | Status | Evidence / limitation |
|---|---|---|
| Local speech recognition | ✅ | whisper.cpp `ggml-base`, measured ~2.5 s |
| Browser speech recognition fallback | ✅ | Chrome/Edge |
| Gemini Live transcription | 🟡 | Code and transport tests pass; disabled in `.env` |
| Local TTS | ✅ | Piper English female voice, cached |
| Gemini TTS | 🟡 | Code present; disabled |
| Browser TTS fallback | ✅ | OS-dependent |
| Deterministic spoken-answer mapping | ✅ | EN/DE wording; tested |
| Optional model answer mapping | 🟡 | Gemini sidecar/bridge tested (19/19); disabled locally |
| Read-back confirmation | ✅ | Interpreted answers are confirmed before use |
| Barge-in | 🟡 | Button/orb action only; no acoustic barge-in or AEC |
| Voice activity / silence detection | ✅ | Threshold + timeout; hardware validation pending |
| Natural conversation wording | 🟡 | Voice-only prompts are hard-coded English |
| Multilingual voice output | ❌ | Only English Piper installed; German falls back to text/browser |
| Darija / French / MSA / Hindi / Telugu voice accuracy | ❌ / ⛔ | Not benchmarked; no installed voices |
| Real microphone/speaker acceptance test | ❌ | Headless tests only; requires the kiosk hardware |

## 4. Interface and localisation

| Feature | Status | Evidence / limitation |
|---|---|---|
| Touchscreen assessment UI | ✅ | Live walkthrough |
| Premium voice page | ✅ (desktop) | `voice.html`, desktop render inspected |
| Short-viewport responsiveness | ❌ | Clips at 525×482; premium media query missing |
| Dark/light theme | ✅ | `pillpal-theme` |
| English interface | ✅ | `STRINGS.en` |
| German interface | ✅ | `STRINGS.de`, key parity tested |
| 60-language selector | 🟡 | 60 entries, 2 dictionaries; fallback to English |
| Voice-page static copy localisation | ❌ | No `data-i18n` attributes |
| Dynamic translation | 🟡 | `/api/translate` exists; disabled without Gemini/Ollama |
| Product safety text localisation | ❌ | English data shown verbatim |
| Accessibility labels | 🟡 | Main controls labelled; mobile dock labels hidden below 700 px without aria-label |
| Offline/online indicator | 🟡 | Browser online/offline events in voice experience; no last-sync date |
| Transcript privacy | ✅ | Page memory only; cleared on end/inactivity |

## 5. Logging, operations, security

| Feature | Status | Evidence / limitation |
|---|---|---|
| Anonymous outcome log | ✅ | One row per completed assessment |
| Log failure contained | ✅ | `onError: continueRegularOutput` |
| Retention/prune | 🟡 | Function exists; no scheduled job |
| Startup self-check badge | ✅ | Probe turn on boot |
| Config-change watcher | ✅ | 60 s re-fetch |
| Workflow drift check | ✅ | Build + live mode |
| Scheduled live watchdog | ❌ | No cron/Task Scheduler artefact |
| CI | ❌ | None |
| Webhook header auth | ✅ | Rejects before workflow runs |
| Rate limiting | ❌ | None at any layer |
| TLS on kiosk origin | ❌ | HTTP on LAN |
| CSP / security headers | ❌ | Only `nosniff` |
| Static source allowlist | ❌ | `server.mjs` downloadable |
| Per-device tokens / RBAC | ❌ | Shared secret |
| Dependency supply chain | ✅ | Zero runtime npm dependencies |
| Secret handling | 🟡 | `.env` and `config.js` ignored; client secret by design; historical doc leak scrubbed |
| n8n execution-data retention | ❌ | Unset; may retain transcripts |
| Legal/privacy position for Gemini | ❌ | Not documented for Morocco/EU |

## 6. Offline capability

| Capability | Status | Note |
|---|---|---|
| Local speech recognition / TTS | ✅ | Piper + whisper.cpp |
| Local answer mapping | ✅ | Deterministic mapper |
| Local safety decision | ❌ | Runs in hosted n8n |
| Local catalogue | ❌ | Supabase only |
| Local outcome queue | ❌ | Requires network |
| Core text workflow without internet | ❌ | Stops when n8n/Supabase unreachable |
| Core voice workflow without internet | ❌ | Same dependency |
| Automatic online/offline mode | ❌ | UI indicator only |
| Last-sync / failed-sync recovery | ❌ | None |

**This is the largest gap against the brief.** The project is "Gemini-free", not
"offline-first".

## 7. Vending and dispensing

| Feature | Status |
|---|---|
| Product selection | ✅ (advice only) |
| Cart / payment | ❌ |
| Vending inventory | ❌ |
| Dispensing controller | ❌ |
| Dispensing authorisation | ❌ — always `false` by design |
| Hardware interlock / audit | ❌ |

## 8. Verified test evidence

| Suite | Result |
|---|---|
| `npm test` (9 suites) | PASS |
| Offline customer journeys | 52/52 |
| Live journeys | 36/37 (1 skipped) |
| Live product path | PASS |
| Hosted answer-understanding sidecar | 19/19 |
| Workflow drift (repo) | PASS |
| Workflow drift (live) | PASS (earlier run) |
| Catalogue audit | 62 products / 16 enabled / 0 blockers by current rules |
| Live browser assessment | PASS |
| Voice viewport | FAIL at 525×482 |
| Physical mic/speaker | NOT TESTED |
