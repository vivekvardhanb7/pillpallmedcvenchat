# ONLINE_OFFLINE_SYNC.md — Catalogue Synchronization & Offline Outcome Replay

**Date:** 2026-11-05  
**Audience:** Data Engineers, Backend Developers, Operations  
**Scope:** Data synchronization protocol between the local kiosk offline store and the central Supabase database.

---

## 1. Synchronization Architecture

```
[Local Kiosk Server (web/server.mjs)]                [Cloud Supabase Postgres]
               │                                                 │
               ├─────── 1. Check Catalogue Version / Hash ──────►│
               │◄────── 2. Download Updated Formularies ─────────┤
               │                                                 │
               │   (Operates fully offline during disconnect)    │
               │   Queues outcomes in tmp/offline_outcomes.jsonl │
               │                                                 │
               ├─────── 3. Reconnect: Push Queued Outcomes ─────►│
               │◄────── 4. Acknowledge Batch Insert ─────────────┤
```

---

## 2. Outcome Log Replay Protocol

1. **Local Enqueue:**
   - Every completed triage assessment (reaching `CLINIC_REFERRAL`, `IMMEDIATE_MEDICAL_CARE`, `PRODUCT_ELIGIBLE`, or `NO_SUITABLE_PRODUCT`) generates a record.
   - If Supabase is unreachable, the JSON row is appended to `tmp/offline_outcome_queue.jsonl`.
2. **Schema of Queued Row:**
   ```json
   {
     "session_hash": "sha256_of_session_id",
     "country_code": "MA",
     "language_code": "en",
     "pathway": "pain_fever",
     "age_band": "18-64",
     "duration_band": "today",
     "severity": "mild",
     "outcome": "PRODUCT_ELIGIBLE",
     "product_sku": "MA-DOLIPRANE-500",
     "reason_code": "product_matched",
     "turns": 6,
     "elapsed_ms": 24500,
     "created_at": "2026-11-05T12:00:00Z",
     "synced": false
   }
   ```
3. **Replay Execution:**
   - When network connectivity is confirmed, the background sync worker reads the queue and executes batch POST requests to Supabase PostgREST (`kiosk_outcome_log`).
   - Uses `session_hash` with `on_conflict_do_nothing` to guarantee idempotency.
   - Upon successful 201/204 response, the local queue marks records as synced or rotates the log file.

---

## 3. Catalogue Snapshot Versioning & Integrity

- Local snapshot is saved as a verified JSON catalogue: `data/local_catalog_snapshot.json`.
- The snapshot header includes:
  - `snapshot_version`: Semantic versioning (e.g. `2026.11.05.1`).
  - `sha256_hash`: SHA-256 integrity digest of the product dataset.
  - `jurisdiction`: ISO-3166-1 alpha-2 code (`MA`, `IN`, `INT`).
  - `verified_at`: ISO timestamp of human clinical sign-off.
- The kiosk verifies the hash upon startup. If corrupted, it falls back to the previous immutable backup.
