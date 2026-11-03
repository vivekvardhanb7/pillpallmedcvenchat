# PILLPAL MedAssist MVP

English-first research implementation for a touchscreen medical-vending-machine
assistant. The system uses deterministic intake and safety logic in n8n and
queries only clinically and legally approved products from Supabase.

This version **does not authorize dispensing**. Every response contains
`dispense_authorized: false` until a later hardware-control phase is implemented
and reviewed.

## Included

- Supabase schema, safety controls and research seed data
- Importable n8n workflow
- Deterministic interview and product-matching code
- Touchscreen web client
- English voice input
- Local neural female voice output via Piper, with browser-voice fallback
- Animated black-and-gold voice visualizer
- Chronological live conversation transcript
- Local static web server
- Automated engine and spoken-answer tests, including product safety blocking
- Optional synthetic product-result fixture
- Optional multilingual answer understanding (kiosk bridge or Gemini sidecar in n8n), read back before use
- Docker Compose configuration for self-hosted n8n

## 1. Create the Supabase schema

In **Supabase Dashboard → SQL Editor**, run each complete file with no partial
text selection:

1. `supabase/migrations/000_catalog_prerequisites.sql`
2. `supabase/migrations/001_medical_chatbot_schema.sql`
3. `supabase/migrations/002_research_seed.sql`
4. `supabase/migrations/003_inactive_question_templates.sql`
5. `supabase/migrations/004_n8n_catalog_api.sql`
6. `supabase/migrations/005_product_path_test_fixture.sql` (optional test fixture)
7. `supabase/migrations/006_reset_research_catalog.sql` (safety reset)

The seed products and pathways remain disabled. This is expected.

Migration 005 is optional. It adds one synthetic record in the reserved test
country `ZZ` so the product-result path can be exercised without enabling any
real medicine. It is not a clinical or legal approval and deliberately cannot
appear in Morocco (`MA`) kiosk traffic. See section 6.

Migration 006 reverts any manual edit that enabled, approved or attached a
leaflet or dose text to a Morocco research product (for example test data
entered through the Table Editor). After running it, no real medicine can
reach the kiosk until it passes full clinical and legal review.

## 2. Test and build the n8n workflow

Node.js 20 or newer is required. No npm packages need to be installed.

```powershell
cd "V:\LD Projects\PILLPALMEDVEN"
npm test
npm run build:workflow
npm run build:sidecar   # only if the spoken-answer helper (section 8) is used
```

`npm run test:journeys` walks 36 simulated customer conversations plus 14 abuse
and tampering checks through the engine (every pathway, refusals, safety blocks,
invalid and forged answers). `npm run test:journeys:live` runs the same journeys
against a real webhook; every live script loads `.env` for the auth header.
`npm run check -- --live` compares both deployed workflows against this
repository node by node.

Generated workflows:

`n8n/workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json` (safety path)
`n8n/workflows/PILLPAL_Understand_Sidecar.json` (optional answer helper)

On a hosted instance where you cannot restart the container, push the built JSON
through the n8n API instead of the UI import:

```powershell
node scripts/n8n-api.mjs push <workflowId> n8n/workflows/<file>.json --yes
```

The UI import silently strips the Supabase node's table and column parameters, so
the node looks right in the editor and fails at run time. That is also why the
outcome logger is an HTTP Request to PostgREST rather than a Supabase node.

## 3. Configure n8n

### Existing self-hosted n8n

Add these environment variables to the n8n server and restart it:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

On an instance you cannot restart, skip the env vars and bind a **Supabase
credential** to the two Supabase nodes instead - the built JSON already references
one by id, and a credential works even when `$env` is blocked.

The service-role key belongs only on the n8n server. Never add it to `web/config.js`
or browser code.

The webhook protects itself with n8n's Header Auth, so no `$env` access is needed
inside the workflow (this works even when the server blocks `$env` with
`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`). After importing, create the credential once:

1. **n8n → Credentials → Add credential → Header Auth**: Name `x-pillpal-auth`,
   Value = your chosen secret.
2. Open **Chat Turn Webhook** → *Authentication* → **Header Auth** → select that
   credential.
3. Put the same secret in `web/config.js` → `webhookSecret`.

Requests without a matching header are rejected by n8n before the workflow runs.

Import the generated workflow through **n8n → Workflows → Import from File**, then
activate it. Its production webhook is:

```text
http://localhost:5678/webhook/pillpal-chat-turn
```

While using n8n's **Listen for test event**, temporarily use:

```text
http://localhost:5678/webhook-test/pillpal-chat-turn
```

### Start a new local n8n with Docker

Copy `.env.example` to `.env`, fill in the Supabase values, and set a long random
`N8N_ENCRYPTION_KEY`.

```powershell
Copy-Item -LiteralPath ".env.example" -Destination ".env"
notepad .env
docker compose up -d
```

Open `http://localhost:5678`, finish the n8n owner setup, import the generated
workflow and activate it.

## 4. Run the touchscreen

Check `web/config.js`. Its default webhook URL expects an active local n8n
workflow.

```powershell
npm start
```

Open:

```text
http://localhost:8080
```

Tap **Tap to Start**. The assistant speaks first with:

```text
Hello, how can I help you today?
```

Each question can be answered by touching an option or tapping **Tap to speak**.
The voice transcript is converted into the same controlled values as the touch
buttons, so voice input cannot bypass the deterministic safety workflow.

For the best voice-input support, use a current Chrome or Microsoft Edge kiosk
browser and allow microphone permission for `http://localhost:8080`. A deployed
version must use HTTPS for reliable microphone access. Touch input remains fully
available when speech recognition is unsupported or permission is denied.

### Light and dark themes

The header includes a theme toggle. **Dark** is the default; **Light** switches to
a white and mint surface palette. Both use the same pharmacy-green accent. The
choice is stored in `localStorage` under `pillpal-theme`; until a choice is made,
the page follows the operating system `prefers-color-scheme` setting.

### English and German

The transcript header has an **EN / DE** selector. English is the default. The
choice is stored in `localStorage` under `pillpal-language`. Typed or recognized
text is also checked for German, and the interface switches automatically when
the language is clear. Question titles, option labels, confirmations, errors,
summaries and result messages are localized; product names, strengths,
instructions and warnings remain exactly as stored in Supabase and the approved
label. Speech recognition and browser text-to-speech use `en-US` or `de-DE`
according to the selected language, and `language_code` is sent to n8n with every
turn.

### Local neural female voice

Spoken output uses **Piper**, a local neural text-to-speech engine served by the
touchscreen server at `POST /api/tts`. It runs offline, needs no API key, and
defaults to the female voice `en_US-hfc_female-medium`. Synthesized WAVs are
cached in `tmp/tts-cache`, so the greeting and fixed questions become instant
after their first play.

Windows setup:

1. Download `piper_windows_amd64.zip` from
   `https://github.com/rhasspy/piper/releases` (release `2023.11.14-2`).
2. Extract it so `tools/piper/piper.exe` and `tools/piper/espeak-ng-data/`
   exist.
3. Download the voice model and its config into `tools/piper/voices/`:
   - `en_US-hfc_female-medium.onnx`
   - `en_US-hfc_female-medium.onnx.json`

   Both are under
   `https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/hfc_female/medium`.
4. Optionally add a German model pair, for example
   `de_DE-thorsten-medium.onnx` and `de_DE-thorsten-medium.onnx.json`, under
   `https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/medium`.
5. Restart `npm start`. The log lists each installed language, for example
   `Neural voices ready: en=en_US-hfc_female-medium, de=de_DE-thorsten-medium`.

On Linux or macOS, use the matching Piper archive and set `PIPER_BIN` in
`.env`. Set `PIPER_MODEL` to change the English voice. To point at additional
models, set `PIPER_MODELS` as a comma-separated `code=path` list:

```text
PIPER_MODELS=en=tools/piper/voices/en_US-hfc_female-medium.onnx,de=tools/piper/voices/de_DE-thorsten-medium.onnx
```

Set `PIPER_LENGTH_SCALE` above `1.0` to speak more slowly. `GET /api/tts`
reports which languages are installed.

If Piper, the model for the selected language, or synthesis is unavailable, the
client automatically falls back to the browser voice for that locale. It prefers
an available voice from the list in `web/config.js`, then any matching
`en-US`/`de-DE` voice; that fallback depends on the operating system/browser, so
its gender cannot be guaranteed. Piper itself is clearly more natural than OS
text-to-speech, though not identical to ElevenLabs or ChatGPT voices.

No raw audio is sent to n8n; spoken text goes only to the local touchscreen
server for synthesis. Browser speech-recognition implementations may use their
vendor's speech service. The visible transcript is held only in the current
browser page and is cleared when a new assessment starts.

## 5. Direct webhook test

```powershell
$requestBody = @{
  session_id = "manual_test_001"
  country_code = "MA"
  language_code = "en"
  reset = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5678/webhook/pillpal-chat-turn" `
  -ContentType "text/plain" `
  -Body $requestBody
```

The first result should contain:

```json
{
  "outcome": "MORE_INFORMATION",
  "screen": {
    "question_id": "symptom",
    "type": "single_select"
  }
}
```

## 6. Exercise the product-result path (optional)

After applying migration 005, run the live check:

```powershell
npm run test:product-path
```

To target the deployed workflow instead of local n8n:

```powershell
node scripts/test-product-path-live.mjs https://YOUR_N8N_HOST/webhook/pillpal-chat-turn
```

The script starts two sessions in the isolated `ZZ` test country:

- eligible: expects `PRODUCT_ELIGIBLE` for `TEST FIXTURE PRODUCT`
- blocked: answers the allergy question with `test ingredient`, expecting
  `NO_SUITABLE_PRODUCT` with `all_products_blocked` / `allergy_conflict`

Both sessions must return `dispense_authorized: false`.

To preview the product screen on the kiosk itself, temporarily set
`countryCode: 'ZZ'` in `web/config.js`, complete the assessment, then restore
`MA`. The fixture is synthetic and is never returned for Morocco traffic.

## 7. Audit every medicine row

With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`, run:

```powershell
npm run audit:catalog
```

The audit reads all products, safety records, pathway mappings and countries
directly from Supabase and reports:

- **Blockers** — chatbot-enabled products that are not commercialised, not
  clinically/legally approved, missing an approved safety record or dose
  instructions, or missing an approved pathway mapping. Exit code is 1 while
  any blocker exists.
- **Warnings** — missing or external `label_url` (external leaflet hosts can
  die, like the AMMPS timeout; prefer Supabase Storage), missing age bounds,
  unknown country codes.

Disabled products are counted but not checked. Run this before enabling any
real medicine and after every catalog change.

## 8. Understanding a hard-to-parse answer (optional)

The built-in voice mapper knows the wording the kiosk itself speaks. A customer
who answers in French, Darija or Arabic instead ("j'ai tres mal a la tete",
"عندي حساسية من الأسبرين") used to get "sorry, I did not catch that", and a typed
free-text answer was stored word for word - which meant an allergy named in
Arabic could never match the catalogue's Latin-script rule terms.

An optional helper maps such an answer onto a value that is already on the screen
and the kiosk reads it back before using it. It is a translation layer, not a
decision-maker:

- it only ever returns a value from the current screen's option list (or a number
  inside the screen's bounds), so it cannot invent a medicine or a symptom
- the kiosk's session state, `outcome` and `dispense_authorized` are never sent
  to it; the request is rebuilt field by field from the transcript and the screen
- low confidence, an unclear answer or a question back to the kiosk returns
  `matched: false` and the question is simply asked again
- every interpreted answer goes through the "I understood X. Is that correct?"
  confirmation, and nothing interpreted is applied silently
- the safety engine, the eligibility rules and the product matcher are unchanged

Two routes, same contract: the kiosk's own `/api/understand` bridge, or a Gemini
sidecar workflow inside n8n that holds the provider key as a credential. Section 6
of `RUNBOOK.md` covers setup, timings, the guardrail tests and the privacy points
that need a decision before a shop deployment.

## Product approval behavior

The research seed does not return medicines. `recommendable_product_pathways`
returns only products satisfying all of these conditions:

- commercialised product
- clinical approval
- legal approval
- exact label URL and version
- complete approved product-safety record
- approved symptom-pathway mapping
- enabled pathway
- `chatbot_enabled = true`

The database rejects attempts to enable a product before those requirements are
complete.

## Current boundary

The general warning-sign screen is deliberately labelled incomplete. Before a
clinical pilot, add clinically reviewed pathway-specific questions and rules for
each supported symptom category. Do not enable products based only on the
research seed or Morocco report.

