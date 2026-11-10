# MEDICINE_ALTERNATIVE_ENGINE.md — Multi-Level Medicine Alternative Engine

**Date:** 2026-11-05  
**Audience:** Pharmaceutical Engineers, Clinical Pharmacists, Full-Stack Developers  
**Scope:** Specification of the 4-level medicine substitution classifier and search pipeline beyond vending inventory.

---

## 1. Core Principle: The Vending Machine is Not the Universe

A central capability of PILLPAL MedAssist is recognizing that the vending machine's 24 physical slots represent a tiny fraction of authorized medicines. When a user requests a medicine that is not physically stocked in the machine, the system:
1. Searches the broader Moroccan national drug formulary (AMMPS).
2. Distinguishes between physical stock vs. documented pharmacy availability.
3. Classifies potential therapeutic alternatives into 4 clinical levels.
4. Explains differences clearly without pressuring the user.

---

## 2. The Four Equivalence Levels

```
+─────────────────────────────────────────────────────────────────────────────+
│ LEVEL 1: DIRECT PHARMACEUTICAL EQUIVALENT                                    │
│ Same active ingredient(s), identical strength, same dosage form and route.  │
│ Example: Requested DOLIPRANE 500mg effervescent ->                          │
│          Alternative: PARAFEBRYL 500mg effervescent.                        │
│ Clinical Rule: Direct substitution permitted under standard bioequivalence. │
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│ LEVEL 2: FORMULATION / STRENGTH VARIANT                                      │
│ Same active ingredient, but different strength, dosage form, or release.    │
│ Example: Requested DOLIPRANE 500mg effervescent ->                          │
│          Alternative: DOLIPRANE 1000mg tablet (half tablet) OR 500mg caplet.│
│ Clinical Rule: Requires explanation of dosage splitting / swallowing change.│
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│ LEVEL 3: THERAPEUTIC CLASS ALTERNATIVE                                       │
│ Different active ingredient within the same therapeutic indication.         │
│ Example: Requested Paracetamol 500mg (out of stock) ->                      │
│          Alternative: Ibuprofen 400mg for headache.                         │
│ Clinical Rule: CANNOT substitute automatically! Must re-evaluate for NSAID  │
│                contraindications (peptic ulcer, asthma, renal, pregnancy).  │
+─────────────────────────────────────────────────────────────────────────────+
                                       │
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
│ LEVEL 4: NO VERIFIED SAFE ALTERNATIVE                                        │
│ No bioequivalent or suitable therapeutic alternative established.            │
│ Clinical Rule: State clearly: "No safe verified alternative could be        │
│                established. Please consult a pharmacist."                   │
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Alternative Dialogue Script

```
Customer: "Do you have Panadol?"
PILLPAL:  "I searched our vending machine, but Panadol is not currently stocked in 
           our trays. However, I checked our Moroccan medicine catalogue and found 
           an exact equivalent: DOLIPRANE 500 mg, which contains the identical active 
           ingredient, Paracetamol 500 mg.

           Would you like me to check whether Doliprane is in stock in this machine?"

Customer: "Yes, please."
PILLPAL:  "Doliprane 500 mg is physically available in Slot 3. Before I proceed, 
           do you have any liver conditions or take other paracetamol products?"
```

---

## 4. Pharmacy Stock Status Distinctions

1. **`IN_VENDING_MACHINE`**: Stocked and verified in kiosk tray; ready for dispensing workflow.
2. **`IN_CATALOGUE_NOT_IN_MACHINE`**: Officially authorized in Morocco; purchasable at retail pharmacies, but not in this machine.
3. **`WITHDRAWN_FROM_MARKET`**: Product registration revoked by AMMPS; system displays a regulatory warning and blocks recommendation.
4. **`INTERNATIONAL_ONLY`**: Found only in Indian or international references; not authorized in Morocco.
