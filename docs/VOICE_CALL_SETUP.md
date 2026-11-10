# Local voice-call setup and acceptance record

Updated: 9 November 2026. Status: automated development checks pass; physical audio acceptance deferred by the user. Not a production/clinical certification.

## Start and check

From the project directory:

```powershell
npm start
```

Open http://localhost:8091/ on this laptop. The saved local `.env` selects port 8091, disables cloud processing and the unbenchmarked language-model sidecar, and disables transcription translation. Credentials are retained without being used by this local voice setup.

In a second terminal:

```powershell
npm run doctor:voice
npm test
npm run test:voice:audio
node scripts/test-local-speech-roundtrip.mjs --interrupt
```

The doctor checks installed/local services and configuration. It does not access the microphone. The audio tests use generated fictional speech, not patient data. `--interrupt` injects that generated PCM at the microphone boundary, mocks assistant playback, and uses the real local Whisper service to transcribe the captured interruption. Results are written to `tmp/voice-roundtrip-results.json`.

## Conversation behavior

- Start once and grant microphone access yourself if prompted. German and English use local Whisper and Piper.
- While speaking, the assistant monitors microphone audio. Sustained audio above the configured gate stops the current playback and queued speech. A short pre-roll preserves the beginning of the interruption.
- Browser echo cancellation, noise suppression and automatic gain control are requested. A brief click or low-level noise does not pass the sustained-activity gate in automated tests.
- This gate is acoustic activity detection, not a validated neural speech/speaker detector. Loud background sounds or residual speaker echo can still trigger it. Browser/device echo cancellation must be checked with the actual machine hardware.
- Monitoring buffers remain bounded. An ordinary answer ends after the configured 1.8-second pause; continuous recordings are bounded at 45 seconds. Local transcription starts after the answer ends, so this is not streaming word-by-word understanding.
- When an uninterrupted prompt ends, monitor audio is discarded and listening continues without another tap.
- Age, duration and severity supplied together receive one explicit combined readback. Confirmed facts are carried forward; medical safety questions still apply.
- An interrupted warning list is replayed before accepting a negative answer. A positive warning can still proceed to the safety engine immediately after transcription. Interrupted confirmation prompts are replayed before accepting agreement.
- Session end cancels pending transcription, stops capture and prevents stale results from entering another session.

## Evidence completed

- Full `npm test` suite, including 22 EN/DE conversation scenarios and additional acoustic interruption/safety regressions.
- Simulated microphone PCM: isolated-click/quiet-noise rejection, sustained activity, retained onset, playback cancellation and listening after prompt completion.
- Real Piper/Whisper generated-speech interruption tests in English and German preserved headache, age 30, duration today and mild severity. These are two smoke-test utterances, not an accuracy benchmark.
- Development configuration and local service checks. No deployment or clinical catalogue approval performed.

## Required physical acceptance before rollout

Use fictional details, at comfortable speaker volume. Run both languages separately:

1. Start and remain silent through the opening prompt. The assistant must not interrupt itself or transcribe its own voice.
2. Restart and speak over the opening: English, “I have a mild headache since this morning. I am thirty years old.” German, “Ich habe seit heute Morgen leichte Kopfschmerzen. Ich bin dreißig Jahre alt.”
3. Confirm playback stops, the first words are preserved, and the combined readback contains all details.
4. Confirm naturally (“Yes, that is correct” / “Ja, das stimmt”). Check that known details are not asked again.
5. Interrupt the warning list with a negative answer. It must replay the warnings before accepting an all-clear.
6. Test quiet speech, ordinary pauses, accents, ambient machine noise and intended speaker volume. Record errors and measured interruption/response latency; do not assume simulated timings transfer to hardware.
7. End during speech and during transcription. Check the microphone indicator clears and no stale result appears. Start a new session and confirm old details are absent.

Release remains blocked on physical acceptance, German clinical content/independent clinical validation, applicable deployment review and real machine-button integration. QR/phone-chat remains deferred. No autonomous dispensing is authorized.
