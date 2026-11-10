# MEDICAL_SAFETY_ENGINE.md — Deterministic Clinical Decision Support & Safety Engine

**Date:** 2026-11-05  
**Audience:** Clinical Decision Support Engineers, Safety Officers  
**Scope:** Architecture of the standalone, deterministic safety engine responsible for validating all medication recommendations and dispensing permissions.

---

## 1. Safety Architecture: Separation of Concerns

```
                  THE BOUNDARY MATRIX
                  
  [Generative LLM Layer]
    Role: Natural language transcription, empathetic question phrasing,
          conversational tone, multilingual explanations.
    AUTHORITY: 0% DECISION POWER. CANNOT APPROVE DISPENSING.
           │
           ▼ (Structured Patient Context)
  [Independent Deterministic Safety Engine]
    Role: Rigid rule evaluation with zero hallucinations.
    Checks:
      ├── 1. Emergency Red-Flag Triage
      ├── 2. Patient Age & Duration Boundaries
      ├── 3. Pregnancy & Lactation Policy
      ├── 4. Duplicate Active Ingredient Detection
      ├── 5. Cumulative Daily Dose & Interval Ceilings
      ├── 6. Drug-Drug Interaction Matrix
      ├── 7. Disease Contraindication Exclusions
      ├── 8. National Regulatory Status & Recall Feed
      └── 9. Prescription Status Enforcement
           │
           ▼ (Validated Cryptographic Decision Token)
  [Physical Vending Hardware Controller]
    Role: Actuates hardware motors only upon presence of a signed,
          fully validated decision token.
```

---

## 2. Deterministic Safety Checks

### 2.1 Duplicate Active Ingredient Detection
- **Clinical Risk:** Paracetamol toxicity is the leading cause of acute liver failure in self-care. Patients frequently consume a paracetamol cold sachet and a paracetamol tablet simultaneously.
- **Engine Logic:**
  - Extracts all normalized INN active ingredients from the patient's `current_medications`.
  - Compares with candidate product ingredients.
  - If match found: **HARD BLOCK** (`duplicate_active_ingredient_detected`).

### 2.2 Maximum Cumulative Dose & Interval Checking
- **Single Dose Limit:** Paracetamol max single dose = 1000 mg; Ibuprofen max single dose = 400 mg.
- **24-Hour Cumulative Limit:** Paracetamol max daily dose = 4000 mg; Ibuprofen max daily dose = 1200 mg (OTC limit).
- **Minimum Dose Interval:** Paracetamol minimum 4 hours between doses; Ibuprofen minimum 6 to 8 hours.

### 2.3 Drug-Drug Interaction Blocking
- **High-Risk Interaction Pairs:**
  - NSAIDs (Ibuprofen / Aspirin) + Anticoagulants (Warfarin / Sintrom / NOACs) -> Severe GI bleed risk -> **HARD BLOCK**.
  - NSAIDs + ACE Inhibitors (Captopril / Enalapril) -> Acute kidney injury risk -> **HARD BLOCK**.
  - Cetirizine + CNS Depressants / Alcohol -> Severe sedation -> **WARNING REQUIRED**.

### 2.4 Contraindication Blocking
- **Active Peptic Ulcer / Gastric Bleed:** Hard block on all NSAIDs and Aspirin.
- **Severe Hepatic Impairment:** Hard block on Paracetamol.
- **Severe Renal Impairment (eGFR < 30):** Hard block on NSAIDs, Loperamide, and high-dose effervescent salts (sodium load).
