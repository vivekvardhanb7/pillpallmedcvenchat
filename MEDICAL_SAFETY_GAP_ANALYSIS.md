# MEDICAL_SAFETY_GAP_ANALYSIS.md

**Date:** 2026-11-05
**Scope:** compare the current deterministic safety engine with the safety
requirements in the master brief, and list what must be closed before any
customer-facing pilot.

**Clinical status:** this is an engineering gap analysis. It is not a clinical
validation and does not claim that any rule is clinically correct.

---

## 1. Current safety architecture

```
customer answer
  -> engine validates question id and sanitises state
  -> deterministic gates (early refusal where possible)
       unsupported pathway
       age < 18
       duration > 7 days
       severity = severe
       red flag = yes / not sure
       pregnancy / breastfeeding / prefer not to say
       allergy / medicine / condition = not sure
  -> confirmation screen
  -> catalogue matcher
       age range
       maximum_duration_days
       allergy terms
       contraindication terms
       interaction terms
       approved dose present
  -> PRODUCT_ELIGIBLE or a differentiated refusal
  -> dispense_authorized: false
```

The LLM is not in this path. The optional understanding layer only maps a
transcript onto an option already on screen; the customer confirms it. That
boundary is correct and must be preserved.

---

## 2. What is already safe by design

| Control | Assessment |
|---|---|
| No LLM eligibility or dispensing | Strong; enforced by architecture and tests |
| `dispense_authorized: false` everywhere | Strong |
| Under-18 refusal | Strong, though the cut-off is a policy choice |
| > 7-day and severe refusal | Strong |
| Red-flag refusal for `pain_fever` | Good content, but not clinically signed off |
| Pregnancy/breastfeeding blanket referral | Conservative and safe, but over-refers |
| "Not sure" on history → referral | Correct fail-closed behaviour |
| Question/state tamper resistance | Strong |
| Catalogue read failure → no product | Strong |
| Matcher conservative substring matching | Safe direction, but imprecise |
| Anonymous outcome log | Good privacy design |

---

## 3. Gaps, by severity

### P0 — must fix before any customer-facing use

| ID | Gap | Evidence | Required action |
|---|---|---|---|
| S1 | Synthetic fixture is enabled and can be returned as a product | Live probe returned `PRODUCT_ELIGIBLE` / `TEST FIXTURE PRODUCT` | Disable it; add a database/audit guard that rejects any fixture or placeholder SKU with `chatbot_enabled = true` |
| S2 | 15 enabled rows display `demo ...` allergy terms | Live product data; DOLIPRANE screen | Replace with sourced ingredient terms or disable the rows |
| S3 | Rows marked `approved` carry reviewer strings saying they are not an approval | Live probe: "Synthetic demo data - NOT clinical approval" | Treat these rows as drafts; separate demo provenance from clinical approval; require a named human reviewer |
| S4 | Real brand names/prices on synthetic rows | `update-actual-medicines.mjs` vs migration `008` | Decide: keep `ZZ` explicitly synthetic, or create a separate reviewed catalogue. Never mix |
| S5 | The catalogue audit reports "no blockers" for the above | `npm run audit:catalog` output | Extend the audit to check provenance, reviewer identity, placeholder terms, `example.invalid`, and fixture SKUs |

### P1 — must fix before a clinical pilot

| ID | Gap | Consequence | Required action |
|---|---|---|---|
| S6 | No duplicate-active-ingredient check | A customer taking a paracetamol cold product could be offered paracetamol again | Normalise ingredients and compare across the current-medicine list and the candidate product |
| S7 | No cumulative dose / interval enforcement | The screen may show a real dose without checking the customer's other products or reported intake | Add structured dose rules: max daily amount, minimum interval, max doses/24 h; apply only from approved label data |
| S8 | Interaction rules are free-text substrings | Broad terms ("blood thinners") over-block; brand names and misspellings under-block | Coded ingredient/medicine mapping, severity levels, and a curated interaction table |
| S9 | Contraindications are free-text substrings | Conditions such as "kidney disease" may not match "severe kidney disease" or vice versa | Coded condition concepts with synonyms and severity |
| S10 | Red flags exist only for `pain_fever` | If another pathway is enabled without its own list, generic text may miss emergencies | Require a clinician-approved red-flag set per pathway before enabling it |
| S11 | No recall / regulatory-alert check | A withdrawn product could remain recommendable | Add `regulatory_alerts` and a hard block; manual check while no feed exists |
| S12 | `maximum_duration_days` NULL passes any duration | Five draft MA rows have NULL | Make the field mandatory for enabled products; fail closed when missing |
| S13 | Product safety text is English-only | A German/French/Arabic customer may not understand warnings | Language strategy: approved translations per product, or show only the verified English label with a clear language notice and require staff assistance |
| S14 | No pharmacist review or human escalation | Uncertain cases end at a referral screen with no follow-through | Add a review queue / contact hand-off and record the referral |
| S15 | Red-flag and rule content has no named clinical sign-off | Unknown whether the thresholds are correct | Versioned clinical approval per rule and pathway |

### P2 — important but not immediately blocking

| ID | Gap | Required action |
|---|---|---|
| S16 | Pregnancy is a blanket refusal | Review pathway/product-specific policy (some products are acceptable in pregnancy); keep conservative until signed off |
| S17 | Age upper bound comes only from product data | Add explicit adult/elderly policy and renal considerations |
| S18 | No adverse-event capture | Add an optional "report a problem" flow and a retention/legal position |
| S19 | No rule versioning in the response/log | Store engine version, catalogue version and rule set id |
| S20 | No structured "not asked" provenance in the log | Log which safety fields were answered vs skipped (without free text) |
| S21 | Emergency notice is generic | Configure local emergency numbers, kiosk location and a call action |
| S22 | No clinical audit sampling | Add a periodic review of logged outcomes and refusals |

---

## 4. Fail-closed rules to preserve

1. Unknown is not absent. If a required safety field is unknown, do not
   recommend.
2. Catalogue failure means no product, never a cached or guessed product.
3. A model may not add, remove or reorder a safety gate.
4. A model may not select a product or dose.
5. A product is not equivalent because the name or text looks similar.
6. International approval is not Moroccan approval.
7. Dispensing stays `false` until a separate hardware and regulatory review.

---

## 5. Minimum controls before a pilot

- [ ] Purge or disable all fixture/demo rows in any customer-reachable country.
- [ ] Require named clinical and legal reviewers per product and per pathway.
- [ ] Replace free-text conflict terms with coded ingredients/conditions plus
      synonyms.
- [ ] Implement duplicate-ingredient and cumulative-dose checks.
- [ ] Add recall/alert blocking and a re-verification interval.
- [ ] Make `maximum_duration_days` mandatory for enabled products.
- [ ] Add a pharmacist review/escalation path.
- [ ] Decide the language policy for product warnings.
- [ ] Clinically sign off every red-flag list and threshold.
- [ ] Add test cases for each new rule, including fail-closed behaviour.

---

## 6. Test plan additions

| Area | New tests |
|---|---|
| Data integrity | No fixture/demo/placeholder row can be enabled; every enabled row has a named reviewer, source URL and max duration |
| Duplicate ingredient | Paracetamol in a cold product + paracetamol candidate → block |
| Dose | Max daily dose, interval, doses/24 h, paediatric weight |
| Interactions | Brand-name and misspelling variants; severity levels |
| Contraindications | Synonym and severity variants; renal/hepatic |
| Red flags | One test per pathway, including "not sure" |
| Recalls | Withdrawn product → hard block with audit reason |
| Language | Warning shown in the customer's language or explicit notice |
| Model boundary | Model returns an option not on screen → rejected; low confidence → ask again |

---

## 7. Honest conclusion

The deterministic core is a good foundation and is materially safer than an
LLM-driven chatbot. It is **not** yet a clinically validated decision-support
system. The largest immediate risk is not a missing rule; it is that the live
demo catalogue presents synthetic records as approved medicines. That must be
fixed before any other safety work is claimed.
