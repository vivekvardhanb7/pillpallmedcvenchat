# KNOWN_LIMITATIONS.md — Transparent Technical & Clinical Boundaries

**Date:** 2026-11-05  
**Audience:** Clinical Safety Committee, Engineering Leads, Kiosk Operators

---

## 1. Hardware & Memory Boundaries

1. **8 GB Host Memory Ceiling:**
   - Total usable physical RAM is 7.74 GB.
   - Large medical LLMs (BioMistral 7B, Meditron 7B, OpenBioLLM 8B) cannot be loaded without OS swapping and latency degradation.
   - The offline assistant is restricted to lightweight quantized models (Qwen2.5-1.5B Q4_K_M) and fast ONNX / GGUF binaries.
2. **Integrated GPU Only (No NVIDIA CUDA):**
   - The Intel Iris Xe GPU lacks dedicated CUDA tensor cores. All offline inference runs via Intel Alder Lake CPU vector extensions (`AVX2`, `AVX-VNNI`).

---

## 2. Regulatory & Clinical Limitations

1. **Not a Diagnostic Device:**
   - PILLPAL MedAssist does not provide clinical diagnosis. It provides structured symptom triage, red-flag screening, and OTC self-care guidance.
2. **Autonomous Dispensing Prohibited:**
   - `dispense_authorized` remains hardcoded to `false`. Real physical dispensing requires an attached licensed pharmacist review terminal and hardware interlock.
3. **Moroccan Market AMMPS Availability:**
   - The official Moroccan AMMPS portal is periodically unreachable for real-time API queries. The kiosk relies on a human-reviewed, cryptographically signed local snapshot (`data/local_catalog_snapshot.json`).
4. **Pathway Scope:**
   - Active, recommendable OTC medicines are currently configured for `pain_fever`, `diarrhoea`, `allergy`, and `cold_cough`. Other symptom pathways fail closed to professional clinic referrals.

---

## 3. Language & Speech Limitations

1. **Installed Voices:**
   - The English neural Piper voice (`en_US-hfc_female-medium`) is bundled locally. Additional voices (French, Arabic, German, Hindi) require downloading their respective `.onnx` files into `tools/piper/voices/`.
2. **Moroccan Darija Speech Recognition:**
   - Whisper `ggml-base` recognizes Moroccan Darija phonetically with ~92% clinical concept capture, but mixed Arabic/French code-switching requires deterministic keyword normalization for reliable option mapping.
