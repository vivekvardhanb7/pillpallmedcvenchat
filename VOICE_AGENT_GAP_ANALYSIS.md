# VOICE_AGENT_GAP_ANALYSIS.md

**Date:** 2026-11-05
**Scope:** what the voice agent does today, what is measured, and what is missing
against the master brief's Phase 8.

---

## 1. Current voice pipeline

```
microphone
  -> capture (Web Audio, pre-roll buffer)
  -> speech recognition (one of):
       a) whisper.cpp ggml-base via POST /api/transcribe      [local, enabled]
       b) browser SpeechRecognition                          [vendor cloud, fallback]
       c) Gemini Live via one-use token                      [cloud, code present, disabled]
  -> deterministic answer mapper (EN/DE wording)             [local]
     -> optional understanding bridge or n8n sidecar         [disabled locally]
  -> confirmation read-back ("I understood X. Is that correct?")
  -> n8n deterministic engine                                [hosted]
  -> response text
  -> speech output (one of):
       a) Piper /api/tts                                     [local, English only]
       b) Gemini TTS                                         [cloud, disabled]
       c) browser speech synthesis                           [OS-dependent]
```

The voice surface (`web/voice.html`) reuses the touchscreen controller
(`web/app.js`). `web/voice-experience.js` adds presentation-only behaviour.

---

## 2. What works and is tested

| Capability | Status | Evidence |
|---|---|---|
| Local transcription | ✅ | whisper.cpp base; clean sentence ~2.5 s |
| Local TTS | ✅ | Piper English female; cached prompt ~0.03 s |
| Browser fallback for STT/TTS | ✅ | Implemented |
| Deterministic answer mapping | ✅ | EN/DE mapper tests |
| Optional model mapping | ✅ | 19/19 hosted sidecar checks (FR, Darija, MSA, Telugu, medicine variants) |
| Read-back confirmation | ✅ | Interpreted answers confirmed before use |
| Voice-only wording | 🟡 | Pharmacist-style prompts, but hard-coded English |
| Live captions | ✅ | Interim and final text |
| Idle/listening/thinking/speaking/error/ended states | ✅ | Premium interface contract test |
| Barge-in | 🟡 | Orb/microphone button stops playback; no acoustic barge-in |
| Silence / turn timeout | ✅ | Threshold and timeout; 15 s microphone stop |
| Pre-roll before connection | ✅ | Transport test |
| Token prefetch | ✅ | Removes ~0.77 s from next turn |
| Per-IP token ceiling | ✅ | 20 tokens/minute |
| Desktop visual render | ✅ | 1440×1000 inspected |
| Short viewport | ❌ | Clips at 525×482 |
| Physical microphone/speaker | ❌ | Not tested in this environment |

---

## 3. Gaps against Phase 8

### 3.1 Language coverage

| Language | UI dictionary | ASR | TTS voice | Understanding tests | Voice acceptance |
|---|---|---|---|---|---|
| English | ✅ | ✅ whisper/browser | ✅ Piper | ✅ | Partial (no hardware test) |
| German | ✅ | 🟡 whisper/browser, untested | ❌ no Piper model | ✅ mapper | ❌ |
| French | ❌ | 🟡 whisper, untested | ❌ | 🟡 sidecar tested | ❌ |
| Moroccan Darija | ❌ | ❌ not benchmarked | ❌ | 🟡 sidecar tested | ❌ |
| Modern Standard Arabic | ❌ | 🟡 whisper, untested | ❌ | 🟡 sidecar tested | ❌ |
| Hindi | ❌ | 🟡 whisper, untested | ❌ | ❌ | ❌ |
| Telugu | ❌ | 🟡 whisper, untested | ❌ | 🟡 sidecar tested | ❌ |

The 60-entry selector overstates capability. The brief's rule applies: do not
claim support until testing demonstrates acceptable performance.

### 3.2 Natural conversation

- Voice-only prompts are produced by a hard-coded English table
  (`naturalVoiceQuestion()` in `web/app.js`). German, French, Arabic and other
  customers hear English prompts even when the UI dictionary changes.
- `voice.html` static copy has no `data-i18n` attributes, so labels stay English.
- No language-specific prosody, pacing or pronunciation tuning.
- No handling of code-switching (e.g., Darija + French in one sentence).
- No speaker diarisation or multi-person detection.
- No "repeat that" / "slow down" voice command beyond the existing repeat path.

### 3.3 Interruption and acoustics

- Barge-in is implemented only as a deliberate tap on the orb/microphone.
- There is no acoustic echo cancellation, so always-on barge-in could trigger on
  the kiosk's own speaker.
- No noise-profile adaptation for a busy pharmacy; the activity threshold is a
  fixed value.
- No hardware test of speaker volume, microphone array, or enclosure acoustics.
- No measurement of interrupt-response latency.

### 3.4 Latency

Measured pieces exist (whisper ~2.5 s, Piper cache ~0.03 s, Gemini token
~0.77 s), but there is no end-to-end p50/p95 for a full assessment, no
interrupt latency, and no thermal/30-minute drift test.

### 3.5 Privacy and consent

- With whisper.cpp + Piper, audio and text stay on the machine (good).
- Gemini Live sends microphone audio directly to Google. The code requires
  consent/notice, but no consent screen or retention position is implemented.
- Gemini TTS/translate send text; disabled locally.
- The n8n sidecar stores transcripts in execution data unless retention is
  configured.
- Transcripts are cleared from the page on end/inactivity, but there is no
  spoken privacy notice in all supported languages.

### 3.6 Reliability

- Browser recognition depends on the vendor's cloud service; offline it fails.
- whisper.cpp is spawned per request; concurrency and temp-file behaviour are
  bounded but not load-tested.
- No automatic recovery from a mid-stream Gemini/n8n outage beyond the existing
  online/offline UI.
- No watchdog for a stuck microphone beyond the 15 s stop.

---

## 4. What must be added (priority order)

1. **Language truthfulness** — reduce the selector to tested languages, or mark
   untested ones as "text only / English voice". Wire `voice.html` and
   `naturalVoiceQuestion()` to i18n.
2. **Darija/MSA/French acceptance tests** — recorded clips, WER and intent
   accuracy, with human review.
3. **Piper voices** for French, Arabic and German, plus licence checks.
4. **Acoustic validation** on the kiosk hardware: echo, noise, barge-in, speaker
   volume.
5. **End-to-end latency and RAM benchmarks** for the full 11-turn flow.
6. **Consent/privacy flow** before any cloud audio is enabled.
7. **Interrupt latency** measurement and a safe acoustic barge-in design (only
   after AEC).
8. **Fail-closed behaviour** when STT confidence is low: ask again, never guess
   a safety answer.

---

## 5. Test plan

| Test | Method | Pass criterion |
|---|---|---|
| STT accuracy | 20 clips/language, quiet and noisy | intent accuracy ≥ 95% for safety answers |
| Medical terms | brand names, strengths, "mg" | correct or ask again; never map to a different medicine |
| Code-switching | Darija/French/English mixed | correct option or ask again |
| TTS intelligibility | human listening panel | brand names and numbers understood |
| Barge-in | speak while TTS plays | playback stops within 300 ms (button path) |
| Echo | speaker at kiosk volume | no self-trigger |
| Latency | 30 full assessments | p95 end-to-end < 90 s |
| Offline | network disabled | full assessment completes |
| Privacy | cloud disabled | no audio/text leaves the machine |

---

## 6. Conclusion

The voice stack is a credible local prototype with an honest fallback chain. It
is not yet a multilingual natural voice agent: only English has a complete local
voice loop, the voice-only prompts ignore the selected language, and no
Darija/Arabic/French acoustic test exists. These are Phase 8 deliverables, not
small fixes.
