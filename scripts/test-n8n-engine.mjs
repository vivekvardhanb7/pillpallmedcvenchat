import { loadEngineSource } from '../n8n/load-engine-source.mjs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const intakeSource = await readFile(resolve('n8n/src/intake-and-safety-engine.js'), 'utf8');
const catalogSource = await loadEngineSource(resolve('n8n/src/catalog-decision.js'));
const runIntakeCode = new Function('$input', intakeSource);
const runCatalogCode = new Function('$input', '$', catalogSource);

function inputFor(body) {
  return { first: () => ({ json: { body } }) };
}

function intake(body) {
  return runIntakeCode(inputFor(body))[0].json;
}

function answer(previous, value, countryCode = 'MA') {
  return intake({
    session_id: previous.session_id,
    country_code: countryCode,
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
turn = answer(turn, 'none');
assert.equal(turn.screen.question_id, 'confirm');
const catalogRequest = answer(turn, 'yes');
assert.equal(catalogRequest.needs_catalog, true);

// A refusal now stops the customer at the question that disqualified them,
// instead of making them answer the whole questionnaire first.
const earlyExitCases = [
  { answers: ['other'], outcome: 'NO_SUITABLE_PRODUCT', reason: 'unsupported_pathway' },
  { answers: ['pain_fever', 30, 'more_than_7_days'], outcome: 'CLINIC_REFERRAL', reason: 'duration_outside_pathway' },
  { answers: ['pain_fever', 30, 'today', 'severe'], outcome: 'CLINIC_REFERRAL', reason: 'severe_symptom' },
  { answers: ['pain_fever', 30, 'today', 'mild', 'no', 'pregnancy'], outcome: 'CLINIC_REFERRAL', reason: 'pregnancy_breastfeeding_or_uncertain' },
  { answers: ['pain_fever', 30, 'today', 'mild', 'no', 'not_sure'], outcome: 'CLINIC_REFERRAL', reason: 'medical_history_uncertain' },
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
  chatbot_enabled: true,
  market_status: 'commercialised',
  clinical_status: 'approved',
  legal_status: 'approved',
  review_status: 'approved',
  pathway_approval_status: 'approved',
  is_fixture: false,
  data_origin: 'reviewed',
  reviewer_name: 'Unit test reviewer (not clinical evidence)',
  reviewed_at: '2026-11-09T00:00:00Z',
  clinical_source_url: 'https://unit-tests.example/test-source',
  label_url: 'https://unit-tests.example/test-label',
  allowed_indications: ['pain_fever'],
  maximum_duration_days: 7,
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
  dose_instructions: { status: 'approved', display_text: 'Use only the clinically approved local label instructions.' },
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
assert.equal(foreignLanguageCatalog.outcome, 'PRODUCT_ELIGIBLE', 'UI language must not change medicine eligibility');

const matchingLanguageCatalog = runCatalog(catalogState(), [{ ...approvedProduct, language_code: 'en' }]);
assert.equal(matchingLanguageCatalog.outcome, 'PRODUCT_ELIGIBLE');

const overAgeBlock = runCatalog(catalogState({ age_years: 70 }), [approvedProduct]);
assert.ok(blockedReasons(overAgeBlock).includes('above_maximum_age'));

const missingDoseBlock = runCatalog(catalogState(), [{ ...approvedProduct, dose_instructions: {} }]);
assert.ok(blockedReasons(missingDoseBlock).includes('missing_approved_dose'));

// maximum_duration_days is a clinical limit, not a label detail. A product
// approved for three days of self-treatment must not be offered for a week of
// fever, because the medicine would mask whatever is keeping the fever up.
const withinDurationLimit = runCatalog(catalogState({ duration_code: 'today' }), [{ ...approvedProduct, maximum_duration_days: 3 }]);
assert.equal(withinDurationLimit.outcome, 'PRODUCT_ELIGIBLE');

const beyondDurationLimit = runCatalog(catalogState({ duration_code: '3_to_7_days' }), [{ ...approvedProduct, maximum_duration_days: 3 }]);
assert.ok(blockedReasons(beyondDurationLimit).includes('symptom_longer_than_product_allows'));
assert.equal(beyondDurationLimit.reason_codes[0], 'symptom_longer_than_product_allows', 'the specific reason must come first so the touchscreen shows it');
assert.match(beyondDurationLimit.message, /3 days/);

const durationPlusAllergy = runCatalog(
  catalogState({ duration_code: '3_to_7_days', allergy_terms: ['test ingredient'] }),
  [{ ...approvedProduct, maximum_duration_days: 3 }],
);
assert.equal(durationPlusAllergy.reason_codes[0], 'all_products_blocked', 'a mixed block must not claim the duration-only copy');
assert.ok(blockedReasons(durationPlusAllergy).includes('allergy_conflict'));

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
child = answer(child, 'pain_fever');
child = answer(child, 12);
assert.equal(child.outcome, 'CLINIC_REFERRAL');
assert.ok(child.reason_codes.includes('under_18'));
assert.equal(child.state.completed, true);
assert.equal(child.screen.type, 'result');

let scope = intake({ reset: true, session_id: 'test_session_scope' });
scope = answer(scope, 'cold_cough');
assert.equal(scope.outcome, 'NO_SUITABLE_PRODUCT', 'a category with no approved pathway must stop on the first tap');
assert.ok(scope.reason_codes.includes('pathway_not_serviced'));
assert.equal(scope.turns, 1);
assert.equal(scope.needs_catalog, false);
assert.equal(scope.state.pathway_code, 'cold_cough', 'the refused pathway is still recorded for the outcome log');
assert.equal(scope.summary.allergies, 'Not asked');

// Widening the menu is only safe where the catalogue is synthetic. Country ZZ is
// the reserved fixture, so every declared category is assessable there; a real
// country keeps exactly the signed-off scope, even if a client forges its state.
for (const pathway of ['cold_cough', 'allergy', 'diarrhoea', 'heartburn', 'skin_minor_wound']) {
  let demo = intake({ reset: true, session_id: `demo_${pathway}`, country_code: 'ZZ' });
  demo = answer(demo, pathway, 'ZZ');
  assert.equal(demo.screen.question_id, 'age', `${pathway} must stay assessable in the demo country`);
}

let realWalk = intake({ reset: true, session_id: 'test_session_forged_scope' });
realWalk = answer(realWalk, 'pain_fever');
realWalk = answer(realWalk, 30);
realWalk = answer(realWalk, 'today');
realWalk = answer(realWalk, 'mild');
realWalk = answer(realWalk, 'no');
realWalk = answer(realWalk, 'none');
const forged = intake({
  session_id: realWalk.session_id,
  country_code: 'MA',
  language_code: 'en',
  state: { ...realWalk.state, pathway_code: 'cold_cough' },
  answer: { question_id: 'confirm', value: 'yes' },
});
assert.equal(forged.needs_catalog, false, 'a forged state must not widen a real country scope');
assert.ok(forged.reason_codes.includes('pathway_not_serviced'), JSON.stringify(forged.reason_codes));

let flags = intake({ reset: true, session_id: 'test_session_flags' });
flags = answer(flags, 'pain_fever');
flags = answer(flags, 45);
flags = answer(flags, 'today');
flags = answer(flags, 'mild');
assert.match(flags.screen.subtitle, /stiff neck/i, 'fever screening must name meningitis features, not a generic list');
assert.match(flags.screen.subtitle, /does not fade when you press/i, 'non-blanching rash is the other tell a kiosk must not miss');
assert.doesNotMatch(flags.screen.subtitle, /general list is not a complete/i);

let toddler = intake({ reset: true, session_id: 'test_session_toddler' });
toddler = answer(toddler, 'pain_fever');
toddler = answer(toddler, 5);
assert.equal(toddler.outcome, 'CLINIC_REFERRAL');
assert.ok(toddler.reason_codes.includes('under_18'));
assert.equal(toddler.state.step, 'complete');

const outcomeSource = await readFile(resolve('n8n/src/outcome-log-payload.js'), 'utf8');
const runOutcomeCode = new Function('$input', outcomeSource);
const outcomeRow = response => runOutcomeCode({ first: () => ({ json: response }) })[0].json;

// kiosk_outcome_log has CHECK constraints (migration 007). A rejected insert is
// invisible to the customer, so the row must be valid for every input shape.
const AGE_BANDS = new Set(['unknown', 'under_18', '18_30', '31_45', '46_65', 'over_65']);
function assertFitsSchema(row, label) {
  assert.match(row.session_key, /^[A-Za-z0-9_-]{6,120}$/, `${label}: session_key "${row.session_key}"`);
  assert.match(row.country_code, /^[A-Z]{2}$/, `${label}: country_code`);
  assert.match(row.language_code, /^[a-z]{2}(-[A-Z]{2})?$/, `${label}: language_code`);
  assert.ok(AGE_BANDS.has(row.age_band), `${label}: age_band ${row.age_band}`);
  assert.ok(row.reasons.length <= 500, `${label}: reasons length ${row.reasons.length}`);
  assert.ok(row.turns >= 0 && row.turns <= 40, `${label}: turns ${row.turns}`);
  assert.ok(row.elapsed_ms >= 0 && row.elapsed_ms <= 86400000, `${label}: elapsed_ms ${row.elapsed_ms}`);
  assert.ok(row.outcome && row.pathway_code && row.duration_code && row.severity, `${label}: empty column`);
}

const logged = outcomeRow({
  session_id: 'session_abc123',
  outcome: 'PRODUCT_ELIGIBLE',
  reason_codes: ['approved_product_match'],
  turns: 10,
  elapsed_ms: 4200,
  state: { country_code: 'ZZ', language_code: 'en', pathway_code: 'pain_fever', age_years: 30, duration_code: 'today', severity: 'mild' },
});
assert.equal(logged.age_band, '18_30');
assert.equal(logged.reasons, 'approved_product_match');
assertFitsSchema(logged, 'normal row');

const hostile = outcomeRow({
  session_id: '<script>drop table kiosk_outcome_log</script>',
  outcome: 'SOMETHING_INVENTED',
  reason_codes: Array.from({ length: 200 }, (_, i) => `reason_${i}_and_it_is_long_enough_to_overflow_the_column_check`),
  turns: 9999,
  elapsed_ms: -5,
  state: { country_code: 'zz-ZZ hack', language_code: 'english', pathway_code: 'invented_pathway', age_years: 999, duration_code: 'never', severity: 'unheard' },
});
assertFitsSchema(hostile, 'hostile row');
assert.equal(hostile.outcome, 'NO_SUITABLE_PRODUCT', 'an unknown outcome must not be logged as if it were a decision');
assert.equal(hostile.age_band, 'unknown');
assert.equal(hostile.language_code, 'en');
assert.equal(hostile.country_code, 'DE');
assert.equal(hostile.pathway_code, 'none');
assert.equal(hostile.turns, 0);
assert.equal(hostile.elapsed_ms, 0);

const noState = outcomeRow({ session_id: 'session_zzz999', outcome: 'IMMEDIATE_MEDICAL_CARE' });
assertFitsSchema(noState, 'row without state');
assert.equal(noState.age_band, 'unknown');
assert.equal(noState.reasons, '');

for (const [age, band] of [[17, 'under_18'], [18, '18_30'], [30, '18_30'], [31, '31_45'], [46, '46_65'], [66, 'over_65']]) {
  assert.equal(outcomeRow({ session_id: 'session_bandtest', outcome: 'CLINIC_REFERRAL', state: { age_years: age } }).age_band, band);
}

console.log('All deterministic n8n engine tests passed.');

