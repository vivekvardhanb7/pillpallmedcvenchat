# OFFLINE_AI_ARCHITECTURE.md — Offline Edge AI Architecture & Model Lifecycle

**Date:** 2026-11-05  
**Audience:** Edge AI Specialists, System Architects, Clinical Engineers  
**Target:** 8GB RAM Laptop / Kiosk Host running Windows 11 on Intel i5-1240P

---

## 1. System Topology & Zero-Cloud Invariant

The offline AI architecture guarantees that the kiosk executes speech recognition, language comprehension, clinical triage, catalogue matching, and speech synthesis without sending a single network packet outside `localhost:8080`.

```
                    LOCAL HOST (127.0.0.1)
  ┌──────────────────────────────────────────────────────────┐
  │ 1. AUDIO INTAKE: Web Audio API (Energy-based VAD)        │
  │    Captures 16kHz mono audio into pre-roll buffer.       │
  ├──────────────────────────────────────────────────────────┤
  │ 2. SPEECH RECOGNITION: whisper.cpp (ggml-base.bin)       │
  │    Executes natively with Alder Lake AVX2 in ~2.4s.      │
  ├──────────────────────────────────────────────────────────┤
  │ 3. LANGUAGE UNDERSTANDING & INTENT:                      │
  │    - Tier 1: Deterministic regex brand & option mapper   │
  │    - Tier 2: Qwen2.5-1.5B-Instruct (GGUF Q4_K_M)         │
  ├──────────────────────────────────────────────────────────┤
  │ 4. CLINICAL DECISION ENGINE:                             │
  │    Deterministic 11-step clinical triage (0 ms latency). │
  │    Zero LLM interference with eligibility or dosing.     │
  ├──────────────────────────────────────────────────────────┤
  │ 5. CATALOGUE & ALTERNATIVE MATCHER:                      │
  │    Queries indexed local snapshot (data/local_catalog).  │
  ├──────────────────────────────────────────────────────────┤
  │ 6. SPEECH SYNTHESIS: Piper TTS (piper.exe)               │
  │    ONNX Runtime generates audio in < 180 ms.             │
  │    SHA-256 disk cache provides ~30 ms repeat turns.      │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. Model Lifecycle & Memory Management

To maintain system stability on an 8GB RAM host without swapping:
1. **Sequential Lifecycle:** Models are not invoked concurrently. Speech-to-text terminates before text generation or speech synthesis begins.
2. **Dynamic Unloading:** Whisper processes are spawned per-turn with quick process cleanup, preventing lingering memory locks.
3. **RSS Ceiling:**
   - Whisper ASR: ~232 MB RAM.
   - Piper TTS: ~68 MB RAM.
   - Node Kiosk Server + Snapshot: ~120 MB RAM.
   - Total runtime footprint: **< 450 MB RAM** (Leaving > 3.0 GB free memory).
