# OFFLINE_AI_RESEARCH.md

**Date:** 2026-11-05
**Scope:** what can actually run on the reference laptop, and what that means for
the offline-first requirement.

---

## 1. Reference hardware (measured, not assumed)

| Item | Value |
|---|---|
| Machine | HP Pavilion Laptop 15-eg2xxx |
| CPU | 12th Gen Intel Core i5-1240P, 12 cores / 16 threads |
| RAM | 7.7 GB usable |
| GPU | Intel Iris Xe Graphics (integrated, shared memory reported as ~3.9 GB) |
| Dedicated VRAM | None / not applicable |
| Disk | `C:` 34.6 GB free of 377.4 GB; `V:` 41.5 GB free of 97.7 GB |
| OS | Windows 10.0.26200 |
| Runtime present | Node 24.13.1, npm 10.8.2, Python 3.14.6 |
| Docker | **Not installed** |

**Practical budget:** after Windows, Chrome/Edge and the Node server, assume
about **5 GB RAM** is available for models. A model plus its KV cache must fit
there without swapping. CPU-only inference is the only option; Iris Xe is not a
supported acceleration path for these runtimes.

---

## 2. Measured results from this project

These are actual measurements recorded during earlier implementation work, on
this machine.

| Test | Result | Decision |
|---|---|---|
| Qwen3 1.7B as answer-understanding model | Failed 11 multilingual safety-answer checks | Rejected for intake |
| Qwen3 4B as answer-understanding model | Exceeded latency budget; returned malformed or incorrect mappings | Rejected |
| whisper.cpp `ggml-base`, clean English sentence | ~2.5 s | **Enabled** |
| whisper.cpp `ggml-small`, same sentence | ~11.3 s | Disabled (latency) |
| Piper cached fixed prompt | ~0.03 s | **Enabled** |
| Gemini Live one-use token | ~0.77 s | Code present, disabled |
| Hosted answer understanding | ~0.9–1.5 s typical; one request ~8.8 s | Optional, disabled locally |

No measurement exists yet for: MedGemma, BioMistral, Meditron, OpenBioLLM,
Qwen3-ASR, SeamlessM4T, Kokoro, full 11-turn assessment latency, or RAM high-water
mark.

---

## 3. Candidate models and fit

Sizes below are approximate quantised footprints; **estimates are marked**.

| Model | Type | Approx. size (Q4) | Fits 5 GB budget? | Status |
|---|---|---|---|---|
| Qwen3 1.7B | General LLM | ~1.1 GB | Yes | Installed/evaluated; rejected for safety-answer mapping |
| Qwen3 4B | General LLM | ~2.5 GB | Yes, tight | Evaluated; rejected on latency/quality |
| MedGemma 4B | Medical VLM | ~2.5–3 GB (est.) | Yes, tight | Not tested; licence and intended-use review needed |
| BioMistral 7B | Medical LLM | ~4 GB (est.) | Marginal | Not tested |
| Meditron 7B | Medical LLM | ~4 GB (est.) | Marginal | Not tested |
| OpenBioLLM 8B | Medical LLM | ~4.5 GB (est.) | No (with KV cache) | Not recommended for this laptop |
| whisper `ggml-base` | ASR | ~142 MB | Yes | **Enabled** |
| whisper `ggml-small` | ASR | ~466 MB | Yes | Too slow at ~11.3 s |
| Piper English voice | TTS | ~63 MB model + runtime | Yes | **Enabled** |
| Kokoro | TTS | ~330 MB (est.) | Yes | Phase 2 comparison |
| Qwen3-ASR | ASR | Unknown | Unknown | Phase 2 benchmark |
| SeamlessM4T | Speech translation | >2 GB (est.) | Unlikely | Research only |
| Whisper large-v3 | ASR | ~3 GB | No for real-time use | Not viable |

A medical fine-tune is not automatically safer. MedGemma, BioMistral, Meditron
and OpenBioLLM are research models; none is a validated authority for product
eligibility, dosing or dispensing. They may only be considered for language
understanding and explanation, with the same read-back and allow-list constraints
already applied to Gemini.

---

## 4. Recommended offline stack

### 4.1 For the safety and product path

- **No LLM.** Keep the deterministic engine and matcher. This is the existing
  invariant and must not be relaxed to satisfy "use a local model".
- Move the engine into the kiosk process (or a local service) so it runs without
  n8n.
- Ship a versioned local catalogue snapshot and evaluate it locally.
- Queue outcome rows locally and sync when online.

### 4.2 For speech

- **STT:** whisper.cpp `ggml-base`, multilingual, with optional English
  translation. Keep browser recognition as a fallback.
- **TTS:** Piper. Add French, Arabic (MSA), German and Hindi voices only after
  listening tests and licence checks.
- Run ASR and TTS sequentially; do not hold a large LLM in memory at the same
  time.

### 4.3 For optional language understanding

- Default **off**.
- If enabled offline, the only realistic candidates are MedGemma 4B or a
  quantised Qwen3 4B, and both must pass the existing 11-check multilingual
  safety-answer suite plus a latency budget (target < 3 s per answer, < 4.5 GB
  RSS).
- The model must still be unable to invent an option, skip a question, or reach
  the matcher.

### 4.4 For retrieval (only if a RAG corpus is added)

- FAISS or ChromaDB are small enough, but the corpus is the hard part, not the
  index. Do not add a vector store before a licensed, versioned corpus exists.

---

## 5. Memory and lifecycle rules

1. Load whisper only while transcribing; unload or keep idle.
2. Load Piper on boot; it is small and fast.
3. Never load two LLMs at once.
4. Cap LLM context to the current question, not the whole transcript.
5. Measure RSS after each stage; the kiosk browser alone can use 500 MB–1 GB.
6. Add a watchdog that unloads a model after N minutes idle.
7. Do not download any model larger than 4 GB without checking free disk
   (currently 34.6 GB on `C:`, 41.5 GB on `V:`).

---

## 6. Benchmark plan for Phase 2

| Test | Metric | Pass criterion |
|---|---|---|
| 11 multilingual safety-answer cases | correct mapping / total | 11/11, no invented option |
| 30 realistic utterances per language | latency p50/p95 | p95 < 3 s |
| Full 11-turn voice assessment | end-to-end p50/p95, peak RSS | p95 < 90 s, RSS < 5 GB |
| Whisper base vs small | WER on 20 clips, medical terms | base acceptable, small only if latency allows |
| Piper voices | intelligibility, pronunciation of brand names | human listening pass |
| Offline pull-the-plug test | task completion | full assessment with network disabled |
| Thermal test | latency drift over 30 minutes | < 20% degradation |

Languages to test, in priority order: French, Moroccan Darija, Modern Standard
Arabic, English, Hindi, German, Telugu. Darija must be tested as its own case;
Arabic recognition does not imply Darija support.

---

## 7. Conclusion

The laptop can run the current voice loop comfortably, but it cannot host a
medical LLM that is both fast and trustworthy. The correct offline strategy is
therefore **deterministic logic + small ASR/TTS models + a local catalogue**, not
"put a local LLM in the decision path". The brief's acceptance criterion ("a
local LLM works on the target laptop") should be interpreted as "a local model
can assist with language", not as "a local model may decide medicine safety".
