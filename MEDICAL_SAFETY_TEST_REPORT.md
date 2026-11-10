# MEDICAL_SAFETY_TEST_REPORT.md — 18-Case Clinical Decision Support Verification

**Date:** 2026-11-05  
**Auditor:** Clinical Decision Support Engineer & Medical Officer  
**Scope:** Execution evidence for all 18 mandatory pharmaceutical safety test cases defined in Master Specification Section 16.B.

---

## 1. The 18-Case Pharmaceutical Test Suite

| Case ID | Scenario Description | Tested Entity | Expected Clinical Action | Test Result |
|---|---|---|---|---|
| **MED-01** | Medicine exists in vending machine inventory | `MA-DOLIPRANE-500-EFF` | Offer product in Slot 1 (14 in stock, 15.50 MAD) | **PASS (Slot 1 Matched)** |
| **MED-02** | Medicine unavailable in vending inventory | `MA-DOLIPRANE-1000-TAB` | Document as `CATALOGUE_ONLY`; offer local pharmacy directions | **PASS (Catalogue Flagged)** |
| **MED-03** | Medicine exists in Moroccan catalogue | `MA-BRUFEN-400` | Sourced from AMMPS; display Moroccan PPV price | **PASS (AMM Sourced)** |
| **MED-04** | Medicine found only in Indian catalogue | `IN-DOLO-650` | Sourced from CDSCO; separate INR price; note not Moroccan AMM | **PASS (Jurisdiction Isolated)** |
| **MED-05** | Medicine found only in international references | `INT-TYLENOL-500` | DailyMed reference; map to Moroccan INN (Paracetamol) | **PASS (International Isolated)** |
| **MED-06** | Medicine not found in any catalogue | `XYZ-NONEXISTENT-DRUG` | State clearly that medicine cannot be identified; refuse guessing | **PASS (Zero Hallucination)** |
| **MED-07** | Same active ingredient alternative (Level 1) | `INT-PANADOL-500` -> `MA-DOLIPRANE-500-EFF` | Direct equivalent matching identical 500mg strength and INN | **PASS (Level 1 Established)** |
| **MED-08** | Different strength alternative (Level 2) | `MA-DOLIPRANE-500` -> `MA-DOLIPRANE-1000` | Formulation variant with clear dosage explanation | **PASS (Level 2 Established)** |
| **MED-09** | Different formulation alternative (Level 2) | Effervescent solution vs film-coated tablet | Explain swallowing / water dissolution differences | **PASS (Level 2 Established)** |
| **MED-10** | Authorized fixed-dose combination | `IN-COMBIFLAM` (Ibuprofen + Paracetamol) | Validate ingredient ratio and indication | **PASS (Validated)** |
| **MED-11** | Unverified combination replacement | Separate Paracetamol + Ibuprofen to replace FDC | **Strictly blocked.** Multi-drug substitution prohibited | **PASS (Blocked)** |
| **MED-12** | Prescription-only medicine | `MA-CODOLIPRANE` (with Codeine) | **Blocked from OTC vending.** Direct to physician | **PASS (Blocked)** |
| **MED-13** | Withdrawn / Revoked medicine | `MA-ACTIFED-RHUME` | AMMPS withdrawal alert displayed; recommendation blocked | **PASS (Blocked with Alert)** |
| **MED-14** | Unknown regulatory status | Product with status `in_review` | Fail-closed: Cannot recommend without active AMM | **PASS (Fail-Closed)** |
| **MED-15** | Duplicate active ingredients | Patient taking Paracetamol sachet + candidate Doliprane | **Blocked immediately** (Overdose toxicity risk) | **PASS (Blocked)** |
| **MED-16** | Drug-Drug interaction conflict | Patient taking Warfarin + candidate Brufen (Ibuprofen) | **Blocked immediately** (Severe GI hemorrhage risk) | **PASS (Blocked)** |
| **MED-17** | Stated patient allergy conflict | Patient allergic to Paracetamol + candidate Doliprane | **Blocked immediately** (Anaphylaxis risk) | **PASS (Blocked)** |
| **MED-18** | No safe alternative established | Withdrawn drug with no verified OTC replacement | Level 4: Clear message to consult a licensed pharmacist | **PASS (Level 4 Enforced)** |

---

## 2. Clinical Conclusion

All 18 safety scenarios behave deterministically and fail-closed. No model hallucination or unverified clinical substitution occurred.
