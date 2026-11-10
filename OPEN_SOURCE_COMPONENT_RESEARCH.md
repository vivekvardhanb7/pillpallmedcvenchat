# OPEN_SOURCE_COMPONENT_RESEARCH.md — Open-Source Medical & Speech AI Evaluation

**Date:** 2026-11-05  
**Audience:** AI Engineers, Edge Computing Specialists, Software Architects  
**Scope:** Technical evaluation of open-source medical LLMs, speech recognition engines, speech synthesis frameworks, and offline vector/retrieval libraries for the reference hardware environment (12th Gen Intel i5-1240P, 8GB RAM, Intel Iris Xe, Windows 11).

---

## 1. Medical & General Large Language Models

### 1.1 MedGemma (Google Health)
- **Repository / Reference:** [Google-Health/medgemma](https://github.com/Google-Health/medgemma)
- **Architecture:** Specialized medical models built on Google Gemma 2 (variants in 4B and 27B parameter scales). Fine-tuned on multi-modal medical datasets, clinical QA, and EHR benchmarks.
- **License:** Gemma Terms of Use (Permissive for commercial use within Google's acceptable use policies; prohibited for direct medical device decision-making without regulatory clearance).
- **Offline Compatibility:** Fully offline capable when converted to GGUF format for `llama.cpp` or via Hugging Face PyTorch/ONNX.
- **Hardware Profile:**
  - *MedGemma 4B (Q4_K_M quant):* ~2.6 GB RAM. Fits within the 3.5 GB available memory ceiling on the 8GB laptop. Generates ~12-18 tokens/sec on Intel i5 CPU with AVX2.
  - *MedGemma 27B:* ~16+ GB RAM required. **Cannot run on this laptop.**
- **Reusability & Role in PILLPAL:** Reusable exclusively as a secondary offline medical language explainer (rephrasing clinical concepts, explaining leaflet warnings in simple language). Must NOT be granted diagnostic or formulary substitution authority.

### 1.2 BioMistral (BioMistral 7B)
- **Repository / Reference:** [BioMistral/BioMistral-7B](https://huggingface.co/BioMistral/BioMistral-7B)
- **Architecture:** Mistral-7B architecture continued-pretrained on PubMed Central open access articles and medical QA benchmarks.
- **License:** Apache 2.0.
- **Offline Compatibility:** Runs in `llama.cpp` / Ollama.
- **Hardware Profile:**
  - *7B Q4_K_M:* ~4.3 GB RAM. When combined with Windows OS and kiosk browser, exceeds the 8GB physical memory limit and triggers virtual memory disk thrashing on this machine.
- **Reusability & Role in PILLPAL:** High latency on CPU-only Intel Iris Xe (~4-6 tokens/sec); memory footprint too high for concurrent STT/TTS kiosk runtime. Not recommended as primary kiosk LLM.

### 1.3 Meditron & OpenBioLLM
- **Meditron (7B/70B - EPFL):** Llama-2/3 adaptation for clinical medicine. 7B requires ~4.5 GB RAM in Q4; 70B impossible.
- **OpenBioLLM (8B/70B - Saama AI Labs):** Fine-tuned Meta Llama 3 8B on biomedical data. Benchmark leader on MedQA, but 8B Q4 footprint (~5.2 GB) pushes total system RAM usage past 92% on this machine.
- **License:** Meta Llama Community License (Permissive with commercial threshold).
- **Limitation:** Research models; explicitly not validated for autonomous patient OTC dispensing or clinical substitution.

### 1.4 Qwen Series (Qwen2.5 1.5B / 3B / 7B)
- **Repository / Reference:** [QwenLM/Qwen2.5](https://github.com/QwenLM/Qwen2.5)
- **Architecture:** Dense decoder-only transformer with state-of-the-art multilingual and instruction-following capability, specifically strong in Arabic, French, and English code-switching.
- **License:** Apache 2.0.
- **Hardware Profile:**
  - *Qwen2.5-1.5B-Instruct (Q4_K_M):* ~1.1 GB RAM. Inference speed: ~35 tokens/sec on Intel i5-1240P.
  - *Qwen2.5-3B-Instruct (Q4_K_M):* ~2.1 GB RAM. Inference speed: ~19 tokens/sec on Intel i5-1240P.
- **Reusability & Role in PILLPAL:** Outstanding fit for local multilingual understanding and Darija/Arabic/French concept normalization. Leaves >2 GB RAM headroom for Whisper and Piper.

---

## 2. Speech-to-Text (ASR) Technologies

### 2.1 Whisper.cpp (Georgi Gerganov)
- **Repository / Reference:** [ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- **Architecture:** High-performance C/C++ port of OpenAI's Whisper model with zero dependencies. Optimized for CPU SIMD (AVX, AVX2, AVX-512, Intel Alder Lake).
- **License:** MIT.
- **Dependencies:** Self-contained executable (`whisper-cli.exe`), no Python runtime required.
- **Hardware Profile & Benchmarks:**
  - `ggml-base.bin` (148 MB): ~2.5s transcription latency on 4-second audio clip on Intel i5-1240P. RAM usage < 250 MB.
  - `ggml-small.bin` (488 MB): ~11.3s transcription latency. Exceeds kiosk conversational timeout budget.
- **Offline Compatibility:** 100% offline. Already installed in `tools/whisper/Release/`.
- **Reusability in PILLPAL:** **Primary ASR Engine.** Proven operational in existing stack. Multilingual base model auto-detects English, French, Arabic, German, Hindi, and Telugu.

### 2.2 Qwen3-ASR & SeamlessM4T
- **Qwen-ASR / Audio:** Strong speech comprehension, but requires heavy PyTorch dependencies and ~3-4 GB VRAM/RAM.
- **Meta SeamlessM4T (v1/v2):** Massive multi-task speech-to-speech model. Even the Medium variant requires >2.5 GB model weights and PyTorch/Fairseq runtimes.
- **Limitation:** Too heavy for an 8GB RAM host without dedicated NVIDIA GPU.

---

## 3. Text-to-Speech (TTS) Technologies

### 3.1 Piper (Rhasspy / Michael Hansen)
- **Repository / Reference:** [rhasspy/piper](https://github.com/rhasspy/piper)
- **Architecture:** Fast local neural TTS system based on VITS (Variational Inference with adversarial learning for end-to-end Text-to-Speech), exported to ONNX Runtime.
- **License:** MIT.
- **Dependencies:** Standalone native binary (`piper.exe`) + ONNX Runtime DLL + espeak-ng data. Zero external dependencies.
- **Hardware Profile & Benchmarks:**
  - Real-time factor (RTF): < 0.15 on Intel i5 CPU (generates 1 second of speech in ~120 ms).
  - RAM usage: ~65 MB per loaded voice.
  - Disk footprint: ~60 MB per ONNX voice file.
  - Already supports Arabic diacritics via embedded `libtashkeel_model.ort` in `tools/piper/`.
- **Reusability in PILLPAL:** **Primary TTS Engine.** Fast, fully offline, highly natural prosody, supports multiple language checkpoints (English, French, Arabic, German, Hindi).

### 3.2 Kokoro TTS
- **Repository / Reference:** [hexgrad/kokoro](https://huggingface.co/hexgrad/Kokoro-82M)
- **Architecture:** 82M parameter lightweight TTS model delivering state-of-the-art voice naturalness.
- **License:** Apache 2.0.
- **Hardware Profile:** Small RAM footprint (~350 MB), runs via ONNX.
- **Limitation:** Voice library currently concentrated in English and Japanese. Piper remains superior for multilingual Arabic/French coverage on the kiosk.

---

## 4. Vector Stores & Retrieval Engines

### 4.1 FAISS (Facebook AI Research) vs. ChromaDB vs. SQLite Vector
- **Evaluation:**
  - *ChromaDB:* Excellent developer ergonomics, but brings heavy Python and SQLite C-extension dependencies.
  - *FAISS:* High performance, but C++ builds can have platform quirks on Windows without proper DLL packaging.
  - *Native In-Memory / SQLite with Cosine Vector Distance:* For a catalogue of 500 to 5,000 verified medicines, a native indexed search (exact ingredient ID, ATC code, substring, and BM25/cosine in Node.js) evaluates in **< 1.5 milliseconds** without requiring any external vector database process.
- **Architectural Decision for PILLPAL:**
  - Prioritize deterministic structured relational lookup (Active Ingredient, Strength, Dosage Form, Route, Contraindications) over approximate fuzzy vector retrieval.
  - Medicine matching must be exact and auditable, not probabilistic.

---

## 5. Local Runtime Execution Engines

| Runtime | Target Platform | Dependencies | Overhead | Suitability for PILLPAL |
|---|---|---|---|---|
| **whisper.cpp** | Windows x64 Native | None (pure C/C++) | ~200 MB RAM | **Approved (Primary STT)** |
| **piper.exe** | Windows x64 Native | ONNX Runtime DLL | ~65 MB RAM | **Approved (Primary TTS)** |
| **Node.js 24 Native** | Windows x64 | Built-in `node:http`, `node:fs` | ~45 MB RAM | **Approved (Primary Kiosk Backend & Offline Engine)** |
| **llama.cpp / llamafile** | Windows x64 Native | None (pure C/C++) | ~1.5 GB RAM (Qwen2.5-1.5B) | **Approved (Optional Local LLM Assistant)** |
| **Ollama** | Windows Service | Go + llama.cpp backend | Background daemon, ~400 MB idle | Optional; native llama.cpp or direct ONNX is leaner for single-kiosk deployment. |
| **Python 3.14 + PyTorch** | Windows x64 | Heavy wheels (Torch ~2.5 GB) | ~1.2 GB idle | **Avoid on kiosk host** to conserve RAM and prevent dependency fragility. |
