# N8N_INTEGRATION.md — Workflow Orchestration & Cloud Synchronization

**Date:** 2026-11-05  
**Audience:** Workflow Automation Engineers, Integration Specialists  
**Scope:** Architecture and operational boundaries of the n8n workflows.

---

## 1. Role of n8n in PILLPAL Architecture

In the offline-first architecture, n8n functions as an **optional online orchestrator and synchronization bridge**, not as a single point of failure:
- **Online Mode:** n8n receives turns, queries central Supabase Postgres, logs outcomes to cloud databases, and triggers pharmacist review notifications.
- **Offline Mode:** The local Node kiosk server (`web/server.mjs`) executes identical deterministic code nodes directly, maintaining 100% operation when n8n is unreachable.

---

## 2. Active Workflows

| Workflow Name | Workflow ID | Node Count | Role |
|---|---|---|---|
| **PILLPAL MedAssist - Supabase Safety Chat MVP** | `CtomsWyOIBEuYrtX` | 9 nodes | Online triage and catalogue matching against Supabase Postgres |
| **PILLPAL MedAssist - Spoken Answer Understanding** | `Tq1UTgrin8HYd9s6` | 10 nodes | Optional spoken concept extraction sidecar |

---

## 3. Workflow Drift Prevention

The codebase enforces strict code-to-workflow parity:
- Source code in `n8n/src/intake-and-safety-engine.js` and `n8n/src/catalog-decision.js` is automatically compiled into the workflow JSON using `node n8n/build-workflow.mjs`.
- Automated test `scripts/check-workflow-drift.mjs` verifies byte-for-byte fidelity in every `npm test` run.
- Cloud deployment verification is available via `npm run check -- --live`.
