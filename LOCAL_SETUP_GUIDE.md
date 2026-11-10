# LOCAL_SETUP_GUIDE.md — Developer & Kiosk Deployment Quickstart

**Date:** 2026-11-05  
**Audience:** Field Engineers, Kiosk Technicians, Developers

---

## 1. Prerequisites

- **Operating System:** Windows 10 or 11 (64-bit)
- **Node.js:** Node.js 20 or higher (`node -v`)
- **Git:** Git for Windows (`git -v`)
- **Hardware:** Minimum 8 GB RAM, Intel/AMD multi-core CPU, 2 GB free disk space.

---

## 2. Quickstart Execution (One Command)

From the project root directory:

```powershell
# 1. Install / verify local catalog snapshot
node scripts/generate-catalog-snapshot.mjs

# 2. Run automated test suites (11 suites)
npm test

# 3. Start local kiosk server
npm start
```

The kiosk will boot on `http://localhost:8080`.

---

## 3. Available Endpoints & Interfaces

- **Touchscreen Kiosk:** `http://localhost:8080/index.html`
- **Premium Voice Surface:** `http://localhost:8080/voice.html`
- **Offline Health & Sync Status:** `http://localhost:8080/api/sync/status`
- **Medicine Search API:** `http://localhost:8080/api/catalog/search?q=doliprane`
- **Alternative Medicine API:** `http://localhost:8080/api/alternatives?sku=INT-PANADOL-500`
- **Local Triage Chat Turn:** `POST http://localhost:8080/api/chat-turn`

---

## 4. Manager Configuration: Chat vs. Voice-Only Chatbot Mode

The vending machine kiosk chatbot supports two distinct display modes sharing the identical underlying offline clinical engine and medicine catalogue:

### Mode A: Touchscreen / Chat Mode (Standard)
- **URL:** `http://localhost:8080/index.html`
- **Use Case:** Standard kiosk screen. Customers navigate questions via on-screen buttons, review detailed medication cards, and read full dosing instructions.
- **Voice Support:** Voice microphone is optional (tap to speak).

### Mode B: Voice-Only Chatbot Mode (Manager Approved)
- **URL:** `http://localhost:8080/voice.html`
- **Use Case:** When the manager authorizes a voice-only conversational kiosk.
- **Features:** 
  - Full-screen ambient voice orb and live audio waveform.
  - Hands-free conversational loop: The microphone automatically reopens after each spoken assistant response.
  - Acoustic barge-in: Tapping the orb or speaking interrupts assistant speech immediately.
  - Live closed-captioning of all dialogue.
- **Launch Command for Dedicated Kiosk Display:**
  ```powershell
  # Launch Chrome or Edge in full-screen locked kiosk mode on the voice surface
  msedge.exe --kiosk http://localhost:8080/voice.html --edge-kiosk-type=fullscreen
  ```
