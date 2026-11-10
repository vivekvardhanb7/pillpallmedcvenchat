# Germany-first safety milestone

Date: 9 November 2026. Scope: local implementation and verification; no hosted deployment.

## User experience

- The vending-machine root opens `voice.html`; the full touch/text fallback remains at `/index.html`.
- German is the initial language. German and English share dictionary keys; Hindi is an explicitly
  labelled partial preview. Other languages display an English-fallback notice.
- Country is set on the server, independently of the speaker's language or nationality.
- Voice uses the same localized assessment questions, full red-flag list and options as touch.
  Long speech is queued in chunks below the local TTS endpoint limit; oversized direct TTS requests are rejected rather than truncated.
- QR/phone-chat and actual physical-button wiring are deferred pending client confirmation.

## Safety changes

- `web/safety-policy.js` is the shared approval/ingredient policy, embedded by
  `n8n/load-engine-source.mjs` in the generated workflow and the local adapter.
- Product matching requires explicit clinical, legal, safety and pathway approval, enabled and
  commercialised status, reviewed provenance, reviewer/source/leaflet evidence, approved indications,
  safety limits, and nonempty approved dose text. Missing information fails closed.
- Ingredient aliases are used for both allergies and duplicate-medication checks. The small
  alias list is not a comprehensive interaction database.
- Static alternatives require pharmacist review. The ingredient-screening API cannot report
  overall eligibility; a complete assessment is required.
- Local clinical state lives in bounded, expiring server sessions. Client-supplied state and
  country cannot skip the interview. Revisions reject stale/replayed answers; busy sessions
  reject overlapping turns. A server restart starts a new interview.
- The local service binds to loopback by default and rejects cross-origin API requests.
- Offline catalogue checksum verification is separate from authenticity. Trusted clinical
  releases require a configured Ed25519 public key, a valid signature and validity dates.
  Unsigned reference data remains searchable with explicit reference-only metadata; it cannot
  approve a medicine. Reference search no longer returns dose instructions.
- Approval metadata is preserved, never invented by the local adapter. Raw alternative maps
  are not attached to product decisions.
- Local outcome events use a versioned envelope and the same banded payload builder as n8n;
  missing age/duration/severity is no longer fabricated. Existing older queue records are untouched.
- Approved assessment speech is not silently rewritten by a dynamic translation service.
- Inferred/volunteered answers require read-back confirmation; model confidence does not authorize silently skipping the question.

## Configuration and database

`PILLPAL_COUNTRY_CODE=DE` and `PILLPAL_HOST=127.0.0.1` are server defaults.
The browser uses same-origin assessment/understanding routes and does not need a webhook secret.
The local git-ignored browser config was adjusted to DE/German/local assessment and its browser
webhook secret cleared; the local `.env` country was updated while preserving other settings.

Optional `PILLPAL_CATALOG_FILE` selects a release file. `PILLPAL_CATALOG_PUBLIC_KEY_FILE`
selects an operator-managed trusted public PEM key. Release signing/publishing operations are
not supplied with a production key, and no clinical approvals were created.
The release is cached until server restart, but its expiry is checked before each recommendation.

Migration `011_germany_safety_contract.sql` adds Germany configuration and exposes existing
approval fields to the matcher. It does not enable any medicine or clinical pathway. It rebuilds
one dependent view inside a transaction to accommodate the added columns.
No PostgreSQL runtime was available for executing this migration locally; staging validation
is required before deployment. Hosted n8n and Supabase were not modified.

## Verification

Run:

```powershell
npm test
npm run test:journeys
npm run check
```

The regression suite covers missing/rejected approvals, unknown origin, country isolation,
DE/EN/HI eligibility parity, allergy aliases, duplicate ingredients, incomplete intake,
signed/unsigned/expired/tampered releases and a signed-release positive integration through
the real local engine. HTTP tests exercise Germany enforcement, forged state, stale turns,
invalid medication arrays, cross-origin requests and the default voice landing page.
Speech tests preserve every red flag and option, then verify complete ordered playback
through the voice queue across multiple TTS chunks. These use mocked playback, not real audio.
The existing 52 customer journeys remain regression coverage, not clinical validation.

Manual browser checks cover German assessment, Hindi-preview switching without resetting
patient context, rendered German warning bullets, a complete no-product German assessment,
the voice landing-page language/captions, and explicit read-back confirmation of an inferred
age through the voice page's text fallback. Both microphone and text controls remain usable
while read-back confirmation is pending.
Actual microphone recognition, acoustic quality, physical wiring, clinical correctness and
translation approval require separate acceptance work.

## German voice installation and smoke test

`npm run setup:voice:de` installs `de_DE-kerstin-low` from official Piper voice repository
revision `e7229f7d33a10e145e109b886d661984201ac3c4`. Model SHA-256 is
`d352a7641892cebf2903859af94e9ba81a141110215fe3943bcda7f7da401b7a`; the JSON and
model card are verified against pinned Git blob hashes. The model card lists the dataset
license as CC0. Assets remain in the git-ignored `tools/piper/voices` directory.

The actual local `/api/tts` returned HTTP 200, `audio/wav`, RIFF bytes and a 156,716-byte
German speech sample (`tmp/german-voice-smoke.wav`). This verifies synthesis, not microphone
accuracy, speaker audibility or clinical intelligibility. No microphone permission was accepted
during browser checks; voice-mode navigation was exercised with the text fallback.

## Next steps

1. Validate migration 011 in a disposable/staging PostgreSQL database.
2. Obtain and review a narrowly scoped German catalogue and pathway; publish a dated, signed release.
3. Benchmark the installed German voice with the actual microphone/speaker and native speakers.
4. Independently review Hindi wording and collect multilingual speech cases before enabling it as a release language.
5. Implement durable outcome synchronization with deduplication; status/queueing alone is not synchronization.
6. Confirm the physical start-button interface and the client's QR requirement before implementing them.

No real medicine recommendation, autonomous dispensing, clinical certification, or worldwide
language accuracy is claimed by this milestone.


## Natural voice conversation update

Every remaining assessment question now uses conversational English/German wording rather
than reading UI options or form-entry instructions. Warning questions retain the entire
localized red-flag list and explicitly invite uncertainty. The final prompt reads back the
actual summary (including history entries) before asking whether it was understood correctly.
Hindi remains a preview with English fallback for these additional spoken prompts.

`npm run test:conversation` runs 22 transcript-to-engine conversation scenarios in English
and German, covering the short interview, the full history interview, unclear answers,
correction/restart, positive/uncertain warnings, unknown history names, severe symptoms and
under-18 referral. It also checks every question's spoken prompt for UI menu leakage and
preserves complete warning text across speech chunks. This is software flow coverage,
not a real-microphone accuracy or clinical-validation claim.

Additional fixes: German plural history terms are recognized; mixed history statements
are routed through individual follow-up questions instead of being treated as all-clear;
uncertain final confirmation cannot match the affirmative word “sure”; unknown history
names cause referral; positive/uncertain warning answers escalate without a read-back delay.
Restarting from a rejected final summary clears volunteered client facts.


Browser verification for the natural-voice update: completed the short English interview,
including an uncertain final confirmation that did not advance, and the full German history
interview with explicit read-back confirmation of allergy, medicine and condition names.
Both ended with the expected no-approved-German-product response. Browser testing used
synthetic typed transcripts in the voice page's fallback while muted; actual microphone
recognition and speaker audibility were not tested. The full automated suite, the new
22-scenario conversation suite and all 52 existing customer journeys passed.
