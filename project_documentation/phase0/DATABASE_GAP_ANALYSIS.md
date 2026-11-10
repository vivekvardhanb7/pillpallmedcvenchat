# DATABASE_GAP_ANALYSIS.md

**Date:** 2026-11-05
**Scope:** compare the current Supabase schema with the data model required by the
master brief, and record the live-data integrity problems found in Phase 0.

---

## 1. Current schema

| Object | Origin | Written by | Used? |
|---|---|---|---|
| `countries` | 001 | migrations | ✅ |
| `products` | 001 | migrations | ✅ |
| `product_safety` | 001 | migrations | ✅ |
| `symptom_pathways` | 001 | migrations | ✅ |
| `questions` | 001 | migrations | ❌ (questions are in engine code) |
| `ui_messages` | 001 | migrations | ❌ |
| `clinical_rules` | 001 | migrations | ❌ (rules are in engine code) |
| `product_pathways` | 001 | migrations | ✅ |
| `rule_products` | 001 | migrations | ❌ |
| `chat_sessions` | 001 | — | ❌ |
| `session_answers` | 001 | — | ❌ |
| `chat_events` | 001 | — | ❌ |
| `decisions` | 001 | — | ❌ |
| `decision_products` | 001 | — | ❌ |
| `decision_rule_results` | 001 | — | ❌ |
| `recommendable_products` (view) | 001 | — | ✅ (superseded by 004 view) |
| `recommendable_product_pathways` (view) | 004 | — | ✅ the matcher's only read |
| `kiosk_outcome_log` | 007 | n8n PostgREST insert | ✅ one row per finished assessment |

Security posture: RLS enabled on all tables with **no policies**; `anon` and
`authenticated` revoked; `service_role` only. The enable trigger
`enforce_product_safety_before_enable` requires an approved safety row and an
approved pathway mapping before `chatbot_enabled = true`.

---

## 2. Mapping to the brief's recommended tables

| Brief table | Current equivalent | Status |
|---|---|---|
| `active_ingredients` | `products.active_ingredients` JSONB | 🟡 denormalised; no identity/synonyms |
| `ingredient_synonyms` | — | ❌ |
| `medicine_products` | `products` | ✅ (flat) |
| `product_ingredients` | JSONB on `products` | 🟡 no strength/unit normalisation |
| `dosage_forms` | text field | 🟡 no controlled vocabulary |
| `country_registrations` | `products.country_code` + status fields | 🟡 no AMM/registration number or authority record |
| `medicine_labels` | `label_url`, `label_version` | 🟡 no stored label text/hash |
| `fixed_dose_combinations` | — | ❌ |
| `drug_interactions` | `product_safety.interaction_rules` JSONB | 🟡 free-text terms, no severity |
| `contraindications` | `product_safety.contraindications` JSONB | 🟡 free-text terms |
| `medicine_restrictions` | — | ❌ |
| `regulatory_alerts` | — | ❌ |
| `alternative_rules` | — | ❌ |
| `vending_inventory` | — | ❌ |
| `medicine_sources` | `clinical_source_url` text | 🟡 no source registry |
| `dataset_versions` | — | ❌ |

The current model is adequate for a single curated catalogue and a deterministic
matcher, but it cannot support ingredient-level clinical checks, country
registration traceability, alternatives or recalls without normalisation.

---

## 3. Live-data integrity problems

| ID | Problem | Evidence | Risk |
|---|---|---|---|
| D1 | Synthetic fixture enabled | `ZZ-FIXTURE-TEST-500`, priority 40, `chatbot_enabled=true` | Can be returned as a product |
| D2 | Placeholder allergy terms | 15/16 enabled rows contain `demo ...` | Customer-visible nonsense; false safety signal |
| D3 | Real brand names on synthetic rows | `update-actual-medicines.mjs` rewrote `ZZ-DEMO-*` rows | Synthetic data looks like a real medicine |
| D4 | Reviewer string contradicts `approved` status | "Synthetic demo data - NOT clinical approval" on approved rows | Audit trail is misleading |
| D5 | `example.invalid` leaflet URLs | Fixture + three demo rows | Unreachable provenance |
| D6 | External leaflet hosts | `medicines.org.uk`, `base-donnees-publique...` | Links can disappear; redistribution terms unchecked |
| D7 | NULL `maximum_duration_days` | 5 rows in migration `009` | Matcher passes any duration |
| D8 | Repo vs live divergence | `008` defines synthetic names; live rows use real names | Re-running `008` will not restore the intended demo state |
| D9 | `009` is drafted, not applied/signed | File exists, `in_review`, disabled | MA catalogue remains empty |
| D10 | Audit cannot see provenance | `audit:catalog` reports 0 blockers | Synthetic/placeholder rows pass |

---

## 4. Outcome log gaps

Current `kiosk_outcome_log` is well designed for privacy: hashed session key,
country, language, pathway, age band, duration, severity, outcome, reason string,
turns, elapsed time, timestamp. Missing for a clinical audit:

- engine / rule-set version
- catalogue snapshot version
- product id offered (not personal data)
- safety fields answered vs not asked (structured flags, no free text)
- model-assist used / accepted / rejected (for the optional mapper)
- referral destination / escalation path
- adverse-event flag

Retention: `prune_kiosk_outcome_log(90)` exists but is not scheduled. The log is
append-only for `service_role` (select/insert only); deletion requires SQL.

---

## 5. Proposed migration plan

### 010 — data integrity guard (P0, before any demo)

- Add `data_origin` (`synthetic`, `reviewed`, `imported`) and `is_fixture`.
- Add a CHECK/trigger: a row with `data_origin='synthetic'` or `is_fixture=true`
  cannot be enabled outside the `ZZ` country; `ZZ` rows cannot be shown when
  `country_code='MA'`.
- Require `reviewer_name` and `reviewer_role` to be non-empty and not contain
  "synthetic"/"test"/"demo" for an approved row.
- Reject `example.invalid` and placeholder terms at enable time.
- Make `maximum_duration_days` mandatory for an enabled product.
- Add a view `catalogue_readiness` for the audit script.

### 011 — normalised ingredient and registration model

- `active_ingredients`, `ingredient_synonyms`, `product_ingredients`,
  `dosage_forms`.
- `country_registrations` (authority, registration number, status, valid from/to,
  source, verified at).
- `medicine_sources`, `dataset_versions`.
- Backfill from the 16 draft rows; keep `products.active_ingredients` as a
  compatibility view or generated projection.

### 012 — safety knowledge

- `drug_interactions` (ingredient pair, severity, mechanism, source).
- `contraindications` (coded condition, synonyms, severity).
- `medicine_restrictions` (age, pregnancy, renal/hepatic, prescription category).
- `regulatory_alerts` (recall/withdrawal, date, source, hard block).
- `alternative_rules` (level 1–4, ingredient/form/strength equivalence criteria).

### 013 — operations

- Extend `kiosk_outcome_log` with version and structured safety flags.
- Add `pharmacist_review_queue` and `adverse_event_report` (privacy-minimised).
- Add an immutable change-audit table for catalogue edits.

### 014 — vending (only when hardware work starts)

- `vending_inventory`, `vending_slot`, `dispense_attempt`.
- No dispensing authorisation until a separate safety and hardware review.

---

## 6. Rules for all future migrations

1. Apply in numeric order; never edit an applied migration.
2. Every migration is idempotent where possible (`if not exists`,
   `on conflict`).
3. Never enable a product as part of a data import.
4. Keep `MA`, `IN`, `ZZ` and international rows physically distinguishable.
5. Store the source URL, retrieval date and hash, not only a human-readable
   citation.
6. Require a named reviewer for approval; a string such as "test" must fail.
7. Add a verification query at the end of each migration that returns zero rows
   on success.
8. Test the rollback path on a disposable project before applying to the live
   one.

---

## 7. Conclusion

The database is secure and correctly RLS-locked, but it is a **flat catalogue**,
not the normalized medicine knowledge base the brief requires. Before expanding
it, the live demo data must be made honest. The first migration should be a
guard, not a feature.
