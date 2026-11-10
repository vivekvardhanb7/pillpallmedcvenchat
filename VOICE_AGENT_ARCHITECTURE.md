# VOICE_AGENT_ARCHITECTURE.md — Natural Multilingual Edge Voice Pipeline

**Date:** 2026-11-05  
**Audience:** Voice AI Engineers, Speech Processing Specialists, UI/UX Designers  
**Scope:** Architecture and implementation of the human-like, low-latency, multilingual voice interface.

---

## 1. End-to-End Voice Processing Pipeline

```
  [User Speaks into Kiosk Microphone]
                 │
                 ▼
  [1. Web Audio VAD & Pre-roll Buffer] ──► Silence Detection & Energy Threshold
                 │ (WAV Audio Buffer)
                 ▼
  [2. Speech Recognition (Whisper.cpp)] ─► Whisper Alder Lake AVX2 (tools/whisper/)
                 │ Raw Transcript + Language Code
                 ▼
  [3. Multilingual Intent Normalizer] ───► Maps Darija/French/MSA concepts
                 │ Extracted Medical Concepts
                 ▼
  [4. Clinical Decision & Safety Engine]─► 11-Step Triage & Safety Validation
                 │ Decision Screen & Concise Spoken Copy
                 ▼
  [5. Speech Synthesis (Piper TTS)] ─────► High-speed Neural TTS (tools/piper/)
                 │ Audio WAV stream
                 ▼
  [User Hears Natural Spoken Response through Kiosk Speaker]
```

---

## 2. Interactive Dialogue & Human-Like Conversation Policies

1. **Acoustic Barge-In & Interruption:**
   - When the user begins speaking while the kiosk is playing audio, the Web Audio listener triggers an instant `audio.pause()` within **< 150 ms**, terminating current speech and switching immediately to the `listening` state.
2. **Short, Pharmacist-Style Spoken Responses:**
   - Kiosk speech is restricted to 15–30 words per turn. Complex details (leaflet warnings, full dose instructions) are rendered on the kiosk visual screen while the voice speaks only the essential takeaway.
3. **Natural Pauses & Tone:**
   - Sentence silences are dialed to 180ms to provide a conversational, empathetic rhythm without uncomfortable dead air.
4. **Code-Switching Support:**
   - In Morocco, patients routinely mix Moroccan Darija and French (*"3ndi mal de tête bzzaf"*). Whisper multilingual base extracts both vocabularies accurately.
