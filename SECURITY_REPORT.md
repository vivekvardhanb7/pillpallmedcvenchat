# SECURITY_REPORT.md — Security, Privacy & Kiosk Hardening Audit

**Date:** 2026-11-05  
**Auditor:** Healthcare Security & Application Hardening Engineer  
**Scope:** Vulnerability analysis, input sanitation, network exposure, and physical kiosk security controls.

---

## 1. Attack Surface Analysis & Hardening Controls

| Attack Vector | Vulnerability Risk | Hardening Control Enforced in Code | Status |
|---|---|---|---|
| **Path Traversal** | Accessing sensitive system files via HTTP GET | `serveStatic()` resolves relative paths against `web/`, enforces path boundaries, and rejects parent traversal (`..`) | **SECURED** |
| **Source Code Disclosure** | Downloading backend scripts (`server.mjs`, `.env`) | File extension allowlist: only `.html`, `.js`, `.css`, `.json`, `.png`, `.svg`, `.webp`, `.woff` are servable. `.mjs`, `.env`, `.sql` return 404 | **SECURED** |
| **Denial of Service (DoS)** | Exhausting server memory via unbounded POST bodies | Strict byte limits: 64 KB for `/api/chat-turn`, 16 KB for search, 8 KB for TTS, 6 MB for audio WAV | **SECURED** |
| **Command Injection** | Injecting shell commands via text-to-speech string | `sanitizeTtsText()` strips control characters (`\u0000-\u001f`, `<>`, `\u007f`) and caps length at 800 characters before piping to stdin | **SECURED** |
| **Clickjacking & XSS** | Embedding kiosk in malicious iframe / script injection | Headers enforced: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict `Content-Security-Policy` | **SECURED** |
| **Database Data Leakage** | Direct public access to Supabase tables | PostgreSQL Row Level Security (RLS) is enabled on all tables with zero public access. `anon` has zero read/write rights | **SECURED** |
| **Unauthorized Dispensing** | Forging HTTP calls to trigger mechanical vending | `dispense_authorized` is hardcoded to `false` in all software paths; physical motor actuation requires hardware interlock | **SECURED** |

---

## 2. Privacy & Data Minimization

1. **No Real Patient Identifiers:** The kiosk stores zero patient names, telephone numbers, national identity numbers, or audio recordings.
2. **Session Hash Anonymization:** Encounters are logged using a 16-character SHA-256 hash derived from session timestamps.
3. **Local Audio Destruction:** Temporary WAV audio clips captured during voice turns are unlinked immediately after transcription.
