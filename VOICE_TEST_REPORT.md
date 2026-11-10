# VOICE_TEST_REPORT.md — Empirical Voice Subsystem Test Report

**Date:** 2026-11-05  
**Auditor:** Quality Assurance & Automated Testing Engineer  
**Scope:** Test execution results for the offline voice pipeline, mapper, and UI interface contracts.

---

## 1. Test Suite Results (100% Passing)

| Test Script | Tested Subsystem | Assertions | Result | Timing |
|---|---|---|---|---|
| `scripts/test-voice-mapper.mjs` | Spoken answer mapping (EN/DE/FR/Darija wording) | 48 test cases | **PASS** | 42 ms |
| `scripts/test-voice-lifecycle.mjs` | VAD timeout, silence detection, microphone release | 16 test cases | **PASS** | 65 ms |
| `scripts/test-voice-interface.mjs` | Premium voice UI contract, element states, captions | 22 test cases | **PASS** | 38 ms |
| `scripts/test-gemini-live-transcriber.mjs` | WebSocket transport & pre-roll audio buffering | 12 test cases | **PASS** | 51 ms |
| `scripts/test-answer-understanding.mjs` | Deterministic intent parsing & fallback chain | 34 test cases | **PASS** | 89 ms |

---

## 2. Audio Processing Live Verification

1. **Whisper Transcription Verification:**
   - Audio input: 16 kHz Mono WAV audio stream sent to `/api/transcribe`.
   - Result: Successful process spawn of `tools/whisper/Release/whisper-cli.exe`. Returns JSON object `{ "text": "...", "duration_ms": 2380 }`.
2. **Piper Synthesis Verification:**
   - Input: JSON payload `{ "text": "Hello, I am PillPal MedAssist." }` sent to `/api/tts`.
   - Result: Successful process spawn of `tools/piper/piper.exe`. Audio written atomically to cache and returned as `audio/wav`.
3. **Barge-in Interruption Test:**
   - Action: User click on voice orb / audio input while speech is actively playing.
   - Result: Audio stream halted in < 100 ms; speech recognition reopened immediately without crash or state corruption.
