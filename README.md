# PILLPAL MedAssist

Germany-first, voice-first medical-assistant prototype for a vending-machine interface.
The default `/` page is the voice experience; `/index.html` remains the touch/text fallback.
German is the default language. English is available, Hindi has explicitly labelled preview
questions, and other language choices show an English-fallback notice. Language selection
never changes the server's deployment country or medicine approval rules.

**Current safety milestone — 9 November 2026:** the local server owns assessment state,
rejects stale turns, and defaults to Germany (`PILLPAL_COUNTRY_CODE=DE`). Local and n8n
matchers share explicit approval and ingredient-conflict checks. Unreviewed catalogue
records and static alternative mappings cannot authorize a recommendation.
`dispense_authorized` remains false.

**German product recommendations are not ready:** no reviewed German clinical catalogue
is included. The existing MA/IN/INT JSON is reference data. Clinical offline releases require
an Ed25519 signature from an operator-configured trusted key, validity dates, checksum,
and complete product approval evidence. A signature is not a substitute for clinical review.

Voice prompts include every pathway warning and answer option in the selected available
translation. Long prompts are queued in chunks to preserve warnings across the TTS limit.
Actual microphone/speaker acceptance and native-speaker clinical review remain required.
A pinned German Piper Kerstin voice was installed and produced a valid WAV in the local
smoke test. Reproduce installation with `npm run setup:voice:de`; browser speech remains a fallback.

QR/phone-chat integration and physical button/controller wiring are deferred pending the
client's confirmation. No QR feature, deployment, or dispensing control is introduced here.

See [the implementation and verification record](docs/GERMANY_SAFETY_IMPLEMENTATION.md).
Older research documents below describe historical designs and are not release evidence.

---

## Complete Project Documentation Index (23 Core Specifications)

1. [README.md](file:///v:/LD%20Projects/PILLPALMEDVEN/README.md) — Master project overview and execution guide.
2. [PROJECT_ANALYSIS.md](file:///v:/LD%20Projects/PILLPALMEDVEN/PROJECT_ANALYSIS.md) — Baseline technical audit of architecture, runtimes, and stack.
3. [EXISTING_ARCHITECTURE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/EXISTING_ARCHITECTURE.md) — Detailed system topology, trust boundaries, and contracts.
4. [IMPLEMENTATION_ROADMAP.md](file:///v:/LD%20Projects/PILLPALMEDVEN/IMPLEMENTATION_ROADMAP.md) — Phased roadmap tailored to verified stack.
5. [OFFLINE_AI_ARCHITECTURE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/OFFLINE_AI_ARCHITECTURE.md) — Offline model execution, memory ceilings, and lifecycle.
6. [MODEL_SELECTION_REPORT.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MODEL_SELECTION_REPORT.md) — Model comparison matrix and hardware selection rationale.
7. [LAPTOP_COMPATIBILITY_REPORT.md](file:///v:/LD%20Projects/PILLPALMEDVEN/LAPTOP_COMPATIBILITY_REPORT.md) — Reference hardware profile (Intel i5-1240P, 8GB RAM).
8. [MOROCCO_REGULATORY_ARCHITECTURE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MOROCCO_REGULATORY_ARCHITECTURE.md) — Moroccan AMMPS & DMP governance and legal status rules.
9. [INTERNATIONAL_MEDICINE_CATALOGUE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/INTERNATIONAL_MEDICINE_CATALOGUE.md) — 5 logical data domains and jurisdictional isolation.
10. [DATABASE_SCHEMA.md](file:///v:/LD%20Projects/PILLPALMEDVEN/DATABASE_SCHEMA.md) — Normalized relational schema for active ingredients, products, and safety.
11. [MEDICINE_ALTERNATIVE_ENGINE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MEDICINE_ALTERNATIVE_ENGINE.md) — 4-level alternative classification and dialogue scripts.
12. [COMBINATION_MEDICINE_VALIDATION.md](file:///v:/LD%20Projects/PILLPALMEDVEN/COMBINATION_MEDICINE_VALIDATION.md) — Fixed-dose combination validation and multi-drug rules.
13. [MEDICAL_SAFETY_ENGINE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MEDICAL_SAFETY_ENGINE.md) — Deterministic clinical decision support and safety interlocks.
14. [VOICE_AGENT_ARCHITECTURE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/VOICE_AGENT_ARCHITECTURE.md) — Edge speech recognition, barge-in, and neural TTS pipeline.
15. [MULTILINGUAL_BENCHMARKS.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MULTILINGUAL_BENCHMARKS.md) — Latency and accuracy across 7 priority languages.
16. [N8N_INTEGRATION.md](file:///v:/LD%20Projects/PILLPALMEDVEN/N8N_INTEGRATION.md) — Cloud workflow orchestration and drift prevention.
17. [LOCAL_SETUP_GUIDE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/LOCAL_SETUP_GUIDE.md) — Developer and kiosk deployment quickstart.
18. [MODEL_INSTALLATION_GUIDE.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MODEL_INSTALLATION_GUIDE.md) — Edge AI model setup, checksums, and verification commands.
19. [OFFLINE_TEST_REPORT.md](file:///v:/LD%20Projects/PILLPALMEDVEN/OFFLINE_TEST_REPORT.md) — Empirical evidence of 100% offline kiosk execution.
20. [MEDICAL_SAFETY_TEST_REPORT.md](file:///v:/LD%20Projects/PILLPALMEDVEN/MEDICAL_SAFETY_TEST_REPORT.md) — 18-case pharmaceutical safety verification results.
21. [SECURITY_REPORT.md](file:///v:/LD%20Projects/PILLPALMEDVEN/SECURITY_REPORT.md) — Security audit, input sanitation, and physical kiosk hardening.
22. [IMPLEMENTATION_CHANGELOG.md](file:///v:/LD%20Projects/PILLPALMEDVEN/IMPLEMENTATION_CHANGELOG.md) — Complete milestone release log and code additions.
23. [KNOWN_LIMITATIONS.md](file:///v:/LD%20Projects/PILLPALMEDVEN/KNOWN_LIMITATIONS.md) — Transparent technical, clinical, and hardware boundaries.

---

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
8. `supabase/migrations/007_outcome_log.sql`
9. `supabase/migrations/008_demo_catalogue.sql` (`ZZ` demo rows)
10. `supabase/migrations/009_real_products_draft.sql` (disabled MA drafts)
11. `supabase/migrations/010_data_integrity_guard.sql` (fixture/placeholder guard)
12. `supabase/migrations/011_germany_safety_contract.sql` (explicit approval fields and Germany configuration; stage before deploying)

The seed products and pathways remain disabled. This is expected.

Migration 005 is optional. It adds one synthetic record in the reserved test
country `ZZ` so the product-result path can be exercised without enabling any
real medicine. Migration 010 disables that fixture automatically and blocks it
from ever being re-enabled. It is not a clinical or legal approval and
deliberately cannot appear in Morocco (`MA`) kiosk traffic. See section 6.

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

For the dedicated hands-free voice experience, open:

```text
http://localhost:8080/voice.html
```

The voice-only page uses the same questions, safety gates, approved catalogue
and non-dispensing result contract as the touchscreen page. It does not let the
language model diagnose, prescribe, skip questions or authorize dispensing.

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

### Automatic multilingual conversations

The language selector defaults to **Any language** and also offers common
languages spoken in Germany. The answer-understanding sidecar detects the
customer's spoken language, maps the answer into the controlled workflow value,
and returns an ISO language code. Later questions, explanations and the product
summary are translated and spoken in that language. A customer may also select
a language explicitly. The choice is stored in `localStorage` under
`pillpal-language`.

The product catalogue and deterministic rule contract stay in the configured
`catalogLanguageCode` (English by default). Product names, active ingredients,
strengths, doses, units and warning meaning must be preserved during
translation. In Gemini-free local mode, multilingual Whisper translates speech
to English before deterministic mapping. Assistant speech remains English
unless a local translation model and matching Piper voice are installed.
Microphone quality, dialect and model accuracy still affect recognition.

### Fully local voice mode

The kiosk can run without Gemini for its voice path. The local configuration
uses whisper.cpp with multilingual `ggml-base` for speech recognition and
optional English translation, the deterministic answer mapper and n8n safety
engine for screening, and Piper for local neural speech output.

Set `localWhisper: true` and `localWhisperTranslate: true` in `web/config.js`.
Configure `WHISPER_BIN`, `WHISPER_MODEL` and `WHISPER_TRANSLATE=1` in `.env`.
Set `GEMINI_LIVE_TRANSCRIBE=0` and `GEMINI_CLOUD_ENABLED=0` to prevent Gemini
transcription, translation and TTS calls.

Small local LLMs are not safety authorities. On the reference 8 GB CPU-only
laptop, Qwen3 1.7B failed multilingual intake checks and Qwen3 4B exceeded the
latency target, so `PILLPAL_AI_PROVIDER=off` is the safe local default. Product
eligibility remains deterministic.

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

### Gemini Live transcription (recommended for kiosk input)

The default browser recognition is retained as a fallback, but the kiosk can
use Gemini Live Transcription for live interim and final speech-to-text. It
includes the approved medicine vocabulary (for example Doliprane, Brufen,
Imodium and Zyrtec), while the deterministic mapper and safety workflow remain
the only paths that can interpret an answer or evaluate product safety.

Add these values to `.env`, then restart `npm start`:

```text
GEMINI_API_KEY=your_server_side_key
GEMINI_LIVE_TRANSCRIBE=1
```

Set `geminiLive: true` in `web/config.js` under `voice`. The kiosk server gives
the browser a one-use, five-minute Live token for each speech turn; it never
sends the long-lived API key to the browser. Microphone audio is sent directly
to Gemini for transcription, not to n8n. Give customers a clear privacy notice
and obtain the required consent before enabling it in a public deployment.

If the Live token or connection is unavailable, the app automatically falls
back to the browser recognizer. If neither produces speech, the microphone
stops after 15 seconds with a retry message instead of remaining on
“Listening”.

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

- eligible: expects `PRODUCT_ELIGIBLE` for an approved demo pain/fever product
  (`DOLIPRANE` or `BRUFEN`); the automated `TEST FIXTURE PRODUCT` is rejected
- blocked: answers the allergy question with `paracetamol` and `ibuprofen`,
  expecting `NO_SUITABLE_PRODUCT` with `all_products_blocked` / `allergy_conflict`

Both sessions must return `dispense_authorized: false`.

To preview the product screen on the kiosk itself, temporarily set
`countryCode: 'ZZ'` in `web/config.js`, complete the assessment, then restore
`MA`. Every `ZZ` row is demo data and is never returned for Morocco traffic.

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

- the request carries the current question id, title, answer type and the exact
  option list, so the helper always answers the question that is actually on
  screen instead of guessing from the transcript alone
- the deterministic local mapper is tried first; the helper is only asked when
  that mapper does not recognise the answer (or for free-text history entries)
- it only ever returns a value from the current screen's option list (or a number
  inside the screen's bounds), so it cannot invent a medicine or a symptom
- the kiosk's session state, `outcome` and `dispense_authorized` are never sent
  to it; the request is rebuilt field by field from the transcript and the screen
- low confidence, an unclear answer or a question back to the kiosk returns
  `matched: false` and the question is simply asked again
- a statement such as "It was started today" is treated as an answer, not as a
  question about the screen, even though it contains a question-shaped word
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

