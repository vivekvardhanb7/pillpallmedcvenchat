# PillPal MedAssist: Symptom Checker Gemini Integration Specification

**Date:** 2026-11-04  
**Status:** Proposed Architecture & Integration Plan  
**Safety Classification:** Invariant 0 Compliant (Zero AI in product recommendation, eligibility, or dispensing)

---

## 1. Executive Summary & Existing Workflow Analysis

### 1.1 Existing Symptom Checking Architecture
Currently, PillPal MedAssist uses a two-tier hybrid architecture:
1. **Decision & Safety Engine (`n8n/src/intake-and-safety-engine.js` & `n8n/src/catalog-decision.js`):**
   - A deterministic finite state machine running in n8n (production workflow `CtomsWyOIBEuYrtX`).
   - Evaluates:
     - `symptom` (complaint pathway: `pain_fever`, `cold_cough`, `allergy`, `diarrhoea`, `heartburn`, `skin_minor_wound`, `other`)
     - `age` (numerical range: 0–120; under-18 referred to clinic)
     - `duration` (`today`, `1_to_2_days`, `3_to_7_days`, `more_than_7_days`)
     - `severity` (`mild`, `moderate`, `severe`; severe triggers clinic referral)
     - `warning_signs` (acute red flags; triggers immediate medical emergency care)
     - `pregnancy_breastfeeding` (`pregnant`, `breastfeeding`, `both`, `no`, `not_applicable`, `prefer_not_to_say`)
     - `allergy_status` & `allergy_terms` (free-text ingredients matched against database)
     - `medication_status` & `medication_terms` (free-text active interactions)
     - `condition_status` & `condition_terms` (free-text contraindications)
     - `confirm` (explicit customer verification before product matching)
   - Product eligibility is computed strictly in SQL/PostgREST from `recommendable_product_pathways`.
   - `dispense_authorized` is permanently `false`.

2. **Understanding Layer (`web/answer-understanding.js` & `n8n/understand-workflow.mjs`):**
   - Powered by **Google Gemini 3.5 Flash Lite** (via `/api/understand` and n8n sidecar webhook `Tq1UTgrin8HYd9s6`).
   - Translates multilingual freeform utterances (English, French, Moroccan Darija, Modern Standard Arabic, German) and photos of medicine packs/symptoms into standard screen values.
   - Strictly bounded: only returns options already present on the current screen.

---

## 2. Enhanced Symptom Checker with Gemini

### 2.1 Scope & Boundaries
- **Natural Language Symptom Understanding:**
  - Users can describe complex, ambiguous, or multiple symptoms in their own words or via camera (e.g., *"I have had a throbbing pain behind my eyes and feeling hot since yesterday, but also a bit of nausea"*).
  - Gemini parses the input, maps it to candidate complaint categories, and identifies if essential context was already volunteered (e.g., duration, severity, age).
- **Generating Relevant Follow-Up Questions:**
  - If a symptom description is vague or bridges multiple pathways (e.g., *"I feel sick and feverish"*), Gemini generates a clinically relevant, objective clarification question (e.g., *"Is your primary concern the fever and body aches, or stomach discomfort and nausea?"*).
  - This follow-up question is presented directly to the user to disambiguate the complaint category before entering the structured safety screening.
- **Safety Invariants & Emergency Separation:**
  - **Emergency detection remains 100% independent:** Deterministic regex in [`web/question-intent.js`](file:///v:/LD%20Projects/PILLPALMEDVEN/web/question-intent.js) catches life-threatening keywords (chest pain, breathlessness, coughing blood, stroke signs) locally before any model is invoked. If triggered, `triggerEmergencyNotice()` immediately refers to emergency care (112, 15, 911).
  - **No Diagnosis or Prescription:** Gemini is forbidden from diagnosing diseases (e.g. diagnosing "gastroenteritis" or "migraine") or prescribing medicines. It solely identifies symptom complaint categories (`pain_fever`, `cold_cough`, `allergy`, etc.) and guides the customer into the validated safety checklist.

---

## 3. Technical Integration Plan

### 3.1 Backend & Sidecar Schema Updates (`web/answer-understanding.js` & `n8n/understand-workflow.mjs`)
1. Extend `SYSTEM_PROMPT` in `web/answer-understanding.js`:
   - Add instruction to return `possible_categories` and `follow_up_question` when user symptoms are ambiguous or incomplete.
   - Add instruction to extract volunteered context (`volunteered_context: { age, duration, severity }`) without skipping formal safety questions.
2. Update `validateModelAnswer`:
   - Validate and surface `follow_up_question` and `possible_categories` in the response payload.
3. Rebuild and deploy the n8n sidecar workflow (`npm run build:sidecar` and `node scripts/n8n-api.mjs push Tq1UTgrin8HYd9s6 ...`).

### 3.2 Frontend Kiosk Controller Updates (`web/app.js`)
1. Handle `follow_up_question`:
   - If user describes an ambiguous symptom on the `symptom` step, display Gemini's clarification question in the chat transcript and speak it via TTS, letting the user clarify before committing to a pathway.
2. Maintain smooth transition through the safety steps: `age` $\rightarrow$ `duration` $\rightarrow$ `severity` $\rightarrow$ `warning_signs` $\rightarrow$ `pregnancy_breastfeeding` $\rightarrow$ `allergy_status` $\rightarrow$ `medication_status` $\rightarrow$ `condition_status` $\rightarrow$ `confirm`.

---

## 4. UI Color Palette Harmonization (Figma Design Tokens)

Per Figma design files (`docs/design/*.figma.html`):
- **Base Background:** `#090B0B` (Teal-tinted deep obsidian black)
- **Panel / Sidebar Background:** `#151919` (Dark slate container)
- **Card / Surface Background:** `#232929` (Muted teal slate card container)
- **Card Hover / Active:** `#303939`
- **Border / Divider:** `#374040` / `#3A4545`
- **Accent Primary (Medical Green):** `#00D27A` (`rgba(0, 210, 122, 1)`)
- **Accent Secondary (Gold):** `#D4AF37`
- **Text Primary:** `#FFFFFF`
- **Text Muted:** `#B9C0C0`
- **Text Subtle:** `#929C9C`
- **Font Family:** `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

---

## 5. Verification & Test Plan

1. **Normal Symptoms:** Single and combined symptom inquiries in EN, FR, AR, DE.
2. **Incomplete / Ambiguous Inputs:** Vague symptoms generating follow-up questions.
3. **Emergency Symptoms:** Life-threatening red flags immediately routed to emergency referral with zero LLM bypass.
4. **Safety Scenarios:** Under-18, pregnancy, severe symptoms, allergy conflicts, contraindication conflicts strictly blocked by deterministic engine.
5. **Regression & Drift:** Run `npm test`, `npm run test:journeys`, `npm run test:product-path`, and `npm run test:ai:sidecar`.

---

## 6. Execution & Verification Results (2026-11-04)

All tests were executed against local suites and production n8n workflows (`CtomsWyOIBEuYrtX` and `Tq1UTgrin8HYd9s6`):

| Test Suite | Command | Result | Notes |
|---|---|---|---|
| Deterministic Engine Tests | `node scripts/test-n8n-engine.mjs` | **PASSED** | Validates all state-machine transitions and red flag logic |
| AI Understanding Unit Suite | `node scripts/test-answer-understanding.mjs` | **PASSED** | Multimodal images, candidate categories, follow-up questions, volunteered context |
| Spoken Answer Sidecar Suite | `node scripts/test-understand-sidecar.mjs` | **PASSED** | Node code generation and sanitisation |
| i18n Localization Parity | `node scripts/test-i18n.mjs` | **PASSED** | 100% EN & DE key parity |
| Voice Answer Mapper | `node scripts/test-voice-mapper.mjs` | **PASSED** | Spoken phrase mapping onto screen choices |
| Workflow Drift Verification | `node scripts/check-workflow-drift.mjs` | **PASSED** | Zero drift between repository and workflow JSON |
| Customer Journey Suite | `npm run test:journeys` | **53 / 53 PASSED** | Complete customer journey coverage (normal, under-18, pregnant, warning flags, allergies) |
| Live Product Path Webhook | `npm run test:product-path` | **PASSED** | Live product recommendation and safety blocking against n8n |
| Live Gemini Understanding Sidecar | `npm run test:ai:sidecar` | **12 / 12 PASSED** | Multi-lingual comprehension, symptom parsing, emergency triage refusal |

