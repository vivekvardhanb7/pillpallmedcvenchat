# MEDICAL_CONVERSATION_ENGINE.md — Adaptive Conversational Architecture

**Date:** 2026-11-05  
**Audience:** Healthcare Dialogue Engineers, Clinical AI Specialists  
**Scope:** Six-step medical intake workflow, structured question selection, and empathetic dialogue policies.

---

## 1. Six-Step Clinical Conversation Workflow

```
[STEP 1: Understand Complaint]
       │ User: "I have a terrible headache."
       ▼
[STEP 2: Adaptive Clinical Inquiry]
       │ - When did it begin? (Duration)
       │ - On a scale of mild to severe, how bad is it? (Severity)
       │ - Did it start suddenly like a thunderclap? (Emergency Check)
       ▼
[STEP 3: Warning Signs & Red Flags Evaluator]
       │ If Red Flag (e.g. fever + stiff neck, neurological signs):
       │   ──► [IMMEDIATE_MEDICAL_CARE Emergency Hand-off]
       ▼
[STEP 4: Medical Background & Risk Factors]
       │ - Age floor check (Under 18 referral)
       │ - Pregnancy / Breastfeeding gate
       │ - Known allergies & Current medications
       ▼
[STEP 5: Structured Evidence Assessment]
       │ Evaluates eligibility for OTC self-care vs. Clinic Referral
       ▼
[STEP 6: Natural Conversational Guidance & Follow-up]
       │ Explains self-care advice, precautions, or pharmacy options
```

---

## 2. Conversation State Object (Typed Schema)

The state object is tracked deterministically across all voice and text turns:

```json
{
  "session_id": "sess_20261105_9a8b7c",
  "step": "confirm",
  "current_complaint": "headache",
  "pathway_code": "pain_fever",
  "demographics": {
    "age": 32,
    "age_band": "18-64",
    "is_adult": true
  },
  "symptom_attributes": {
    "duration_band": "today",
    "severity": "mild",
    "onset": "gradual",
    "temperature_celsius": null
  },
  "clinical_safety": {
    "red_flags_present": false,
    "pregnancy_status": "none",
    "allergies": ["penicillin"],
    "current_medications": ["multivitamin"],
    "underlying_conditions": ["none"]
  },
  "intake_provenance": {
    "questions_asked": ["symptom", "age", "duration", "severity", "warning_signs", "pregnancy", "allergy", "medication", "condition"],
    "questions_skipped": [],
    "turns_count": 8,
    "elapsed_seconds": 38.5
  },
  "triage_outcome": "SELF_CARE_ELIGIBLE",
  "dispense_authorized": false
}
```

---

## 3. Empathy, Conciseness & Human Voice Guidelines

1. **Short Spoken Phrases:** Spoken answers must not exceed 2 to 3 sentences (~30 spoken words). Avoid lengthy paragraphs on voice channels.
2. **Never Announce Being an AI Repeatedly:** Do not start turns with *"As an AI..."* or *"I am an automated kiosk..."*. Communicate directly and professionally.
3. **No Redundant Disclaimers on Every Turn:** State the clinical scope naturally at start and end; do not append legal warnings to intermediate question turns.
4. **Immediate Acknowledgment:** Echo understood numbers and durations so the patient feels heard (*"Got it, since yesterday."*).
