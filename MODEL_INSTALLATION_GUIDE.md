# MODEL_INSTALLATION_GUIDE.md — Offline Edge AI Model Setup & Verification

**Date:** 2026-11-05  
**Audience:** Edge Hardware Engineers, System Administrators

---

## 1. Speech Recognition Model (Whisper.cpp)

- **Bundled Executable:** `tools\whisper\Release\whisper-cli.exe`
- **Installed Model:** `tools\whisper\models\ggml-base.bin` (148 MB)
- **Model Checksum:** Verified Multilingual Whisper Base checkpoint.
- **Verification Command:**
  ```powershell
  .\tools\whisper\Release\whisper-cli.exe --model .\tools\whisper\models\ggml-base.bin --help
  ```

---

## 2. Speech Synthesis Model (Piper ONNX)

- **Bundled Executable:** `tools\piper\piper.exe`
- **Installed Voice:** `tools\piper\voices\en_US-hfc_female-medium.onnx` (63 MB)
- **Arabic Diacritics Engine:** `tools\piper\libtashkeel_model.ort` (10 MB)
- **Verification Command:**
  ```powershell
  echo "PillPal MedAssist voice ready." | .\tools\piper\piper.exe -m .\tools\piper\voices\en_US-hfc_female-medium.onnx -f .\tmp\check.wav
  ```

---

## 3. Multilingual Voice Pack Installation (Optional)

To download additional multilingual Piper voices from Hugging Face:
- French (`fr_FR-siwis-medium.onnx`)
- Arabic (`ar_JO-kareem-medium.onnx`)
- German (`de_DE-thorsten-medium.onnx`)
Place the `.onnx` and `.onnx.json` files in `tools\piper\voices\`. The local server auto-detects them on boot.
