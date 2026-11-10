# COMPETITOR_ARCHITECTURE_COMPARISON.md — Healthcare AI & Pharmacy Architecture Analysis

**Date:** 2026-11-05  
**Audience:** Clinical System Architects, AI Engineers, Pharmacy Automation Engineers  
**Scope:** Architectural decomposition of leading commercial clinical triage engines, pharmacy AI agents, and medication vending prototypes.

---

## 1. Executive Summary

Autonomous medical assessment and OTC guidance require a fundamental separation between:
1. **Conversational Intake / Natural Language Processing** (extracting concepts, asking follow-ups, communicating with the patient).
2. **Clinical Triage / Evidence Collection** (determining acuity, red flags, urgency of care).
3. **Formulary / Medication Matching** (matching indications against verified products, checking contraindications, drug interactions, duplicate ingredients).
4. **Dispensing / Physical Authorization** (executing a mechanical or retail handoff under pharmacist oversight).

Commercial market leaders strictly isolate these layers. No clinical system approved as a medical device (CE Class IIa or FDA clearance) permits an end-to-end generative LLM to autonomously determine medication eligibility or authorize dispensing.

---

## 2. Deep Architectural Decomposition of Healthcare Platforms

### 2.1 Ada Health
- **Public Reference:** [ada.com](https://ada.com/)
- **Core Architecture:**
  - **Dynamic Probabilistic Medical Knowledge Graph:** A curated Bayesian inference network mapping symptoms, risk factors, demographics, and disease presentations.
  - **Adaptive Question Selection:** Uses information gain (entropy reduction) to select the single most discriminative next question rather than a static decision tree.
  - **Explicit Medical Context:** Patient profile (age, biological sex, pregnancy, smoking, comorbidities, current medications) acts as a persistent conditioning prior.
  - **Safety Boundaries:**
    - Operates as an EU Class IIa medical device for symptom assessment.
    - Explicitly does **not** prescribe or authorize medication dispensing.
    - Embedded safety-netting: immediate escalation upon detection of acute red-flag symptoms.
- **Architectural Lessons for PILLPAL:**
  - Do not use a flat question list. Compute missing evidence discriminatively.
  - Maintain a typed `PatientContext` object throughout the session.
  - Never allow an LLM to hallucinate clinical follow-up questions; questions must be selected from a clinician-approved pool.

### 2.2 Infermedica
- **Public Reference:** [infermedica.com](https://infermedica.com/) · [Developer Documentation](https://developer.infermedica.com/documentation/overview/)
- **Core Architecture:**
  - **Inference Engine API:** REST API consuming structured concepts (`symptom`, `risk_factor`) with state (`present`, `absent`, `unknown`).
  - **NLP Medical Concept Extraction:** Converts unstructured user input (free text) into mapped UMLS/SNOMED-CT clinical concept IDs.
  - **Two-Phase Workflow:**
    1. *Diagnostic Engine (`/diagnosis`):* Computes disease probabilities and requests the next most relevant question (`"should_stop": false`).
    2. *Triage Engine (`/triage`):* Evaluates risk and emergency flags to output care urgency (`emergency_ambulance`, `emergency`, `consultation_24h`, `consultation`, `self_care`).
  - **API Contract:** Strict JSON schemas with distinct fields for evidence, risk factors, and acute symptoms.
- **Architectural Lessons for PILLPAL:**
  - Clearly delineate **Triage Level** (urgency of care) from **Product Selection** (self-care eligibility).
  - Adopt the explicit tri-state evidence model: `present`, `absent`, and `unknown` (where `unknown` triggers fail-closed safety).
  - Deterministic REST contract boundaries ensure testability and audit compliance.

### 2.3 K Health
- **Public Reference:** [khealth.com](https://khealth.com/)
- **Core Architecture:**
  - **Data-Driven Clinical Intake:** Machine learning models trained on millions of anonymized electronic health records (EHRs) compare the patient's symptoms with similar clinical trajectories.
  - **Human-in-the-Loop (HITL) Physician Escalation:** AI generates structured clinical summaries, differential diagnoses, and proposed treatment plans for a licensed physician who reviews and authorizes prescriptions.
- **Architectural Lessons for PILLPAL:**
  - Essential pattern for regulatory compliance: AI prepares evidence, structured rules check boundaries, but human pharmacist escalation is available when risk or uncertainty exceeds thresholds.

### 2.4 Buoy Health & Mediktor
- **Public References:** [buoyhealth.com](https://www.buoyhealth.com/) · [mediktor.com](https://www.mediktor.com/)
- **Core Architecture:**
  - **Buoy:** Conversational AI trained on clinical data to navigate patients to appropriate care venues (telehealth, clinic, self-care).
  - **Mediktor:** Hybrid NLP + ML evaluation engine using Bedrock/cloud LLM layers for conversational empathy combined with deterministic clinical triage matrices.
- **Architectural Lessons for PILLPAL:**
  - Natural conversation should provide empathetic, low-jargon phrasing while keeping the underlying decision matrix deterministic and verifiable.

### 2.5 OneDose & Pharmacy1st.ai
- **Public References:** [onedose.ai](https://onedose.ai/) · [pharmacy1st.ai](https://pharmacy1st.ai/)
- **Core Architecture:**
  - **Specialized Pharmacy Agent Workflows:** Modular agents handling prescription refills, medication interaction checks, dosage timing consultations, and patient reminders.
  - **Voice Consultation Interface:** Voice-driven conversational agent with automatic escalation to on-call pharmacists for ambiguous or high-risk requests.
  - **Pharmacy Management System (PMS) Integration:** Real-time lookup of pharmacy inventory, NDC/AMM identifiers, and insurance/pricing data.
- **Architectural Lessons for PILLPAL:**
  - Separate general medical advice from pharmacy operations.
  - Real-time stock status must distinguish between what is physically loaded in a kiosk vending slot vs. what is documented in a national drug formulary.

---

## 3. Automated Dispensing & Vending Architecture Comparison

| System | Clinical Model | Dispensing Model | Supervision Level | Gap vs. PILLPAL Goal |
|---|---|---|---|---|
| **InstyMeds** | None (Prescription input) | Automated point-of-care robotic locker | Pre-authorized electronic prescription from physician | Does not perform symptom triage; strictly executes valid prescription orders. |
| **Asteres ScriptCenter** | None (Pre-packaged pickup) | Secure locker / barcode pickup | Filled and checked off-site by retail pharmacy | Secure delivery only; no autonomous assessment or OTC guidance. |
| **MedAvail MedCenter** | Remote telehealth session | Embedded carousel vending machine | Live audio/video link with licensed pharmacist | Requires continuous human telepharmacist session before dispensing. |
| **Omnicell / BD Pyxis** | Hospital EHR order | Automated unit-dose cabinet | Nurse/physician credentialed access | Inpatient clinical staff workflow; not customer-facing. |
| **PILLPAL MedAssist Target** | Hybrid: Local LLM understanding + Deterministic Clinical Triage + Formularies | Smart kiosk locker / physical vending actuator | Autonomous for verified OTC low-risk self-care; fail-closed referral for all else | Must provide offline-capable OTC guidance with full clinical auditability and zero unverified substitutions. |

---

## 4. Architectural Synthesis for PILLPAL

```
+─────────────────────────────────────────────────────────────────────────────+
│                           USER INTERACTION LAYER                            │
│  Multilingual Voice (Whisper STT -> Piper TTS) + Touchscreen GUI (ES Module)│
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │ Raw Text / Audio
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│                      CONVERSATIONAL UNDERSTANDING LAYER                     │
│  Local LLM (Qwen / MedGemma) & Deterministic Regex Concept Extractor         │
│  - Extracts: Symptoms, Duration, Severity, Stated Allergies, Current Drugs  │
│  - Formulates: Empathetic, concise, natural-language clarification          │
│  - STRICT RULE: LLM CANNOT authorize, diagnose, or select medications       │
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │ Structured Clinical Session Object
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│                   DETERMINISTIC CLINICAL TRIAGE ENGINE                      │
│  (Inspired by Infermedica & Ada Health)                                     │
│  - Red-Flag Evaluator: Meningitis, Sepsis, Severe Cardiac/Dyspnea           │
│  - Hard Refusal Gates: Under-18, >7 days, Severe Pain, Pregnancy            │
│  - Tri-State Assessment: (Present, Absent, Unknown)                         │
│  - Urgency Level Output: [EMERGENCY, CLINIC_REFERRAL, SELF_CARE_ELIGIBLE]   │
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │ If SELF_CARE_ELIGIBLE:
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│             MEDICINE CATALOGUE, ALTERNATIVE & SAFETY ENGINE                 │
│  (Inspired by OneDose & Pharmacy1st.ai)                                     │
│  - Domain Isolation: Morocco (AMMPS/DMP) | India (CDSCO) | International    │
│  - Matcher Level 1-4: Exact -> Form/Strength Diff -> Therapeutic -> Block   │
│  - Fixed-Dose Combination Validator: Ingredient-by-ingredient check         │
│  - Safety Engine: Duplicate Active Ingredients, Interactions, Dose Limits   │
+──────────────────────────────────────┬──────────────────────────────────────+
                                       │ Validated Decision Token
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│                       VENDING & INVENTORY CONTROLLER                        │
│  - Inventory Lookup: In-Machine Stock vs. Broader Catalogue                 │
│  - Interlock Safety: Dispense flag is FALSE until all deterministic checks  │
│  - Outcome Logging: Anonymized audit trail with cryptographic hash          │
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 5. Architectural Invariants for PILLPAL

1. **Deterministic Safety Invariance:** No machine learning model or LLM prompt may decide clinical triage urgency, medication eligibility, or substitution appropriateness.
2. **Tri-State Fail-Closed Invariance:** Missing or uncertain medical safety data must evaluate as `Unknown` and trigger a safe clinical referral.
3. **Jurisdictional Separation Invariance:** Moroccan AMM registration, Indian CDSCO approval, and FDA/EMA references must reside in separate database namespaces and never share regulatory equivalence automatically.
4. **Stock Truthfulness Invariance:** The system must never mislead the user into believing an item documented in a national formulary is physically present in the vending machine.
