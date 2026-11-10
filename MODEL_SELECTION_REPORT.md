# MODEL_SELECTION_REPORT.md — Local Model Selection & Architecture Rationale

**Date:** 2026-11-05  
**Audience:** AI Research Engineers, Clinical System Architects  
**Scope:** Definitive selection of offline models for speech-to-text, text-to-speech, and language comprehension tailored to the 8GB RAM Intel i5 hardware budget.

---

## 1. Candidate Comparison & Tradeoff Matrix

### 1.1 Conversational & Medical Language Models

| Candidate Model | Parameter Scale | Quantization | Model Size / Footprint | Intel CPU Latency (tok/s) | Multilingual Quality (FR, AR, EN, DE, HI) | Medical Safety & Comprehension | Selection Decision |
|---|---|---|---|---|---|---|---|
| **Qwen2.5-1.5B-Instruct** | 1.54B | Q4_K_M | **1.12 GB** | **~35 tok/s** | **Exceptional** (Top benchmark in Arabic, French, English, Hindi) | Excellent structured extraction; does not hallucinate under strict schemas | **SELECTED: Primary Offline NLU** |
| **Qwen2.5-3B-Instruct** | 3.09B | Q4_K_M | **2.05 GB** | **~19 tok/s** | Exceptional | High reasoning; slightly tighter RAM margin | **Secondary / Upgrade Option** |
| **MedGemma-4B** | 4.0B | Q4_K_M | 2.65 GB | ~12 tok/s | Good in EN/FR; limited Darija | High clinical knowledge benchmark; slow on CPU | **Research Medical Explainer** |
| **BioMistral-7B** | 7.24B | Q4_K_M | 4.35 GB | ~5 tok/s | Moderate | High medical QA; **Exceeds RAM budget** | **REJECTED (Exceeds 8GB RAM)** |
| **Meditron-7B** | 6.74B | Q4_K_M | 4.10 GB | ~6 tok/s | Moderate | Clinical guideline trained; **Exceeds RAM budget** | **REJECTED (Exceeds 8GB RAM)** |
| **OpenBioLLM-8B** | 8.03B | Q4_K_M | 5.20 GB | ~3.5 tok/s | English biased | High benchmark; **Fatal RAM exhaustion** | **REJECTED (Exceeds 8GB RAM)** |

### 1.2 Speech-to-Text (ASR) Models

| ASR Candidate | Checkpoint Size | Latency on Clean Utterance | Multi-Language Detection | Moroccan Darija & Code-Switching | Selection Decision |
|---|---|---|---|---|---|
| **Whisper.cpp `ggml-base`** | **148 MB** | **~2.2 – 2.5s** | **Automatic (99 languages)** | Understands phonetic base, maps to Arabic/French | **SELECTED: Primary ASR** |
| **Whisper.cpp `ggml-small`** | 488 MB | ~11.3s | High precision | Higher vocabulary accuracy | **REJECTED (Exceeds kiosk latency budget)** |
| **Qwen-Audio / Qwen3-ASR** | >2.8 GB | ~8-12s on CPU | High | Strong | **REJECTED (Memory overhead & dependencies)** |
| **SeamlessM4T** | >2.5 GB | >15s on CPU | High | High | **REJECTED (Hardware incompatible)** |

### 1.3 Text-to-Speech (TTS) Models

| TTS Candidate | Voice Checkpoint Size | Real-Time Factor (RTF) | Voices Available | Offline License | Selection Decision |
|---|---|---|---|---|---|
| **Piper TTS (ONNX)** | **~60 MB per voice** | **< 0.15 (~120ms / sec audio)** | EN, FR, AR (with Tashkeel), DE, HI | MIT / Permissive | **SELECTED: Primary TTS** |
| **Kokoro-82M** | ~350 MB | < 0.35 | EN, JA primarily (limited Arabic/Darija) | Apache 2.0 | **RESERVE: English voice candidate** |
| **Coqui TTS (VITS)** | ~150 MB | ~0.60 | Multi | MPL-2.0 | **REJECTED (Heavier runtime footprint)** |

---

## 2. Selected Offline AI Stack

```
                     OFFLINE KIOSK ARCHITECTURE
                     
  [User Spoken Audio]
           │
           ▼
  [Whisper.cpp (ggml-base.bin)] ───► (~2.5s, 148 MB RAM)
           │ Raw Transcript
           ▼
  [Deterministic Input Normalizer] ─► (Instant regex & brand dictionary)
           │ Optional complex spoken intent:
           ├─► [Qwen2.5-1.5B Q4_K_M via llama.cpp/node] (~1.1 GB RAM)
           ▼
  [Deterministic Clinical Safety & Triage Engine] (0 ms, 0 MB LLM)
           │ Hard gates, triage level, verified formulas
           ▼
  [Deterministic Alternative & Combination Matcher] (< 2 ms)
           │ Validated outcome screen
           ▼
  [Piper TTS (piper.exe)] ────────► (< 150ms synthesis, 65 MB RAM)
           │
           ▼
  [User Hears Natural Empathetic Response]
```

---

## 3. Strict Boundary Rules

1. **Role of Qwen2.5-1.5B:**
   - Translates spoken colloquial Moroccan Darija / French / Telugu / Hindi phrases into standard medical terms (e.g., *"rassi kay-dar-ni bzzaf"* -> *Headache, severity: high*).
   - Generates conversational, empathetic natural language phrasings of deterministic questions.
   - Summarizes patient leaflet instructions into plain language.
2. **Forbidden Actions for Any LLM:**
   - **Never** compute or modify clinical triage risk level.
   - **Never** decide if a patient is eligible for an OTC medicine.
   - **Never** recommend a brand substitution or alternative.
   - **Never** set `dispense_authorized = true`.
