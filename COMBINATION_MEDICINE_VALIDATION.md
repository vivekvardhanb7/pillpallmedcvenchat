# COMBINATION_MEDICINE_VALIDATION.md — Fixed-Dose Combination (FDC) Validation Engine

**Date:** 2026-11-05  
**Audience:** Clinical Pharmacologists, Drug Safety Engineers  
**Scope:** Deterministic clinical validation rules for multi-ingredient and fixed-dose combination medicines.

---

## 1. Clinical Principles for Combination Medicines

Multi-ingredient medicines (Fixed-Dose Combinations - FDCs) present elevated clinical risk due to compounding side effects, additive toxicity, and drug interactions.

### Invariant Rules:
1. **Rule 1 — No Inferred Approval:**  
   *A combination product is NOT authorized simply because its individual active ingredients are separately approved.* The combination itself must possess an active, valid marketing authorization in the local jurisdiction.
2. **Rule 2 — Prohibited Multi-Drug Substitution:**  
   *The system must NEVER instruct a patient to take two separate single-ingredient medicines to "make up" for an out-of-stock combination medicine.* (e.g., Do not recommend taking a separate paracetamol tablet and pseudoephedrine tablet together to replace a cold combination).
3. **Rule 3 — Strict Ingredient & Ratio Verification:**  
   When validating combinations, every single active ingredient, its precise strength, and its release profile (immediate vs extended release) must be verified.

---

## 2. Common OTC Combination Classes Evaluated

| Combination Class | Ingredients | Moroccan Status | Indian Status (CDSCO) | Clinical Risks & Interlocks |
|---|---|---|---|---|
| **Cold & Flu Analgesic + Decongestant** | Paracetamol + Pseudoephedrine + Triprolidine | `ACTIFED RHUME`: **Retiré du Marché** (Withdrawn) | Restricted / Regulated | Cardiovascular risk, severe hypertension, stroke risk; blocked in modern self-care kiosks |
| **Analgesic + Opioid** | Paracetamol 500mg + Codeine 30mg | `CODOLIPRANE`: **Prescription Only (Ordonnance)** | Schedule H (Prescription Only) | Addiction risk, respiratory depression; **Strictly blocked from OTC vending** |
| **Analgesic + Adjuvant** | Paracetamol 500mg + Caffeine 65mg | `PANADOL EXTRA`: Authorized OTC in many markets | Widely approved | Tachycardia, insomnia; max daily paracetamol ceiling must still enforce 4000mg |
| **Antacid + Antiflatulent** | Aluminum Hydroxide + Magnesium Hydroxide + Simethicone | Standard OTC | Standard OTC | Renal impairment check; magnesium laxative effect vs aluminum constipation balance |

---

## 3. Fixed-Dose Combination Validation Logic

```javascript
export function validateCombinationMedicine(product, userSafetyContext) {
  // 1. Regulatory Status Check
  if (product.country_registration.market_status !== 'commercialised') {
    return {
      eligible: false,
      reason: 'combination_regulatory_status_blocked',
      message: `Product ${product.brand_name} is marked ${product.country_registration.market_status} by national authorities.`
    };
  }

  // 2. Prescription Category Check
  if (product.country_registration.prescription_category !== 'otc') {
    return {
      eligible: false,
      reason: 'combination_requires_prescription',
      message: `${product.brand_name} contains controlled ingredients and requires a valid physician prescription.`
    };
  }

  // 3. Multi-Ingredient Safety Accumulation Check
  for (const ingredient of product.ingredients) {
    // Check patient stated allergies against every ingredient in the combination
    if (userSafetyContext.allergies.includes(ingredient.name.toLowerCase())) {
      return {
        eligible: false,
        reason: 'allergy_conflict',
        blocked_ingredient: ingredient.name
      };
    }
    // Check if patient is already taking a medicine with the same ingredient
    if (userSafetyContext.current_medications.some(m => m.includes(ingredient.name.toLowerCase()))) {
      return {
        eligible: false,
        reason: 'duplicate_active_ingredient',
        blocked_ingredient: ingredient.name
      };
    }
  }

  return { eligible: true };
}
```
