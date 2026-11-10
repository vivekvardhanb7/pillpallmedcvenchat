# LAPTOP_COMPATIBILITY_REPORT.md — Reference Hardware Profile & Resource Budget

**Date:** 2026-11-05  
**Auditor:** Edge Hardware & Systems Performance Engineer  
**Machine:** HP Pavilion Laptop 15-eg2xxx  
**Operating System:** Windows 10/11 (Build 10.0.26200)

---

## 1. Physical Hardware Specifications

| Subsystem | Hardware Component | Detailed Metrics | Architectural Impact |
|---|---|---|---|
| **Processor (CPU)** | 12th Gen Intel(R) Core(TM) i5-1240P | 12 Physical Cores (4 P-Cores, 8 E-Cores), 16 Logical Processors, 1.70 GHz base, up to 4.40 GHz Turbo | Supports AVX2, AVX-VNNI, FMA. Native `ggml-cpu-alderlake.dll` provides fast vector acceleration for Whisper and GGUF quantization. |
| **System Memory (RAM)** | 2x Micron DDR4-3200 (Total 8 GB) | **7.74 GB Usable System RAM** | **Hard constraint.** With Windows desktop, browser kiosk, and Node server active, free available RAM is **3.2 to 3.8 GB**. Total model footprint cannot exceed 3.0 GB without risking OS swapping. |
| **Graphics (GPU)** | Intel(R) Iris(R) Xe Graphics (96 EUs) | Dynamic Shared Memory (~3.9 GB max shared), 128 MB dedicated | **No discrete NVIDIA CUDA cores.** PyTorch CUDA is unavailable. All edge models must execute via Intel CPU vectorization or OpenVINO / DirectML. |
| **Storage Volumes** | Primary NVMe SSD | `C:\`: 33.27 GB free (377.4 GB total)<br>`V:\`: 41.51 GB free (97.7 GB total) | Healthy headroom for runtime binaries, GGUF weights, and audio caches. Hard cap: **No downloads > 4.0 GB**. |
| **Installed Runtimes** | Node.js, Python, Git, Ollama | Node v24.13.1, npm 10.8.2, Python 3.14.6, Git 2.55.0, Ollama 0.35.0 (Client) | Node 24 and native C/C++ x64 binaries run natively. Docker daemon is **not** installed. |

---

## 2. Memory Budget Allocation (8 GB Physical RAM)

```
Total Physical RAM: 8,192 MB (8.00 GB)
┌────────────────────────────────────────────────────────┐
│ Windows 11 OS + Core Background Services: ~3,400 MB     │
├────────────────────────────────────────────────────────┤
│ Kiosk Chrome/Edge Browser (UI + Web Audio): ~800 MB    │
├────────────────────────────────────────────────────────┤
│ Node.js Kiosk Server + Engine Runtime: ~120 MB         │
├────────────────────────────────────────────────────────┤
│ TTS Runtime (Piper ONNX + Voice Model): ~90 MB         │
├────────────────────────────────────────────────────────┤
│ STT Runtime (Whisper.cpp ggml-base): ~250 MB           │
├────────────────────────────────────────────────────────┤
│ MAXIMUM PERMISSIBLE BUDGET FOR LOCAL LLM: ~2,500 MB    │
├────────────────────────────────────────────────────────┤
│ Safety Buffer / OS Dynamic Cache: ~1,000 MB            │
└────────────────────────────────────────────────────────┘
```

---

## 3. Concurrency & Thermal Management

1. **Sequential Execution Protocol:**
   - Do **NOT** invoke Whisper STT, a generative LLM, and Piper TTS concurrently in parallel child processes.
   - Execute strictly sequentially: User speech input -> Whisper STT (transcribe to text) -> Process clinical rules & NLU -> Piper TTS (synthesize response audio).
   - This prevents CPU contention, thread thrashing, and memory spikes.
2. **Thermal Throttling Guard:**
   - On sustained 100% CPU loads, the Intel i5-1240P throttles clock speeds from 4.0 GHz down to 1.8 GHz to stay within the 28W TDP limit.
   - Limiting worker threads to **4 to 6 threads** (`-t 6`) yields 95% of peak throughput while keeping CPU core temperatures under 72°C.
