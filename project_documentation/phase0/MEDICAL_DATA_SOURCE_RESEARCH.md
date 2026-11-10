# MEDICAL_DATA_SOURCE_RESEARCH.md

**Date:** 2026-11-05
**Purpose:** identify what medicine data can legally and safely be used, and what
must not be presented as Moroccan approval.

**Rule:** an ingredient being approved in one country does not make a product
approved in another. Every row must carry its own jurisdiction, source,
verification date and reviewer.

---

## 1. Morocco (primary jurisdiction)

| Source | What it should provide | Access / status | Caveats |
|---|---|---|---|
| **AMMPS** — `https://ammps.gov.ma/` | Authorised medicines, RMMG generic directory, withdrawals, regulatory alerts | **Host did not respond** during the 2026-11-04 measurement; `ammps.sante.gov.ma` also failed | Cannot be used as a live verification API. Manual counter verification or a supplied leaflet is required |
| **Ministry of Health — DMP** — `https://www.sante.gov.ma/Pages/ADM_Centrale/DMP.aspx` | Directorate responsibilities, pricing, quality control, authorisation | Web pages; no verified bulk API | Organisational information, not a machine-readable product feed |
| **CNOPS / data.gov.ma** — `https://data.gov.ma/data/fr/dataset/referentiel-des-medicaments` | Medicine reference, princeps/generic, public and hospital prices, reimbursement | Dataset download; licence and update cadence **not verified** | An old dataset is not current authorisation evidence. Check the licence before redistribution |
| **RMMG** (via AMMPS) | Moroccan generic medicines directory | Not accessible while AMMPS is unreachable | Generic listing is not proof of therapeutic equivalence or availability |

**What this means:** Morocco-first is currently a **manual curation** process.
There is no reliable official API in this environment. Any automation must treat
Moroccan authorisation as a human-verified field, not something inferred from an
international source.

---

## 2. India (secondary, separate jurisdiction)

| Source | What it provides | Caveats |
|---|---|---|
| **CDSCO** — `https://cdsco.gov.in/` | Approved drugs, fixed-dose combinations, new drug approvals, prohibited combinations | Keep Indian status separate from Moroccan status. A CDSCO approval is not a Moroccan AMM |
| CDSCO FDC lists / prohibitions | Combination validity | A combination is not approved because its ingredients are approved individually |

No Indian product should appear in a Moroccan kiosk pathway. If an Indian
catalogue is added, it needs its own country code, currency, language rows and
regulatory status.

---

## 3. International references (supplementary only)

| Source | What it provides | Licence / caveat |
|---|---|---|
| **WHO ATC/DDD** — `https://www.who.int/tools/atc-ddd-toolkit` | Ingredient classification and defined daily doses | Registration/licensing terms apply to some tools; DDD is not a prescribed dose |
| **RxNorm** — `https://www.nlm.nih.gov/research/umls/rxnorm/` | US normalized ingredient/product identifiers | Requires UMLS licence acceptance; US-centric |
| **DailyMed** — `https://dailymed.nlm.nih.gov/` | US drug labels | Public labels; US labelling, not Moroccan |
| **openFDA** — `https://open.fda.gov/` | US adverse events, recalls, labels | US data; useful for signal research, not local approval |
| **ANSM / base-donnees-publique** — `https://base-donnees-publique.medicaments.gouv.fr/` | French RCP/leaflets | Used in the current draft as a proxy source; French, not Moroccan |
| **EMC** — `https://www.medicines.org.uk/` | UK SmPCs | Terms restrict redistribution; link, do not copy wholesale |

These can supply ingredient facts and warning text, but they cannot substitute
for Moroccan authorisation. Every draft row built from them must say so.

---

## 4. What the repository contains today

| Artefact | Contents | Status |
|---|---|---|
| `005_product_path_test_fixture.sql` | `ZZ-FIXTURE-TEST-500` / `TEST FIXTURE PRODUCT` | **Enabled live**; synthetic; must not be customer-reachable |
| `008_demo_catalogue.sql` | 15 synthetic `DEMO ... (synthetic)` rows across six pathways | Enables only under `ZZ`; intended for demos |
| `009_real_products_draft.sql` | 16 real medicines for `MA`, sourced from ANSM/EMC, all `in_review`, `chatbot_enabled = false`; 5 rows have `maximum_duration_days = NULL` | Draft, awaiting human clinical/legal sign-off |
| `scripts/update-actual-medicines.mjs` | Rewrites live `ZZ-DEMO-*` rows to real brand names, prices and doses, retaining `demo ...` allergy terms | **Live divergence from 008**; data-integrity problem |
| Live Supabase | 62 products, 16 enabled (all `ZZ`), 46 disabled | 15/16 enabled rows contain `demo ...` terms; fixture enabled |

### Source-quality problems visible in live data

- `example.invalid` leaflet URLs on three demo rows and the fixture.
- External hosts (`medicines.org.uk`, `base-donnees-publique...`) can change or
  disappear; one AMMPS host already does not answer.
- Reviewer strings such as "Synthetic demo data - NOT clinical approval" sit on
  rows whose `review_status` is `approved`.
- Real brand names and prices on synthetic rows with placeholder safety terms.
- DOLIPRANE's earlier safety row had an unverifiable source and a dose line that
  matched no published leaflet; `009` corrects it but the correction is not yet
  applied/signed.

---

## 5. Data model requirements

Every medicine row must carry:

- `country_code` and jurisdiction-specific registration number (AMM for Morocco).
- Brand name, INN/active ingredients, strength, form, route, pack size.
- Manufacturer/marketing authorisation holder.
- Prescription category and sale restrictions.
- `clinical_status`, `legal_status`, `market_status`, `review_status`.
- Source type, source URL, source retrieval date, source version.
- Named reviewer, role, review date.
- `maximum_duration_days` (never NULL for an enabled product).
- Ingredient synonyms and identifiers (ATC, RxNorm where licensed).
- Dose text and warnings copied from the cited label, not remembered.
- Explicit "not verified" markers instead of guesses.

A product must be impossible to enable unless all mandatory fields are present
and the reviewer is a named human. The current trigger checks approval fields
but not provenance; that is a gap.

---

## 6. Ingestion pipeline (recommended)

```
official source / supplied leaflet
  -> staging table (raw text, URL, retrieval date, hash)
  -> normalisation (ingredient identity, strength units, form, route)
  -> clinical review (named pharmacist/physician, per field)
  -> legal/regulatory review (country, prescription category, claims)
  -> approved product + safety + pathway mapping
  -> versioned catalogue snapshot for the kiosk
  -> audit log (who changed what, when, why)
```

Rules:

1. Never write an approved row directly from a scraper.
2. Store the source text/hash, not just a URL.
3. Keep country catalogues physically separate.
4. Version the whole catalogue, not individual rows only.
5. Re-verify at a defined interval; mark stale rows.
6. Remove or disable a product immediately when a recall/alert is found, even
   before the next catalogue version.

---

## 7. Open decisions

- Which Moroccan source will be used for AMM verification while AMMPS is
  unreachable? (supplied leaflet, wholesaler data, manual counter check)
- Is the CNOPS dataset licence compatible with storing and displaying prices?
- Will French/English SmPC text be shown verbatim, summarised, or translated?
- Who signs as clinical reviewer and legal reviewer for the first 16 products?
- What is the re-verification interval (90/180/365 days)?
