import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const intakeSource = await readFile(resolve('n8n/src/intake-and-safety-engine.js'), 'utf8');
const catalogSource = await readFile(resolve('n8n/src/catalog-decision.js'), 'utf8');
const runIntakeCode = new Function('$input', intakeSource);
const runCatalogCode = new Function('$input', '$', catalogSource);

function inputFor(body) {
  return { first: () => ({ json: { body } }) };
}

function intake(body) {
  return runIntakeCode(inputFor(body))[0].json;
}

function answer(previous, value) {
  return intake({
    session_id: previous.session_id,
    country_code: 'MA',
    language_code: 'en',
    state: previous.state,
    answer: { question_id: previous.screen.question_id, value },
  });
}

let turn = intake({ reset: true, session_id: 'test_session_001' });
assert.equal(turn.screen.question_id, 'symptom');
turn = answer(turn, 'pain_fever');
turn = answer(turn, 30);
turn = answer(turn, 'today');
turn = answer(turn, 'mild');
turn = answer(turn, 'no');
turn = answer(turn, 'not_applicable');
turn = answer(turn, 'no');
turn = answer(turn, 'no');
turn = answer(turn, 'no');
assert.equal(turn.screen.question_id, 'confirm');
const catalogRequest = answer(turn, 'yes');
assert.equal(catalogRequest.needs_catalog, true);

// A refusal now stops the customer at the question that disqualified them,
// instead of making them answer the whole questionnaire first.
const earlyExitCases = [
  { answers: ['other'], outcome: 'NO_SUITABLE_PRODUCT', reason: 'unsupported_pathway' },
  { answers: ['pain_fever', 30, 'more_than_7_days'], outcome: 'CLINIC_REFERRAL', reason: 'duration_outside_pathway' },
  { answers: ['pain_fever', 30, 'today', 'severe'], outcome: 'CLINIC_REFERRAL', reason: 'severe_symptom' },
  { answers: ['pain_fever', 30, 'today', 'mild', 'no', 'pregnant'], outcome: 'CLINIC_REFERRAL', reason: 'pregnancy_breastfeeding_or_uncertain' },
  { answers: ['pain_fever', 30, 'today', 'mild', 'no', 'not_applicable', 'not_sure'], outcome: 'CLINIC_REFERRAL', reason: 'medical_history_uncertain' },
];
for (const testCase of earlyExitCases) {
  let step = intake({ reset: true, session_id: `early_${Math.random().toString(36).slice(2, 8)}` });
  for (const value of testCase.answers) step = answer(step, value);
  assert.equal(step.outcome, testCase.outcome, JSON.stringify(testCase.answers));
  assert.ok(step.reason_codes.includes(testCase.reason), JSON.stringify(step.reason_codes));
  assert.equal(step.screen.question_id, 'complete');
  assert.equal(step.turns, testCase.answers.length);
}

// Questions that were never reached must not be reported as answered.
const shortSummary = (() => {
  let step = intake({ reset: true, session_id: 'summary_check_0001' });
  step = answer(step, 'pain_fever');
  return answer(step, 12).summary;
})();
assert.equal(shortSummary.warning_signs, 'Not asked');
assert.equal(shortSummary.allergies, 'Not asked');
assert.equal(shortSummary.age, 12);

const approvedProduct = {
  id: '00000000-0000-0000-0000-000000000001',
  country_code: 'MA',
  language_code: 'en',
  pathway_code: 'pain_fever',
  display_priority: 10,
  sku: 'TEST-PARACETAMOL',
  product_name: 'Approved Test Product',
  active_ingredients: [{ name: 'test ingredient', strength: '500', unit: 'mg' }],
  strength_label: '500 mg',
  dosage_form: 'tablet',
  minimum_age_months: 216,
  maximum_age_years: 65,
  allergy_terms: ['test ingredient'],
  contraindications: ['example condition'],
  interaction_rules: ['example interacting medicine'],
  dose_instructions: { display_text: 'Use only the clinically approved local label instructions.' },
  warnings: ['Research test product only'],
  product_version: 1,
  safety_version: 1,
};

const catalogInput = { first: () => ({ json: { statusCode: 200, body: [approvedProduct] } }) };
const nodeLookup = name => ({
  first: () => {
    assert.equal(name, 'Intake and Safety Engine');
    return { json: catalogRequest };
  },
});
const catalogResult = runCatalogCode(catalogInput, nodeLookup)[0].json;
assert.equal(catalogResult.outcome, 'PRODUCT_ELIGIBLE');
assert.equal(catalogResult.product.name, 'Approved Test Product');
assert.equal(catalogResult.dispense_authorized, false);

// Native Supabase node input format ($input.all())
const nativeSupabaseInput = {
  all: () => [{ json: approvedProduct }],
  first: () => ({ json: approvedProduct }),
};
const nativeResult = runCatalogCode(nativeSupabaseInput, nodeLookup)[0].json;
assert.equal(nativeResult.outcome, 'PRODUCT_ELIGIBLE');
assert.equal(nativeResult.product.name, 'Approved Test Product');

// Native Supabase empty return (alwaysOutputData: true)
const nativeEmptyInput = {
  all: () => [{ json: {} }],
  first: () => ({ json: {} }),
};
const nativeEmptyResult = runCatalogCode(nativeEmptyInput, nodeLookup)[0].json;
assert.equal(nativeEmptyResult.outcome, 'NO_SUITABLE_PRODUCT');
assert.ok(nativeEmptyResult.reason_codes.includes('no_approved_product_for_pathway'));

function catalogState(overrides = {}) {
  return { ...structuredClone(catalogRequest.state), ...overrides };
}

function runCatalog(state, rows, extra = {}) {
  const input = { first: () => ({ json: { statusCode: 200, body: rows, ...extra } }) };
  const lookup = () => ({ first: () => ({ json: { ...catalogRequest, state } }) });
  return runCatalogCode(input, lookup)[0].json;
}

function blockedReasons(result) {
  assert.equal(result.outcome, 'NO_SUITABLE_PRODUCT');
  assert.equal(result.dispense_authorized, false);
  assert.ok(result.reason_codes.includes('all_products_blocked'));
  return result.system_detail[0].reasons;
}

assert.equal(runCatalog(catalogState(), [approvedProduct]).screen.type, 'product_result');

const allergyBlock = runCatalog(catalogState({ allergy_terms: ['test ingredient'] }), [approvedProduct]);
assert.ok(blockedReasons(allergyBlock).includes('allergy_conflict'));

const conditionBlock = runCatalog(catalogState({ condition_terms: ['example condition'] }), [approvedProduct]);
assert.ok(blockedReasons(conditionBlock).includes('contraindication_conflict'));

const interactionBlock = runCatalog(catalogState({ medication_terms: ['example interacting medicine'] }), [approvedProduct]);
assert.ok(blockedReasons(interactionBlock).includes('medicine_interaction_conflict'));

const underAgeBlock = runCatalog(catalogState({ age_years: 10 }), [approvedProduct]);
assert.ok(blockedReasons(underAgeBlock).includes('below_minimum_age'));
assert.ok(underAgeBlock.reason_codes.includes('age_outside_supported_range'));
assert.match(underAgeBlock.message, /different age range/);

const agePlusAllergyBlock = runCatalog(catalogState({ age_years: 10, allergy_terms: ['test ingredient'] }), [approvedProduct]);
assert.ok(blockedReasons(agePlusAllergyBlock).includes('below_minimum_age'));
assert.ok(!agePlusAllergyBlock.reason_codes.includes('age_outside_supported_range'));
assert.equal(agePlusAllergyBlock.reason_codes[0], 'all_products_blocked');

const foreignLanguageCatalog = runCatalog(catalogState(), [{ ...approvedProduct, language_code: 'de' }]);
assert.equal(foreignLanguageCatalog.outcome, 'NO_SUITABLE_PRODUCT');
assert.ok(foreignLanguageCatalog.reason_codes.includes('no_approved_product_for_pathway'));

const matchingLanguageCatalog = runCatalog(catalogState(), [{ ...approvedProduct, language_code: 'en' }]);
assert.equal(matchingLanguageCatalog.outcome, 'PRODUCT_ELIGIBLE');

const overAgeBlock = runCatalog(catalogState({ age_years: 70 }), [approvedProduct]);
assert.ok(blockedReasons(overAgeBlock).includes('above_maximum_age'));

const missingDoseBlock = runCatalog(catalogState(), [{ ...approvedProduct, dose_instructions: {} }]);
assert.ok(blockedReasons(missingDoseBlock).includes('missing_approved_dose'));

const secondaryProduct = {
  ...approvedProduct,
  id: '00000000-0000-0000-0000-000000000002',
  sku: 'TEST-SECONDARY',
  product_name: 'Secondary Test Product',
  display_priority: 20,
};
const prioritySelection = runCatalog(catalogState(), [secondaryProduct, approvedProduct]);
assert.equal(prioritySelection.outcome, 'PRODUCT_ELIGIBLE');
assert.equal(prioritySelection.product.name, 'Approved Test Product');
assert.equal(prioritySelection.evaluated_products.length, 2);
assert.equal(
  prioritySelection.evaluated_products.find(item => item.product_id === secondaryProduct.id).result,
  'not_selected',
);

const catalogFailure = runCatalogCode(
  { first: () => ({ json: { error: { message: 'database offline' } } }) },
  nodeLookup,
)[0].json;
assert.equal(catalogFailure.outcome, 'NO_SUITABLE_PRODUCT');
assert.ok(catalogFailure.reason_codes.includes('catalog_unavailable'));
assert.equal(catalogFailure.system_detail, 'database offline');

const restFailure = runCatalog(catalogState(), [approvedProduct], { statusCode: 500 });
assert.ok(restFailure.reason_codes.includes('catalog_unavailable'));
assert.equal(restFailure.system_detail, 'Supabase REST status 500');

let urgent = intake({ reset: true, session_id: 'test_session_urgent' });
urgent = answer(urgent, 'pain_fever');
urgent = answer(urgent, 45);
urgent = answer(urgent, 'today');
urgent = answer(urgent, 'moderate');
urgent = answer(urgent, 'yes');
assert.equal(urgent.outcome, 'IMMEDIATE_MEDICAL_CARE');
assert.equal(urgent.needs_catalog, false);

let child = intake({ reset: true, session_id: 'test_session_child' });
child = answer(child, 'allergy');
child = answer(child, 12);
assert.equal(child.outcome, 'CLINIC_REFERRAL');
assert.ok(child.reason_codes.includes('under_18'));
assert.equal(child.state.completed, true);
assert.equal(child.screen.type, 'result');

let toddler = intake({ reset: true, session_id: 'test_session_toddler' });
toddler = answer(toddler, 'pain_fever');
toddler = answer(toddler, 5);
assert.equal(toddler.outcome, 'CLINIC_REFERRAL');
assert.ok(toddler.reason_codes.includes('under_18'));
assert.equal(toddler.state.step, 'complete');

console.log('All deterministic n8n engine tests passed.');

