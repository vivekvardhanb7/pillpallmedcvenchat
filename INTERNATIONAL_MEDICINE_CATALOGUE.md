# INTERNATIONAL_MEDICINE_CATALOGUE.md — Multi-Jurisdiction Medicine Catalogues

**Date:** 2026-11-05  
**Audience:** Pharmaceutical Data Engineers, Clinical Safety Architects  
**Scope:** Architecture and domain isolation across Moroccan, Indian, and International medicine references.

---

## 1. The Five Logical Data Domains

PILLPAL strictly separates five logical data domains to prevent cross-jurisdictional contamination:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. MOROCCAN MEDICINE CATALOGUE (AMMPS / DMP)                                 │
│    Primary legal jurisdiction. Authorized AMM products, Moroccan PPV prices, │
│    French/Arabic labelling, AMMPS withdrawal status.                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. INDIAN MEDICINE CATALOGUE (CDSCO / DPCO)                                 │
│    Secondary jurisdiction. CDSCO approvals, Indian Schedule H/OTC status,  │
│    fixed-dose combination gazettes, INR MRP prices.                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. INTERNATIONAL REFERENCE CATALOGUE (WHO ATC / DailyMed / RxNorm)          │
│    Ingredient nomenclature, ATC therapeutic categories, Defined Daily Doses │
│    (DDD), international clinical warnings, pharmacological mechanisms.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. VENDING-MACHINE PHYSICAL INVENTORY                                        │
│    Physical kiosk slot allocations (Slot 1–24), real-time stock counts,     │
│    batch/lot numbers, expiration dates, unit packaging status.              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. CLINICAL MEDICAL KNOWLEDGE BASE                                          │
│    Deterministic rules: contraindications, drug-drug interactions,          │
│    cumulative daily dose ceilings, duplicate active ingredient detectors.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Jurisdictional Isolation Rules

1. **Rule 1 — Non-Transferability of Approval:**  
   *An approval in India (CDSCO) or the United States (FDA) or Europe (EMA) does NOT grant regulatory status in Morocco.* If a customer requests a medicine that exists only in India or international databases (e.g. `Crocin`, `Dolo-650`, `Tylenol`), PILLPAL must explain:
   *"This brand is documented in international references, but is not an authorized Moroccan pharmacy speciality. In Morocco, the authorized product containing paracetamol is DOLIPRANE."*
2. **Rule 2 — Distinct Pricing & Currency:**  
   Moroccan products are priced exclusively in Moroccan Dirhams (`MAD`); Indian products in Indian Rupees (`INR`).
3. **Rule 3 — Stock Truthfulness:**  
   A medicine may be:
   - `IN_VENDING_STOCK`: Physically present and verified in a kiosk tray.
   - `CATALOGUE_ONLY`: Documented in the national registry but not physically stocked in this machine.
   - `LOCAL_PHARMACY_VERIFIED`: Available at a nearby partner retail pharmacy.
   - `UNAVAILABLE`: Not currently procurable.
