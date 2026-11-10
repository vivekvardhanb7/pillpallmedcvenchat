# LOCAL_MODEL_INSTALLATION.md — Edge Model Installation & Execution Guide

**Date:** 2026-11-05  
**Audience:** Systems Administrators, DevOps Engineers, Hardware Technicians  
**Target Platform:** Windows 10/11 x64 (Alder Lake / Intel AVX2)

---

## 1. Directory Structure of Installed Models

```
V:\LD Projects\PILLPALMEDVEN\
├── tools\
│   ├── piper\
│   │   ├── piper.exe                       (Native TTS executable)
│   │   ├── onnxruntime.dll                 (ONNX inference engine)
│   │   ├── espeak-ng.dll & espeak-ng-data\ (Phoneme dictionary)
│   │   ├── libtashkeel_model.ort           (Arabic Tashkeel diacritizer)
│   │   └── voices\
│   │       ├── en_US-hfc_female-medium.onnx & .json (Installed)
│   │       ├── fr_FR-siwis-medium.onnx & .json      (French voice)
│   │       └── ar_JO-kareem-medium.onnx & .json     (Arabic voice)
│   └── whisper\
│       ├── Release\
│       │   ├── whisper-cli.exe             (Native ASR executable)
│       │   ├── ggml-cpu-alderlake.dll      (Intel 12th-Gen SIMD acceleration)
│       │   └── SDL2.dll
│       └── models\
│           └── ggml-base.bin               (148 MB Multilingual Whisper checkpoint)
```

---

## 2. Speech-to-Text (Whisper.cpp) Setup

The native executable and base model are already bundled in the repository:
- Binary: `tools\whisper\Release\whisper-cli.exe`
- Model: `tools\whisper\models\ggml-base.bin`

### Verification Command
Run this command from PowerShell to verify proper execution on the Alder Lake CPU:
```powershell
.\tools\whisper\Release\whisper-cli.exe --model .\tools\whisper\models\ggml-base.bin --help
```
*Expected output:* Confirms `load_backend: loaded CPU backend from ... ggml-cpu-alderlake.dll`.

### Transcribing an Audio Clip
```powershell
.\tools\whisper\Release\whisper-cli.exe -m .\tools\whisper\models\ggml-base.bin -f .\tmp\sample.wav -l auto -nt -otxt
```

---

## 3. Text-to-Speech (Piper) Setup

The native executable, ONNX runtime, and English voice are already bundled:
- Binary: `tools\piper\piper.exe`
- Voice: `tools\piper\voices\en_US-hfc_female-medium.onnx`

### Verification Command
```powershell
echo "PillPal MedAssist voice system initialized and ready." | .\tools\piper\piper.exe -m .\tools\piper\voices\en_US-hfc_female-medium.onnx -f .\tmp\test_voice.wav
```

### Adding Additional Multilingual Voices
Piper voices are hosted on the official Hugging Face repository (`rhasspy/piper-voices`):
1. **French (`fr_FR-siwis-medium`):**
   - Model: `https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx`
   - Config: `https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json`
2. **Arabic (`ar_JO-kareem-medium`):**
   - Model: `https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx`
   - Config: `https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx.json`

Download both `.onnx` and `.onnx.json` directly into `tools\piper\voices\`.

---

## 4. Conversational NLU Model (Qwen2.5 1.5B GGUF)

For local offline language mapping beyond deterministic regex, use `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf`:
- Footprint: **1.12 GB**.
- Source: `Qwen/Qwen2.5-1.5B-Instruct-GGUF`.
- Storage location: `tools\models\qwen2.5-1.5b-instruct-q4_k_m.gguf`.

Execution is handled via native Node.js spawn of llama-cli or through Ollama (`ollama run qwen2.5:1.5b`).
