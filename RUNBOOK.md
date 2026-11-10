# PILLPAL MedAssist - operations runbook

Practical steps for the machine, the workflow and the database. The design
rationale and clinical boundaries live in `README.md`; the open work list lives
in `PLAN.md`. This file is only "how to run it and how to fix it".

## 0. Invariants (never break these)

- No LLM anywhere in the safety, eligibility or product path. The engine and the
  matcher are plain deterministic JavaScript, and the optional answer helper
  (section 7) only rewrites what the customer said into a value that is already
  on the screen - it never sees the session state and never reaches a decision.
- `dispense_authorized` is `false` in every response. Vending hardware is not
  authorised by this workflow.
- The kiosk never diagnoses and never prescribes; refusals point to a clinic,
  doctor or pharmacy.
- The Supabase service-role key stays in n8n credentials and `.env`. It must
  never appear in `web/`.
- Real Morocco medicines stay disabled (`chatbot_enabled = false`) until they
  pass clinical and legal review. Testing uses the isolated `ZZ` fixture.
- The symptom menu offers every category, but `SUPPORTED_PATHWAYS` in the engine
  decides which ones are actually assessed. A category outside that set is
  refused on the first tap, so nobody spends ten taps reaching a dead end.

## 1. First-time setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (only `npm run audit:catalog` needs them).
3. Copy `web/config.example.js` to `web/config.js`, then set:
   - `webhookUrl` - the production URL of the Chat Turn Webhook node
     (`/webhook/...`, or `/webhook-test/...` only while n8n is in Listen mode).
   - `webhookSecret` - identical to the **Value** of the n8n Header Auth
     credential. `web/config.js` is git-ignored because it is served to the
     browser; it is a casual-abuse deterrent, not a secret store.
   - `understandUrl` / `understandStatusUrl` - optional, only if this kiosk
     should use the hosted answer helper instead of its own bridge (section 6).
4. `npm install` (no runtime dependencies; this only creates `node_modules`).
5. Optional local voice: put Piper in `tools/piper/` and the voice models in
   `tools/piper/voices/`. Missing models are reported honestly by the UI, which
   falls back to on-screen text.
6. `npm start` then open `http://localhost:8080`.

## 2. n8n workflow

The importable artefact is
`n8n/workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json`.

Node order: Chat Turn Webhook -> Intake and Safety Engine -> Needs Approved
Product Catalog? -> (Load Approved Products from Supabase -> Deterministic
Product Matcher) -> Return Touchscreen Response -> Assessment Finished? ->
Build Outcome Log Row -> Insert Outcome Log Row.

Credentials the JSON expects (names and ids of this instance):

| Node | Type | Name | ID |
| --- | --- | --- | --- |
| Chat Turn Webhook | Header Auth | `Backend Service Auth Medtest` | `sKKZe6liXy5SsWfl` |
| Load Approved Products from Supabase | Supabase API | `PILLPALL CHATBOT` | `2LlBAYIF92xtHmcJ` |
| Insert Outcome Log Row | Supabase API | `PILLPALL CHATBOT` | `2LlBAYIF92xtHmcJ` |
| Understand Webhook / Status Webhook (sidecar) | Header Auth | `Backend Service Auth Medtest` | `sKKZe6liXy5SsWfl` |
| Ask Gemini (sidecar) | Google Gemini(PaLM) API | `NAF google APi` | `uD7oERyQHg8sHOUI` |

The Header Auth credential is read as the request header `x-pillpal-auth`; n8n
rejects non-matching requests before the workflow runs, so no `$env` lookup is
needed anywhere (this instance blocks `$env` inside nodes).

To deploy an engine change:

```bash
# edit n8n/src/intake-and-safety-engine.js or n8n/src/catalog-decision.js
npm run build:workflow
npm run check          # fails while the JSON is stale
npm test
npm run test:journeys
```

Then either in the n8n UI (open the workflow, **Import from File**, select the
JSON, save, re-activate) or from the API, which avoids the UI import entirely:

```bash
node scripts/n8n-api.mjs push  CtomsWyOIBEuYrtX n8n/workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json --yes
node scripts/n8n-api.mjs get   CtomsWyOIBEuYrtX --nodes    # confirm the params survived
node scripts/check-workflow-drift.mjs --live               # MATCH on every code node
```

**Why the API push matters:** importing this JSON through the UI silently strips
the Supabase node's resource-mapped parameters (`tableId`, `columns`,
`matchingColumns`, `schema`). The node then looks configured in the editor and
fails at run time with `Could not get parameter "tableId"`. That is what made
`kiosk_outcome_log` stay empty for weeks. The same import also broke the outcome
logger even when the parameters survived, so the insert is now a plain HTTP
Request to PostgREST - do not convert it back to the Supabase node.

Live confirmation that the customer path works:

```bash
PILLPAL_WEBHOOK_SECRET=... npm run smoke:live
```

## 3. Supabase

Migrations must be applied in numeric order (SQL editor or CLI):

| File | Purpose |
| --- | --- |
| `000`-`003` | catalogue schema, research seed, inactive question templates |
| `004` | `recommendable_product_pathways` view - the only thing the workflow reads |
| `005` | isolated `ZZ` test fixture (disabled by `010` and blocked from re-enabling) |
| `006` | resets every `MA` product back to disabled/draft - required after any test editing |
| `007` | `kiosk_outcome_log` - anonymised outcome counters plus a prune function |
| `008` | synthetic `ZZ` demo catalogue across the widened pathways |
| `009` | 16 real Morocco products in `in_review`, disabled until signed off |
| `010` | data-integrity guard: provenance, fixture block, reviewer and max-duration checks |

After `007`, the workflow writes one row per finished assessment through
`Build Outcome Log Row` (sanitises every field against the CHECK constraints) and
`Insert Outcome Log Row` (HTTP Request to PostgREST). If the insert node reports
an error the customer still gets a response (`onError: continueRegularOutput`),
so check the node rather than assuming the kiosk is fine - a green execution with
an empty table is exactly how this failed before.

Two PostgREST details that bit us, both visible in the n8n execution log:

- A `201` with `Prefer: return=minimal` has an empty body, and the node threw
  `Cannot read properties of undefined (reading 'data')` **after** the insert.
  With `retryOnFail` on, every row was written twice. `retryOnFail` must stay
  `false` on that node.
- `service_role` has `select, insert` only, so test rows cannot be deleted
  through REST. Clean up leftovers in the SQL editor:

```sql
delete from public.kiosk_outcome_log where session_key = 'session_invalid';
```

Retention defaults to 90 days and is **not** automatic. Run periodically:

```sql
select public.prune_kiosk_outcome_log(90);
```

`chat_sessions`, `session_answers`, `chat_events`, `decisions`,
`decision_products` and `ui_messages` exist but are unused by the workflow.
`decisions.outcome` cannot even store `CATALOG_CHECK_REQUIRED`. Do not write to
them without a migration; `kiosk_outcome_log` is the intended log.

### Widening the symptom menu

`SUPPORTED_PATHWAYS` in `n8n/src/intake-and-safety-engine.js` currently holds
`pain_fever` only. Add a pathway there only when all of these are true, in order:

1. A `product_safety` row exists with `review_status = 'approved'` and a real
   leaflet source - not a remembered dose.
2. `maximum_duration_days` is set, because the matcher now blocks a product when
   the reported symptom lasts longer than that (upper bound of the band is used,
   so `3_to_7_days` counts as 7 days).
3. A `product_pathways` row with `approval_status = 'approved'` links it to the
   pathway, and `symptom_pathways` is `enabled` with `clinical_status = 'approved'`.
4. A row exists for **every** kiosk language. `npm run audit:catalog` prints the
   coverage; a pathway visible in English only is invisible in German.
5. Clinical and legal sign-off is recorded, and `006` is not re-run afterwards
   without re-checking it.

Then rebuild (`npm run build:workflow`), re-import, and run
`npm run test:journeys` - the 1-tap refusal journeys for the other categories
must be moved to full-length journeys deliberately, not deleted.

## 4. Testing

| Command | Needs | Covers |
| --- | --- | --- |
| `npm test` | nothing | engine, matcher, outcome-row sanitiser, answer-understanding guardrails, sidecar Code nodes, i18n (incl. EN/DE key parity), voice mapper, workflow drift |
| `npm run test:journeys` | nothing | 36 customer journeys + 14 abuse checks (50 assertions) against `n8n/src` |
| `npm run check` | nothing | the built JSON still matches `n8n/src` and the shared AI module, credentials bound, no `$env` |
| `npm run check -- --live` | `.env` with `N8N_API_KEY` | the **deployed** workflows match the build, node by node |
| `PILLPAL_WEBHOOK_SECRET=... npm run smoke:live` | live n8n | auth accepted, auth rejected without a header, first three questions |
| `PILLPAL_WEBHOOK_SECRET=... npm run test:journeys:live` | live n8n | the same journeys against the deployed workflow (35 run, 1 skipped - it needs a catalogue row this database does not have) |
| `PILLPAL_WEBHOOK_SECRET=... npm run test:product-path` | live n8n + migration `005` | the eligible and allergy-blocked product paths |
| `npm run test:ai` | live n8n + `.env` AI keys | 14 spoken answers in French, Darija and MSA mapped onto real screens, then submitted through a real assessment |
| `npm run test:ai:sidecar` | live n8n sidecar | the hosted Gemini path, incl. refusal to serve a caller without the header |
| `npm run build:sidecar` | `.env` | regenerate `n8n/workflows/PILLPAL_Understand_Sidecar.json` |
| `npm run audit:catalog` | `.env` | catalogue readiness, blockers, language coverage |

`npm run audit:catalog` language coverage matters: the matcher drops rows whose
`language_code` is not the language the customer chose, so a pathway can look
populated in Supabase and still return nothing on screen.

Every live script reads `.env` through `scripts/load-env.mjs`. A live run that
forgets it silently sends no auth header and every request comes back 403, which
looks like a broken kiosk rather than a missing import.

## 5. Operator badge and common failures

`web/app.js` runs a startup self-check and a config watcher that post a small
badge above the composer (`SETUP: ...`, `CONFIG UPDATED - reload this page`).
It only ever appears for an operator; customers keep working.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Badge: "kiosk key does not match" | `webhookSecret` differs from the Header Auth value, or the node lost its credential | set them equal, reload the page |
| Badge: "no kiosk key configured" | `webhookSecret` is empty in `web/config.js` | fill it in, reload |
| HTTP 403/401 on every turn | same as above, or the workflow is inactive | re-activate the workflow |
| Every assessment ends "no suitable product" | catalogue is empty or `language_code` mismatched | `npm run audit:catalog` |
| Voice says SPEAKING but is silent | language model missing - the UI now falls back to text | install the Piper voice for that language |
| Badge: "spoken-answer helper ... not usable" | `PILLPAL_AI_PROVIDER` is set but the key is missing or the provider name is wrong | fix `.env` and restart, or set `PILLPAL_AI_PROVIDER=off` |
| French/Darija answers always come back "not understood" | the helper is off, unreachable, or the model was retired for this API key | `curl localhost:8080/api/understand`, then `npm run test:ai` |
| Sidecar returns `provider_failed` for every call | the Gemini credential is invalid, or the n8n host cannot reach the model | `node scripts/n8n-api.mjs execution <id>` reads the node error |
| Engine behaves unlike `n8n/src` | the deployed workflow is stale | `npm run build:workflow` then push or re-import |

## 6. Spoken-answer understanding (optional)

A customer who says "j'ai tres mal a la tete" or "عندي حساسية من الأسبرين" does not
match the wording the built-in voice mapper knows. The helper maps that transcript
onto a value the screen already offers, and the kiosk reads it back before it is
used ("I understood: Headache, pain or fever. Is that correct?"). Nothing else
changes: the safety engine still receives ordinary option values.

What is guaranteed by `scripts/test-answer-understanding.mjs`:

- only the 13 real question ids are accepted, and a select answer must be one of
  the values on that screen - a model cannot invent a product or a value
- the request is rebuilt field by field, so `state`, `outcome` and
  `dispense_authorized` cannot reach the provider even if the browser sends them
- confidence below `PILLPAL_AI_MIN_CONFIDENCE` (default 0.6) comes back as
  `matched: false` and the kiosk simply asks again
- free text is stripped of HTML, truncated, and the reply object can carry only
  `matched`, `value`, `label`, `confidence`, `reason`

Two placements, same contract, both tested:

| Placement | Endpoint | Provider key lives in |
| --- | --- | --- |
| kiosk bridge (default) | `POST /api/understand` on `web/server.mjs` | `.env` on the kiosk box |
| n8n sidecar | `POST /webhook/pillpal-understand` | an n8n credential (`googlePalmApi`) |

To move a kiosk to the hosted sidecar, add these to `web/config.js` and reload:

```js
understandUrl: 'https://YOUR_N8N_HOST/webhook/pillpal-understand',
understandStatusUrl: 'https://YOUR_N8N_HOST/webhook/pillpal-understand-status',
```

The sidecar is a separate workflow (`Tq1UTgrin8HYd9s6`) that never touches the
customer safety chain: Understand Webhook -> Sanitize Request -> Usable Request?
-> Ask Gemini -> Validate Understanding -> Return Understanding. Both webhooks
require the same `x-pillpal-auth` header as the kiosk, so an anonymous visitor
cannot turn it into a free Gemini proxy. Rebuild and deploy it with:

```bash
npm run build:sidecar
node scripts/n8n-api.mjs push Tq1UTgrin8HYd9s6 n8n/workflows/PILLPAL_Understand_Sidecar.json --yes
npm run test:ai:sidecar
```

Its Code nodes are generated from `web/answer-understanding.js`, so
`npm run check` fails if that module changes without a rebuild.

Model notes:

- `gemini-2.5-flash-lite` is closed to new API keys (Google returns
  "no longer available to new users"); `gemini-3.5-flash-lite` is what both paths
  use now. One credential on this instance hangs until timeout on it, so
  `N8N_GEMINI_CREDENTIAL_ID` selects the one that answers (`NAF google APi`).
- Timing: about 0.9-1.5 s per answer. The sidecar waits up to 12 s for the
  provider and the kiosk gives the whole call 15 s, then disables the helper for
  60 s and carries on with taps and standard wording.

Privacy, before this goes into a shop:

- The transcript is the only customer content sent to the provider. `kiosk_outcome_log`
  never receives it, and the kiosk server only logs it when
  `PILLPAL_AI_LOG_TRANSCRIPT=1` (keep that off).
- n8n stores full execution data by default, so every spoken answer is readable
  in the n8n UI until executions are pruned. Set a short retention window on the
  instance, or run the bridge locally instead of the sidecar.
- Sending health information to a third-party model is a personal-data transfer.
  For Morocco that needs review against loi 09-08 (CNDP) and the provider's own
  retention terms; for EU customers the same applies under GDPR. Get that written
  down before a real customer's symptom is ever sent, and note that a pharmacy
  customer's "I take metformin" is health data even without a name attached.

## 7. Kiosk handover notes

- What is deployed on `https://n8n.naf-cloudsystem.de` right now:

| Workflow | ID | Active | Role |
| --- | --- | --- | --- |
| PILLPAL MedAssist - Supabase Safety Chat MVP | `CtomsWyOIBEuYrtX` | yes | the customer safety path |
| PILLPAL MedAssist - Spoken Answer Understanding (Gemini sidecar) | `Tq1UTgrin8HYd9s6` | yes | optional answer helper; created through the n8n API because the "new workflow" link in the handover note had no workflow behind it |

  Both are checked against the repository by `npm run check -- --live`.
- `archive/` holds superseded workflow exports, kept for reference only. Do not
  import them.
- The repository is git-tracked now; `web/config.js`, `.env`, `tmp/`, `outputs/`
  and `tools/piper/` are ignored on purpose.
- Nothing is pushed to a remote. If a remote is added later, rotate
  `webhookSecret` first: the current value was visible in a plain config file.
