# CLINICAL_VALIDATION_RULES.md — Executable Clinical Decision Rules

**Date:** 2026-11-05  
**Audience:** Clinical Safety Engineers, Rule Authors  
**Scope:** Formal clinical logic expressions implemented in the decision core.

---

## 1. Triage Decision Rules

```
RULE T1: EMERGENCY_HEADACHE
  IF (symptom == 'headache' OR pathway == 'pain_fever')
     AND (warning_signs CONTAINS ANY ['sudden_severe', 'thunderclap', 'stiff_neck_with_fever', 'confusion', 'vision_loss'])
  THEN OUTCOME = IMMEDIATE_MEDICAL_CARE
       REASON = 'emergency_neurological_or_meningeal_signs'
       DISPENSE_AUTHORIZED = FALSE

RULE T2: EMERGENCY_CHEST_PAIN
  IF (complaint CONTAINS 'chest_pain' OR warning_signs CONTAINS 'crushing_chest_pressure')
     OR (pathway == 'heartburn' AND associated_symptoms CONTAINS ANY ['sweating', 'arm_jaw_radiation', 'dyspnea'])
  THEN OUTCOME = IMMEDIATE_MEDICAL_CARE
       REASON = 'possible_acute_coronary_syndrome'
       DISPENSE_AUTHORIZED = FALSE

RULE T3: PEDIATRIC_REFUSAL
  IF patient.age < 18
  THEN OUTCOME = CLINIC_REFERRAL
       REASON = 'pediatric_age_outside_autonomous_kiosk_scope'
       DISPENSE_AUTHORIZED = FALSE

RULE T4: PROLONGED_DURATION_REFUSAL
  IF symptom.duration_days > 7 OR symptom.duration_band == 'more_than_7_days'
  THEN OUTCOME = CLINIC_REFERRAL
       REASON = 'duration_exceeds_otc_self_care_limits'
       DISPENSE_AUTHORIZED = FALSE

RULE T5: SEVERE_PAIN_REFUSAL
  IF symptom.severity == 'severe'
  THEN OUTCOME = CLINIC_REFERRAL
       REASON = 'severe_pain_requires_clinical_evaluation'
       DISPENSE_AUTHORIZED = FALSE
```

---

## 2. Product Eligibility & Safety Rules

```
RULE S1: DUPLICATE_INGREDIENT_GUARD
  FOR EACH candidate_product IN catalogue
    FOR EACH ingredient IN candidate_product.active_ingredients
      IF patient.current_medications CONTAINS ingredient.name
      THEN EXCLUDE candidate_product
           REASON = 'duplicate_active_ingredient_toxicity_risk'

RULE S2: ALLERGY_GUARD
  FOR EACH candidate_product IN catalogue
    FOR EACH ingredient IN candidate_product.active_ingredients
      IF patient.allergies CONTAINS ingredient.name
         OR patient.allergies CONTAINS ANY candidate_product.excipients
      THEN EXCLUDE candidate_product
           REASON = 'known_allergen_conflict'

RULE S3: NSAID_CONTRAINDICATION_GUARD
  IF candidate_product.therapeutic_class == 'NSAID'
     AND (patient.conditions CONTAINS ANY ['peptic_ulcer', 'gastric_bleed', 'severe_kidney_disease', 'third_trimester_pregnancy'])
  THEN EXCLUDE candidate_product
       REASON = 'nsaid_absolute_contraindication'
```
