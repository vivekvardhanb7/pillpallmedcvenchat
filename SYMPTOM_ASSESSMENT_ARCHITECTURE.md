# SYMPTOM_ASSESSMENT_ARCHITECTURE.md — Clinical Assessment Protocols

**Date:** 2026-11-05  
**Audience:** Clinical Decision Support Engineers, Medical Officers  
**Scope:** Clinical assessment trees, symptom-specific warning signs, and triage routing across the 7 core pathways.

---

## 1. Pathway Assessment Matrices

| Symptom Pathway | Mandatory Clinical Inquiries | Immediate Red Flags (EMERGENCY) | Self-Care Referral Boundaries |
|---|---|---|---|
| **Pain & Fever** | Onset, duration, severity, neck stiffness, rash, temperature | Sudden thunderclap headache, stiff neck + high fever, confusion, seizure, breathing difficulty | Max duration > 7 days, severe pain, child < 18, pregnancy |
| **Cold & Cough** | Duration, breathlessness, phlegm color, blood, existing lung disease | Stridor, severe dyspnea, coughing up blood, chest pain on inspiration | Cough > 2 weeks, high persistent fever, wheezing in non-asthmatic |
| **Heartburn & Acidity** | Meal relationship, exertion trigger, radiating pain, dysphagia | Crushing chest pressure radiating to arm/jaw, sweating, shortness of breath, black tarry stool | Difficulty swallowing, unexplained weight loss, persistent vomiting |
| **Diarrhoea** | Frequency, blood, fever, hydration status, recent antibiotics | Blood in stool, signs of severe dehydration (lethargy, sunken eyes, no urine), severe abdominal rigidity | Duration > 48h in adults, high fever, inability to retain oral fluids |
| **Mild Allergy** | Trigger, facial/lip swelling, breathing difficulty, wheezing | Lip/tongue/throat swelling, difficulty swallowing, wheezing, anaphylaxis signs | Systemic hives, blistering, eye involvement |
| **Minor Wound & First Aid** | Depth, bleeding control, foreign object, animal bite, tetanus | Arterial pulsating bleeding, deep puncture, embedded glass/metal, human or animal bite | Signs of active infection (pus, spreading erythema, red streaks) |
| **Other / Unspecified** | Open description | Any systemic or acute distress | Immediate primary care referral (No autonomous medicine recommendation) |

---

## 2. Acuity & Triage Levels

```
                     TRIAGE DECISION LADDER
                     
  [Emergency Red Flag Detected]
           │
           ▼
  [IMMEDIATE_MEDICAL_CARE] ──► Call 15 (SAMU Morocco) / 112 / Seek ER
  
  [Disqualifying Boundary] (Severe pain, >7 days, Pregnancy, Under 18)
           │
           ▼
  [CLINIC_REFERRAL] ────────► Consult Physician or Pharmacist
  
  [Information Incomplete or Uncertain History]
           │
           ▼
  [NO_SUITABLE_PRODUCT] ────► Cannot safely recommend without exam
  
  [Low Acuity + Validated Clear Safety Profile]
           │
           ▼
  [PRODUCT_ELIGIBLE] ───────► Offer OTC Self-Care Information & Verified Product
```

---

## 3. Disqualification Gates (Fail-Closed)

- **Pediatric Safety:** Patients under 18 years of age are automatically referred to a pediatrician or general practitioner.
- **Duration Boundary:** Self-treatment is restricted to acute self-limiting conditions (< 7 days).
- **Severity Boundary:** Severe symptoms disqualify OTC vending immediately.
- **Pregnancy & Lactation:** Unless specifically approved for pregnancy by Moroccan RCP with zero contraindications, pregnancy triggers conservative referral.
