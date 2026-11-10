# PILLPAL MedAssist Voice Interface Implementation

## Status

Initial architecture review completed before implementation on 4 November 2026.
This document is updated again after implementation and testing.

## Existing architecture

PILLPAL is a dependency-light Node.js and browser JavaScript application. It is
not currently React, Vue, Python or FastAPI based. `web/server.mjs` serves the
static kiosk and keeps API credentials on the server. `web/app.js` owns the
conversation controller and renders the assessment returned by n8n.

The main browser-to-backend contract is:

1. The browser posts the current controlled answer and signed workflow state to
   the configured n8n `pillpal-chat-turn` webhook.
2. The Supabase Safety Chat workflow runs the deterministic intake and safety
   engine, loads only enabled/verified products through its Supabase credential,
   evaluates product eligibility, and returns the next screen or outcome.
3. The browser renders and speaks that response. Every outcome continues to set
   `dispense_authorized: false`.

Supabase is not called directly by the browser. The service-role key remains in
n8n/server configuration. The schema includes the medicine catalogue, clinical
review fields and anonymised outcome log.

## Existing voice integration

`web/voice-assistant.js` is the voice state/service layer. It already provides:

- microphone lifecycle and permission errors;
- Gemini Live transcription with a short-lived server-issued token;
- browser speech-recognition fallback;
- silence/turn timeout and duplicate-session prevention;
- Gemini TTS through the local server, with browser synthesis fallback;
- queued speech, cancellation and resource cleanup;
- final/interim transcript callbacks and idle/listening/thinking/speaking states.

`web/gemini-live-transcriber.js` sends microphone PCM directly to Gemini Live
using a constrained ephemeral token. It returns transcription only and cannot
make a medicine decision. `web/answer-understanding.js` and the separate n8n
Spoken Answer Understanding workflow map natural-language answers into the
controlled values for the current question. They do not diagnose or approve a
product. Customer-facing translations use the local `/api/translate` bridge.

No Vapi integration or Vapi dependency exists in the repository. Adding Vapi
would duplicate working transcription/TTS infrastructure, so it will not be
introduced.

## Reusable components

- Existing `VoiceAssistant` and `GeminiLiveTranscriber` service classes.
- Existing audio analyser and canvas visualizer.
- Existing multilingual language catalogue and automatic detection.
- Existing chronological transcript and answer-confirmation flow.
- Existing n8n safety and Gemini answer-understanding integrations.
- Existing product summary and post-result voice question handling.
- Existing theme tokens, logo and accessible control conventions.

## Required changes

- Redesign `voice.html` as an original full-screen premium voice surface.
- Add a larger audio-reactive orb, polished state transitions and distinct
  idle/listening/thinking/speaking/error/ended presentation.
- Keep controls minimal while providing microphone, speaker, end-call, text
  fallback, language and connection status.
- Make transcript and text input optional drawers rather than a permanent chat
  layout.
- Add user barge-in: pressing the central/microphone control while speech is
  playing stops output and begins listening.
- Surface browser online/offline state and a retryable error state.
- End the conversation with an on-screen privacy-safe summary and restart action.
- Preserve all existing element IDs required by `web/app.js` so the working
  integration is reused rather than replaced.

## Proposed UI structure

The voice route contains a compact top bar, connection/language controls, a
center voice stage, a dock of call controls, an expandable transcript drawer and
an expandable text-composer drawer. The assessment DOM remains available for
the controller but is visually secondary. The orb and waveform are driven by
the actual microphone analyser and voice state, not a simulated response timer.

Responsive rules collapse controls safely for tablet and mobile, respect safe
areas and `prefers-reduced-motion`, and keep the end-call action distinct from
mute/speaker controls.

## API integration plan

- Keep `POST pillpal-chat-turn` as the only safety/product decision route.
- Keep `POST pillpal-understand` for constrained answer interpretation.
- Keep `POST /api/gemini-live-token` for ephemeral transcription access.
- Keep `POST /api/gemini-tts` and browser speech synthesis for output.
- Keep `POST /api/translate` for customer-facing language adaptation.
- Do not add a workflow, database table, API key, or general chat endpoint.

## Risks and dependencies

- Microphone access requires a secure context outside localhost and explicit
  customer permission.
- Gemini Live/TTS and translation depend on network availability and configured
  server-side credentials; browser recognition/synthesis quality varies by OS.
- Automatic language recognition and accents are probabilistic. Safety-critical
  interpreted values continue to be read back when confirmation is required.
- Barge-in is user initiated because always-on echo cancellation across kiosk
  hardware cannot be guaranteed safely.
- Transcripts may contain health information and must remain session-local and
  be cleared on end/inactivity. They are not added to outcome logging.
- Product eligibility is not dispensing authorization and still requires the
  project’s clinical/regulatory validation.

## Implementation steps

1. Preserve current integration IDs and restructure only the voice page markup.
2. Add isolated `voice-experience.js` UI behavior for drawers, connectivity,
   speaker control, end state and central barge-in.
3. Add `voice-premium` styles and responsive/reduced-motion behavior.
4. Extend existing state callbacks only where the UI needs explicit error/ended
   information; do not move safety logic into the UI.
5. Run syntax, unit, multilingual sidecar, deterministic journey and live route
   checks. Record exact results and remaining hardware-only checks below.

## Completed work, test results and limitations

### Completed

- Added a Gemini-free local voice path: multilingual whisper.cpp `ggml-base`
  speech recognition/English translation, deterministic answer mapping and
  safety rules, and the bundled Piper female English voice.
- Added `/api/transcribe`, which accepts an in-memory WAV turn, runs the local
  whisper.cpp executable with size and timeout limits, returns transcript text
  only, and removes its temporary recording after processing.
- Disabled Gemini Live, Gemini TTS and Gemini translation in the local runtime
  configuration. The kiosk status endpoints report these services unavailable.
- Evaluated Qwen3 locally before enabling it. `qwen3:1.7b` failed 11
  multilingual safety-answer checks; `qwen3:4b` exceeded the latency budget and
  also returned malformed or incorrect mappings. Local LLM understanding is
  therefore disabled by default rather than trusted for medical intake.
- The working local baseline translates customer speech to English with
  Whisper and applies the tested deterministic mapper. Ollama remains optional
  for development experiments and never controls dispensing.
- Improved quiet-microphone capture by lowering the local activity threshold,
  adding limited peak normalization, extending the natural-pause window from
  1.1 to 1.8 seconds, and always using automatic language detection when local
  translation is enabled.
- Benchmarked multilingual Whisper Small but did not enable it: the clean test
  sentence took about 11.3 seconds on the reference laptop versus about 2.5
  seconds with Whisper Base. Base remains the latency-appropriate default.

- Rebuilt `voice.html` as a full-screen dark voice experience with an original
  PILLPAL orb, real analyser waveform and responsive control dock.
- Added visibly distinct idle, listening, thinking, speaking, error and ended
  states driven by the existing `VoiceAssistant` state callbacks.
- Added optional transcript and text-input drawers, automatic language mode,
  connection status, speaker control, end-session action and privacy summary.
- Added user-initiated barge-in: the orb or microphone control stops current
  output through the existing controller and opens a new listening turn.
- Added always-visible live captions for interim customer speech and every
  assistant response.
- Replaced touchscreen-oriented voice wording with concise pharmacist-style
  questions that clearly state the expected answer (for example duration,
  severity, yes/no/not-sure and medicine names). Voice mode no longer tells the
  customer to type, chat, touch or use displayed choices.
- Added clearly differentiated orb behavior: calm idle breathing, expanding
  input rings while listening, rotating/floating processing motion, organic
  light and shape movement while speaking, and a separate error appearance.
- Reduced the automatic end-of-turn pause from 2.2 seconds to 1.1 seconds and
  reduced the Gemini final-transcript fallback from 6.5 seconds to 2.5 seconds.
- Added safe prefetching for the next one-use Gemini Live token while n8n/TTS is
  working. A live token request measured about 0.77 seconds, which is now removed
  from the normal next-turn microphone startup path.
- Added microphone pre-roll buffering before the Gemini WebSocket handshake is
  complete. Customers who start speaking immediately after MedAssist finishes
  no longer lose their opening words while the connection is being established.
- Reduced the post-TTS echo-tail delay from 320 ms to 60 ms. A transport test now
  simulates a delayed WebSocket and verifies that pre-connection audio is sent.
- Added out-of-order safety-context memory for explicit statements such as no
  medicine allergies, no current medicines and no ongoing conditions. If these
  facts do not answer the current question, MedAssist now acknowledges them and
  asks only for the missing answer instead of saying it failed to understand.
  Tests include common transcription errors plus English, German and French
  variants. Volunteered information is never substituted for an unrelated
  answer and is offered for confirmation at the appropriate safety step.
- Added an adaptive short interview for abdominal and period-related pain. The
  opening prompt requests age, duration and severity together; explicit values
  supplied in that reply are carried through the corresponding screens rather
  than being requested again.
- Added separate period-pain and abdominal-pain warning-sign prompts based on
  NHS patient guidance. Period-related pain now receives one focused red-flag
  check and one combined pregnancy/medicine-history question instead of generic
  headache or fever wording. Final review still exposes every captured answer.
- Kept Gemini in the language-understanding role only. It may extract facts from
  a natural reply, but it cannot remove a required safety gate, select an
  unapproved product, diagnose a condition or authorize dispensing; those
  decisions remain in the deterministic n8n safety engine.
- Updated the TTS warm cache to use the new pharmacist-style voice prompts. A
  warmed fixed prompt was served locally in about 0.03 seconds.
- Raised the per-address one-use-token ceiling from 6 to 20 per minute because a
  legitimate safety interview can exceed six short turns; rate limiting remains
  enforced.
- Added `voice-experience.js` for presentation-only behavior. It contains no
  medical decision logic and does not call Supabase, Gemini or n8n directly.
- Preserved the existing Gemini Live token route, TTS route, answer-understanding
  sidecar, n8n safety webhook, Supabase catalogue and non-dispensing contract.
- Added a static interface contract test to prevent missing/duplicated controller
  elements and missing voice states during later UI changes.

### Verification performed

- `npm test`: passed, including deterministic engine, answer understanding,
  sidecar build, i18n, voice mapper/lifecycle, Gemini Live transport, premium
  interface contract and workflow-drift checks.
- `npm run test:journeys`: all 52 deterministic customer/safety journeys passed;
  the suite confirms that no outcome authorizes dispensing.
- `npm run test:ai:sidecar`: all 19 hosted multilingual checks passed, including
  French, Telugu, Darija, Arabic medical-history terms, medicine-name variants,
  emergency refusal, ambiguous-answer refusal and webhook authentication.
- Desktop headless visual render at 1440 × 1000 was inspected successfully.
- The live `/voice.html` and supporting static assets are served by the existing
  local Node server; no mock response service was introduced.

### Not fully testable in this environment

- A real microphone permission prompt, acoustic echo, speaker playback and
  physical barge-in require the kiosk/browser audio hardware and must be checked
  manually on the target device. Computer-control access to the user's open
  Chrome window was not approved, so no permission dialog was acted on.
- Mobile CSS rules are implemented, but final validation should include physical
  iOS/Android browsers because headless desktop Chromium does not reproduce all
  mobile safe-area, keyboard and microphone behavior.
- Network reconnection UI responds to browser online/offline events. Recovery
  from a real mid-stream Gemini/n8n outage still depends on those services and
  should be included in deployment acceptance testing.
- The 19 live sidecar tests passed, but one hosted request took about 8.8 seconds;
  provider/network latency remains external to the interface.
