# PILLPAL MedAssist - operations runbook

Practical steps for the machine, the workflow and the database. The design
rationale and clinical boundaries live in `README.md`; the open work list lives
in `PLAN.md`. This file is only "how to run it and how to fix it".

## 0. Invariants (never break these)

- No LLM anywhere in the safety, eligibility or product path. The engine and the
  matcher are plain deterministic JavaScript.
- `dispense_authorized` is `false` in every response. Vending hardware is not
  authorised by this workflow.
- The kiosk never diagnoses and never prescribes; refusals point to a clinic,
  doctor or pharmacy.
- The Supabase service-role key stays in n8n credentials and `.env`. It must
  never appear in `web/`.
- Real Morocco medicines stay disabled (`chatbot_enabled = false`) until they
  pass clinical and legal review. Testing uses the isolated `ZZ` fixture.

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
Log Outcome (anonymised).

Credentials the JSON expects (names and ids of this instance):

| Node | Type | Name | ID |
| --- | --- | --- | --- |
| Chat Turn Webhook | Header Auth | `Backend Service Auth Medtest` | `sKKZe6liXy5SsWfl` |
| Load Approved Products from Supabase | Supabase API | `PILLPALL CHATBOT` | `2LlBAYIF92xtHmcJ` |
| Log Outcome (anonymised) | Supabase API | `PILLPALL CHATBOT` | `2LlBAYIF92xtHmcJ` |

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

Then, in n8n: open the workflow, **Import from File**, select the JSON, save and
re-activate. `npm run check` only proves the JSON matches `n8n/src`; it cannot
see what is running on the server, so the live confirmation is:

```bash
PILLPAL_WEBHOOK_SECRET=... npm run smoke:live
```

## 3. Supabase

Migrations must be applied in numeric order (SQL editor or CLI):

| File | Purpose |
| --- | --- |
| `000`-`003` | catalogue schema, research seed, inactive question templates |
| `004` | `recommendable_product_pathways` view - the only thing the workflow reads |
| `005` | isolated `ZZ` test fixture (the only product the matcher can currently return) |
| `006` | resets every `MA` product back to disabled/draft - required after any test editing |
| `007` | `kiosk_outcome_log` - anonymised outcome counters plus a prune function |

After `007`, the workflow starts writing one row per finished assessment. If the
insert node reports an error, the customer still gets a response
(`onError: continueRegularOutput`), so check the node rather than assuming the
kiosk is fine.

Retention defaults to 90 days and is **not** automatic. Run periodically:

```sql
select public.prune_kiosk_outcome_log(90);
```

`chat_sessions`, `session_answers`, `chat_events`, `decisions`,
`decision_products` and `ui_messages` exist but are unused by the workflow.
`decisions.outcome` cannot even store `CATALOG_CHECK_REQUIRED`. Do not write to
them without a migration; `kiosk_outcome_log` is the intended log.

## 4. Testing

| Command | Needs | Covers |
| --- | --- | --- |
| `npm test` | nothing | engine, matcher, i18n (incl. EN/DE key parity), voice mapper, workflow drift |
| `npm run test:journeys` | nothing | 47 customer journeys and abuse cases against `n8n/src` |
| `npm run check` | nothing | the built JSON still matches `n8n/src`, credentials bound, no `$env` |
| `PILLPAL_WEBHOOK_SECRET=... npm run smoke:live` | live n8n | auth accepted, auth rejected without a header, first three questions |
| `PILLPAL_WEBHOOK_SECRET=... npm run test:journeys:live` | live n8n | the same journeys against the deployed workflow |
| `PILLPAL_WEBHOOK_SECRET=... npm run test:product-path` | live n8n + migration `005` | the eligible and allergy-blocked product paths |
| `npm run audit:catalog` | `.env` | catalogue readiness, blockers, language coverage |

`npm run audit:catalog` language coverage matters: the matcher drops rows whose
`language_code` is not the language the customer chose, so a pathway can look
populated in Supabase and still return nothing on screen.

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
| Engine behaves unlike `n8n/src` | the deployed workflow is stale | `npm run build:workflow` then re-import |

## 6. Kiosk handover notes

- `archive/` holds superseded workflow exports, kept for reference only. Do not
  import them.
- The repository is git-tracked now; `web/config.js`, `.env`, `tmp/`, `outputs/`
  and `tools/piper/` are ignored on purpose.
- Nothing is pushed to a remote. If a remote is added later, rotate
  `webhookSecret` first: the current value was visible in a plain config file.
