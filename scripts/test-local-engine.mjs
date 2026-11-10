/**
 * scripts/test-local-engine.mjs
 * Comprehensive unit and integration test for the 100% offline local engine.
 */
import assert from 'node:assert/strict';
import { processChatTurn, searchCatalog, findAlternatives, validateCombination } from '../web/local-engine.mjs';

console.log('Testing Local Offline Clinical Triage & Medicine Engine...');

// 1. Initial turn
let turn = await processChatTurn({ reset: true, session_id: 'test_offline_001', country_code: 'MA' });
assert.equal(turn.screen.question_id, 'symptom');
console.log('- Initial symptom screen verified');

// 2. An unsigned research snapshot must never approve a real medicine.
function step(prev, val) {
  return processChatTurn({
    session_id: prev.session_id,
    country_code: 'MA',
    language_code: 'en',
    state: prev.state,
    answer: { question_id: prev.screen.question_id, value: val }
  });
}

turn = await step(turn, 'pain_fever');
assert.equal(turn.screen.question_id, 'age');
turn = await step(turn, 28);
assert.equal(turn.screen.question_id, 'duration');
turn = await step(turn, 'today');
assert.equal(turn.screen.question_id, 'severity');
turn = await step(turn, 'mild');
assert.equal(turn.screen.question_id, 'warning_signs');
turn = await step(turn, 'no');
assert.equal(turn.screen.question_id, 'safety_background_status');
turn = await step(turn, 'none');
assert.equal(turn.screen.question_id, 'confirm');

// Confirm -> matches catalog
const match = await step(turn, 'yes');
assert.equal(match.outcome, 'NO_SUITABLE_PRODUCT');
assert.equal(match.product, null);
assert.equal(match.dispense_authorized, false);
console.log('- Unsigned reference catalogue cannot approve a medicine');

// 3. Early refusal on under-18
let underAgeTurn = await processChatTurn({ reset: true, session_id: 'test_underage' });
underAgeTurn = await step(underAgeTurn, 'pain_fever');
underAgeTurn = await step(underAgeTurn, 15);
assert.equal(underAgeTurn.outcome, 'CLINIC_REFERRAL');
assert.ok(underAgeTurn.reason_codes.includes('under_18'));
console.log('- Under-18 refusal correctly enforced at question 2');

// 4. Early refusal on red flags
let redFlagTurn = await processChatTurn({ reset: true, session_id: 'test_redflag' });
redFlagTurn = await step(redFlagTurn, 'pain_fever');
redFlagTurn = await step(redFlagTurn, 35);
redFlagTurn = await step(redFlagTurn, 'today');
redFlagTurn = await step(redFlagTurn, 'mild');
redFlagTurn = await step(redFlagTurn, 'yes');
assert.equal(redFlagTurn.outcome, 'IMMEDIATE_MEDICAL_CARE');
assert.ok(redFlagTurn.reason_codes.includes('warning_sign_reported'));
console.log('- Emergency red flag triggers IMMEDIATE_MEDICAL_CARE immediately');

// 5. Broader Catalogue Search
const allSearch = await searchCatalog({ query: 'paracetamol' });
assert.ok(allSearch.total >= 3, 'Should find multiple paracetamol formulations across jurisdictions');
console.log(`- Catalogue search found ${allSearch.total} paracetamol products across catalogues`);

const vendingSearch = await searchCatalog({ query: 'doliprane' });
assert.ok(vendingSearch.results[0].vending.in_stock, 'Doliprane should be in physical vending inventory');
assert.equal(vendingSearch.results[0].vending.slot, 1);
console.log('- Physical vending machine slot allocation verified (Slot 1: Doliprane 500mg)');

// 6. Unvalidated mappings are never returned as safe alternatives.
const panadolAlt = await findAlternatives('INT-PANADOL-500');
assert.deepEqual(panadolAlt.alternatives, []);
assert.equal(panadolAlt.reason, 'pharmacist_review_required');
assert.equal(panadolAlt.recommendation_authorized, false);
console.log('- Unvalidated alternative mappings require pharmacist review');

// 7. Combination Validation & Duplicate Ingredient Guard
const combiflamCheck = await validateCombination('IN-COMBIFLAM', ['paracetamol cold sachet'], []);
assert.equal(combiflamCheck.blocked, true);
assert.equal(combiflamCheck.reason, 'duplicate_active_ingredient');
console.log('- Duplicate active ingredient blocked for multi-drug candidate');

const withdrawnCheck = await validateCombination('MA-ACTIFED-RHUME', [], []);
assert.equal(withdrawnCheck.blocked, true);
assert.equal(withdrawnCheck.reason, 'regulatory_alert_withdrawn');
console.log('- Withdrawn AMMPS product correctly blocked');

const aliasAllergy = await validateCombination('MA-DOLIPRANE-500-EFF', [], ['acetaminophen']);
assert.equal(aliasAllergy.reason, 'allergy_conflict');
assert.equal(aliasAllergy.valid, false);
const unknown = await validateCombination('MA-DOLIPRANE-500-EFF', ['unknown tablet'], []);
assert.equal(unknown.valid, false);
assert.equal((await validateCombination('MA-DOLIPRANE-500-EFF', 'panadol', [])).reason, 'invalid_medication_history');
console.log('Local reference, safety and fail-closed tests passed.');
