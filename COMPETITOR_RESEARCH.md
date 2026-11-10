# COMPETITOR_RESEARCH.md — Phase 0 baseline

**Date:** 2026-11-05
**Status:** preliminary. This document separates what was verified in earlier
project research from what still needs first-party verification in Phase 1.

**Evidence labels**

- **[V]** verified from an official page, API documentation or paper cited in
  this repository's earlier research.
- **[R]** vendor/repository claim, not independently tested.
- **[?]** not verified; Phase 1 task.

The purpose is architectural learning, not copying. No proprietary
implementation, prompt or dataset should be reproduced.

---

## 1. What the market actually demonstrates

| Product | Documented interaction | Safety / scope | Relevance to PILLPAL |
|---|---|---|---|
| **Ada Health** [V] | Adaptive symptom interview; user profile and history feed expert-curated probabilistic reasoning; possible causes and care navigation | States it is not a treatment service or diagnosis; consumer app described as EU Class IIa; safety-netting included | Best reference for adaptive question selection and explicit uncertainty. Not an OTC vending authority |
| **Infermedica** [V] | API accepts symptoms, risk factors and demographics; asks follow-up questions; returns conditions and triage level using statistical inference | API documentation says it is not intended for diagnosis or treatment; proprietary SaaS | Reference for structured evidence collection and triage levels. Licensing, data residency and local clinical validation required |
| **K Health** [V/R] | AI intake plus a clinician who reviews a candidate diagnosis and plan | Physician-directed treatment, not autonomous OTC selection | Shows the human-in-the-loop pattern PILLPAL currently lacks |
| **Buoy Health** [V/R] | AI-guided interview followed by care navigation | Proprietary model and question logic | Reference for natural intake and referral routing |
| **Mediktor** [V/R] | Free-text symptoms, successive questions, care-level guidance; NLP/ML plus an LLM layer | Triage-oriented; not an OTC product selector | Reference for hybrid NLP + structured triage |
| **OneDose** [?] | Vendor describes pharmacy AI agents, voice workflows and medication management | Not verified first-party in this phase | Potential reference for pharmacy workflow and escalation; verify before citing |
| **Pharmacy1st.ai** [?] | Vendor describes AI pharmacy consultations and pharmacist review | Not verified first-party in this phase | Potential reference for pharmacist review; verify before citing |

### Lessons that are safe to adopt

1. **Adaptive questioning** beats a fixed script, but the question set must be
   clinician-authored and bounded.
2. **Triage and product selection are different decisions.** A triage level does
   not authorise a medicine.
3. **Uncertainty must be visible.** "Unknown" is not "absent".
4. **Human escalation is part of the product**, not an error path.
5. **A model may extract facts and phrase explanations; it must not be the
   authority for eligibility or dispensing.**

### Claims PILLPAL must not make

- No diagnosis claim.
- No "clinically validated" claim without a named clinical reviewer and evidence.
- No claim of equivalence between products based on name or text similarity.
- No claim that a Moroccan product is approved because an international product
  with the same ingredient is approved.

---

## 2. Vending and pharmacy-automation comparators

| System | Documented model | Gap relative to PILLPAL |
|---|---|---|
| InstyMeds [V/R] | Automated dispensing of prescribed medicines at a point of care | Requires a valid prescription; not symptom-to-OTC selection |
| Asteres ScriptCenter [V/R] | Secure pickup of pharmacy-filled prescriptions and OTC items | Pharmacy retains clinical and filling control |
| MedAvail MedCenter [V/R] | Self-service kiosk with pharmacy management and pharmacist support (historical SEC filing) | Historical; not proof of current operation; no autonomous symptom-to-product path established |
| BD Pyxis MedFlex / Omnicell XT [V/R] | Staff-facing automated dispensing cabinets | Clinical staff workflow, not public symptom triage |
| VendRx [R] | Partner pharmacy verifies medicines for secure release | Verified-prescription workflow |
| Terraform / BVC / Cloudspital / RAHA [R] | Indian vendors advertising medicine vending or health kiosks | Symptom-based selection, pharmacist supervision and site legality not established |
| HERMES (arXiv 2504.13880) [V] | Research kiosk for personalised OTC recommendations; survey of 10 professionals | Preprint and small survey do not establish real-world safety, legality or dispensing reliability |

**Conclusion:** the combination of structured symptom assessment, a verified
medicine catalogue and a physical vending unit is not unique. The defensible
part of PILLPAL is the **deterministic, auditable safety gate and the
country-specific data discipline**, not the chatbot surface.

---

## 3. Open-source components

| Component | What it is | Offline fit | Licence / caveat | Role in PILLPAL |
|---|---|---|---|---|
| **MedGemma** [V/R] | Google medical vision-language models (4B and 27B variants) | 4B may fit a quantised CPU run; 27B does not fit 8 GB | Google Health / Gemma terms; not a validated clinical authority | Research candidate for language understanding only, not decisions |
| **BioMistral** [R] | Mistral-based biomedical model (7B) | Quantised ~4–5 GB; CPU latency high | Model licence must be checked per variant | Possible understanding/explanation model; requires benchmark |
| **Meditron** [R] | Llama-based medical model (7B/70B) | 7B quantised possible; 70B not | Llama licence and medical-use caveats | Research only |
| **OpenBioLLM** [R] | Llama-based biomedical model (8B) | Quantised possible; CPU slow | Licence and intended-use review | Research only |
| **Qwen3 1.7B / 4B** [V] | General instruction models | 1.7B fits; measured failure on multilingual safety answers; 4B exceeded latency | Apache-2.0 family (verify variant) | Already evaluated and rejected for intake |
| **Whisper / whisper.cpp** [V] | Multilingual ASR | `ggml-base` works offline; ~2.5 s per clean sentence; `small` ~11.3 s | MIT (whisper.cpp) / model licences | **Current local STT** |
| **Qwen3-ASR** [?] | ASR family | Unknown on this hardware | Verify licence and model size | Phase 2 benchmark candidate |
| **SeamlessM4T** [?] | Speech translation / transcription | Large; likely too heavy for 8 GB | Licence review | Phase 2 research only |
| **Piper** [V] | Local neural TTS | **Current local TTS**; English female voice installed; ~0.03 s cached | MIT / voice model licences | **Keep** |
| **Kokoro** [?] | Lightweight neural TTS | Potential CPU fit | Licence/voice availability | Phase 2 comparison |
| **FAISS / ChromaDB** [?] | Vector search | Fits; not currently used | BSD / Apache-family (verify) | Only if a local RAG corpus is added |
| **Ollama / llama.cpp** [V] | Local model runtime | Ollama installed and evaluated; llama.cpp available | MIT / model licences | Optional understanding runtime; never decision authority |
| **LangGraph / FastAPI / pgvector** [?] | Service orchestration / API / vector search | Python stack not present today | Open licences | Could support a future local service layer, but would add a runtime the project deliberately avoided |

No Vapi integration exists or is planned; it would duplicate working local
transcription and TTS.

---

## 4. Architectural comparison

| Capability | Ada / Infermedica class | Pure LLM chatbot | PILLPAL today | PILLPAL target |
|---|---|---|---|---|
| Adaptive interview | Yes | Unstructured | Fixed deterministic steps | Deterministic steps + bounded adaptive clarification |
| Red-flag routing | Clinician-curated | Model-dependent | Curated `pain_fever` list | Curated list per supported pathway |
| Product eligibility | Not their scope | Model-generated (unsafe) | Deterministic matcher | Deterministic matcher + alternatives engine |
| Regulatory traceability | Varies | None | Status + source URL fields | Versioned source registry |
| Offline | No | Depends on model | Voice only | **Full core offline** |
| Human escalation | Referral / clinician | None | Referral text | Referral + review queue |
| Dispensing authority | Never | Sometimes (unsafe) | Always false | Always false until hardware review |

---

## 5. Phase 1 work still to do

1. Verify OneDose and Pharmacy1st.ai first-party pages (features, workflow,
   regulatory posture); record date and URL.
2. Read current Infermedica and Ada developer documentation for question
   selection, evidence models and API limits.
3. Review MedGemma model card and licence for intended-use restrictions.
4. Benchmark Qwen3-ASR, SeamlessM4T and Kokoro on the reference laptop before
   considering them.
5. Check licences and redistribution terms for any dataset proposed in
   `MEDICAL_DATA_SOURCE_RESEARCH.md`.
6. Record every claim as [V], [R] or [?] so later documents do not inherit
   marketing language as fact.
