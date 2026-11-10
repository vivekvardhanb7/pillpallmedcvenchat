import { loadEngineSource } from '../n8n/load-engine-source.mjs';
/**
 * Customer journey tests - walks the kiosk conversation end to end.
 *
 * Usage:
 *   node scripts/test-customer-journeys.mjs                 # offline, against n8n/src
 *   node scripts/test-customer-journeys.mjs --live [url]     # over HTTP, needs the webhook secret
 *
 * Live mode reads the endpoint from PILLPAL_WEBHOOK_URL and the secret from
 * PILLPAL_WEBHOOK_SECRET (sent as the x-pillpal-auth header).
 */

import './load-env.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const liveFlagIndex = process.argv.indexOf('--live');
const isLive = liveFlagIndex !== -1;
const webhookUrl = isLive
  && (process.argv[liveFlagIndex + 1] || process.env.PILLPAL_WEBHOOK_URL
    || 'https://n8n.naf-cloudsystem.de/webhook/pillpal-chat-turn');
const webhookSecret = process.env.PILLPAL_WEBHOOK_SECRET || '';

const intakeSource = await readFile(resolve('n8n/src/intake-and-safety-engine.js'), 'utf8');
const catalogSource = await loadEngineSource(resolve('n8n/src/catalog-decision.js'));
const runIntakeCode = new Function('$input', intakeSource);
const runCatalogCode = new Function('$input', '$', catalogSource);

const ZZ = 'ZZ';
const fixtureProduct = {
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
  country_code: ZZ,
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
const secondaryProduct = {
  ...fixtureProduct,
  id: '00000000-0000-0000-0000-000000000002',
  sku: 'TEST-SECONDARY',
  product_name: 'Secondary Test Product',
  active_ingredients: [{ name: 'other active compound', strength: '500', unit: 'mg' }],
  display_priority: 20,
  allergy_terms: [],
};

// A single explicit "none" covers allergies, current medicines and ongoing
// conditions. A Yes/Not sure answer still opens the individual safe follow-ups.
const CLEAN = ['pain_fever', 30, 'today', 'mild', 'no', 'none', 'yes'];

function offlineRun(answers, { country = ZZ, rows = [fixtureProduct] } = {}) {
  const intake = body => runIntakeCode({ first: () => ({ json: { body } }) })[0].json;
  let turn = intake({ session_id: `journey_${Math.random().toString(36).slice(2, 10)}`, country_code: country, language_code: 'en', reset: true });
  const trail = [turn.screen?.question_id || turn.outcome];
  for (const value of answers) {
    if (!turn.screen || turn.screen.type === 'result' || turn.screen.type === 'product_result') break;
    turn = intake({
      session_id: turn.session_id,
      country_code: country,
      language_code: 'en',
      state: turn.state,
      answer: { question_id: turn.screen.question_id, value },
    });
    trail.push(turn.screen?.question_id || turn.outcome);
    if (turn.needs_catalog === true) {
      const lookup = () => ({ first: () => ({ json: turn }) });
      const input = { first: () => ({ json: { statusCode: 200, body: rows } }) };
      return { result: runCatalogCode(input, lookup)[0].json, trail };
    }
  }
  return { result: turn, trail };
}

async function liveRun(answers, { country = ZZ } = {}) {
  const sessionId = `journey_live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const headers = { 'Content-Type': 'text/plain' };
  if (webhookSecret) headers['X-PILLPAL-Auth'] = webhookSecret;
  const post = async body => {
    const response = await fetch(webhookUrl, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  };
  let turn = await post({ session_id: sessionId, country_code: country, language_code: 'en', reset: true });
  const trail = [turn.screen?.question_id || turn.outcome];
  for (const value of answers) {
    if (!turn.screen || turn.screen.type === 'result' || turn.screen.type === 'product_result') break;
    turn = await post({
      session_id: sessionId, country_code: country, language_code: 'en',
      state: turn.state, answer: { question_id: turn.screen.question_id, value },
    });
    trail.push(turn.screen?.question_id || turn.outcome);
  }
  return { result: turn, trail };
}

const run = isLive ? liveRun : offlineRun;

// expected: outcome, reason code that must be present, extra check.
// liveAnswers: answers used only in live mode when the deployed catalogue needs
// different terms to exercise the same rule.
// taps: the exact number of answers a customer must give before the kiosk stops.
const scenarios = [
  { name: 'Adult, clean answers, ZZ fixture product', answers: CLEAN, expected: 'PRODUCT_ELIGIBLE', reason: 'approved_product_match', taps: 7 },
  { name: 'Adult, clean answers, Morocco (no approved MA product)', answers: CLEAN, country: 'MA', expected: 'NO_SUITABLE_PRODUCT', reason: 'no_approved_product_for_pathway', offlineRows: [], taps: 7 },
  { name: 'Cold or cough stops on the first tap in Morocco', answers: ['cold_cough'], country: 'MA', expected: 'NO_SUITABLE_PRODUCT', reason: 'pathway_not_serviced', taps: 1, summaryNotAsked: ['age', 'duration', 'severity', 'allergies'] },
  { name: 'Allergy stops on the first tap in Morocco', answers: ['allergy'], country: 'MA', expected: 'NO_SUITABLE_PRODUCT', reason: 'pathway_not_serviced', taps: 1, summaryNotAsked: ['age', 'duration', 'severity', 'allergies'] },
  { name: 'Diarrhoea stops on the first tap in Morocco', answers: ['diarrhoea'], country: 'MA', expected: 'NO_SUITABLE_PRODUCT', reason: 'pathway_not_serviced', taps: 1, summaryNotAsked: ['age', 'duration', 'severity', 'allergies'] },
  { name: 'Heartburn stops on the first tap in Morocco', answers: ['heartburn'], country: 'MA', expected: 'NO_SUITABLE_PRODUCT', reason: 'pathway_not_serviced', taps: 1, summaryNotAsked: ['age', 'duration', 'severity', 'allergies'] },
  { name: 'Skin or minor wound stops on the first tap in Morocco', answers: ['skin_minor_wound'], country: 'MA', expected: 'NO_SUITABLE_PRODUCT', reason: 'pathway_not_serviced', taps: 1, summaryNotAsked: ['age', 'duration', 'severity', 'allergies'] },
  // The demo country is wider, but only up to the categories the engine declares
  // for ZZ; 'other' stays refused there too.
  { name: 'Demo country keeps the interview running for a widened pathway', answers: ['cold_cough'], expected: 'MORE_INFORMATION', screen: 'age', taps: 1 },
  { name: 'Demo country still refuses other', answers: ['other'], expected: 'NO_SUITABLE_PRODUCT', reason: 'unsupported_pathway', taps: 1 },
  { name: 'Symptom: other', answers: ['other'], expected: 'NO_SUITABLE_PRODUCT', reason: 'unsupported_pathway', taps: 1, summaryNotAsked: ['duration', 'severity', 'warning_signs', 'allergies'] },
  { name: 'Age 17 stops at the age question', answers: ['pain_fever', 17], expected: 'CLINIC_REFERRAL', reason: 'under_18', taps: 2, summaryNotAsked: ['duration', 'warning_signs', 'allergies'] },
  { name: 'Age 5 stops at the age question', answers: ['pain_fever', 5], expected: 'CLINIC_REFERRAL', reason: 'under_18', taps: 2 },
  { name: 'Age 18 is allowed to continue', answers: ['pain_fever', 18, 'today', 'mild', 'no', 'none', 'yes'], expected: 'PRODUCT_ELIGIBLE', reason: 'approved_product_match', taps: 7 },
  { name: 'Age 120 is allowed to continue', answers: ['pain_fever', 120, 'today', 'mild', 'no', 'none', 'yes'], expected: 'NO_SUITABLE_PRODUCT', reason: 'age_outside_supported_range', detailReason: 'above_maximum_age', offlineRows: [fixtureProduct], taps: 7 },
  { name: 'Product minimum age above the customer', answers: CLEAN, expected: 'NO_SUITABLE_PRODUCT', reason: 'age_outside_supported_range', detailReason: 'below_minimum_age', offlineRows: [{ ...fixtureProduct, minimum_age_months: 1200 }], offlineOnly: 'the ZZ fixture minimum age is 18 years, so a 30-year-old cannot be below it', taps: 7 },
  { name: 'Symptom outlasts the approved self-treatment window', answers: ['pain_fever', 30, '3_to_7_days', 'mild', 'no', 'none', 'yes'], expected: 'NO_SUITABLE_PRODUCT', reason: 'symptom_longer_than_product_allows', detailReason: 'symptom_longer_than_product_allows', offlineRows: [{ ...fixtureProduct, maximum_duration_days: 3 }], taps: 7, live: ['PRODUCT_ELIGIBLE'] },
  { name: 'Symptom inside the approved window still matches', answers: ['pain_fever', 30, '1_to_2_days', 'mild', 'no', 'none', 'yes'], expected: 'PRODUCT_ELIGIBLE', offlineRows: [{ ...fixtureProduct, maximum_duration_days: 3 }], taps: 7 },
  { name: 'Severe symptom', answers: ['pain_fever', 30, 'today', 'severe'], expected: 'CLINIC_REFERRAL', reason: 'severe_symptom', taps: 4, summaryNotAsked: ['warning_signs', 'pregnancy_or_breastfeeding'] },
  { name: 'Warning signs: yes', answers: ['pain_fever', 30, 'today', 'mild', 'yes'], expected: 'IMMEDIATE_MEDICAL_CARE', reason: 'warning_sign_reported', taps: 5 },
  { name: 'Warning signs: not sure', answers: ['pain_fever', 30, 'today', 'mild', 'not_sure'], expected: 'IMMEDIATE_MEDICAL_CARE', reason: 'warning_sign_uncertain', taps: 5, summaryWarning: 'Not sure' },
  { name: 'Pregnancy or breastfeeding applies', answers: [...CLEAN.slice(0, 5), 'pregnancy'], expected: 'CLINIC_REFERRAL', reason: 'pregnancy_breastfeeding_or_uncertain', taps: 6 },
  { name: 'Both background groups apply', answers: [...CLEAN.slice(0, 5), 'both'], expected: 'CLINIC_REFERRAL', reason: 'pregnancy_breastfeeding_or_uncertain', taps: 6 },
  { name: 'Background answer is uncertain', answers: [...CLEAN.slice(0, 5), 'not_sure'], expected: 'CLINIC_REFERRAL', reason: 'pregnancy_breastfeeding_or_uncertain', taps: 6 },
  { name: 'Symptom longer than 7 days', answers: ['pain_fever', 30, 'more_than_7_days'], expected: 'CLINIC_REFERRAL', reason: 'duration_outside_pathway', taps: 3, summaryNotAsked: ['severity', 'warning_signs'] },
  { name: 'Medication status: not sure', answers: [...CLEAN.slice(0, 5), 'history', 'no', 'not_sure'], expected: 'CLINIC_REFERRAL', reason: 'medical_history_uncertain', taps: 8 },
  { name: 'Condition status: not sure', answers: [...CLEAN.slice(0, 5), 'history', 'no', 'no', 'not_sure'], expected: 'CLINIC_REFERRAL', reason: 'medical_history_uncertain', taps: 9 },
  { name: 'Allergy term conflicts with product', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ['test ingredient'], 'no', 'no', 'yes'], liveAnswers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ['paracetamol', 'ibuprofen'], 'no', 'no', 'yes'], expected: 'NO_SUITABLE_PRODUCT', reason: 'all_products_blocked', detailReason: 'allergy_conflict', taps: 11 },
  { name: 'Condition conflicts with product', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'no', 'no', 'yes', ['example condition'], 'yes'], liveAnswers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'no', 'no', 'yes', ['severe liver disease', 'history of gastric bleeding'], 'yes'], expected: 'NO_SUITABLE_PRODUCT', reason: 'all_products_blocked', detailReason: 'contraindication_conflict', taps: 11 },
  { name: 'Medicine interacts with product', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'no', 'yes', ['example interacting medicine'], 'no', 'yes'], liveAnswers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'no', 'yes', ['other paracetamol products', 'aspirin'], 'no', 'yes'], expected: 'NO_SUITABLE_PRODUCT', reason: 'all_products_blocked', detailReason: 'medicine_interaction_conflict', taps: 11 },
  { name: 'Primary blocked, lower priority product selected', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ['test ingredient'], 'no', 'no', 'yes'], liveAnswers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ['paracetamol'], 'no', 'no', 'yes'], expected: 'PRODUCT_ELIGIBLE', offlineRows: [fixtureProduct, secondaryProduct], productName: 'Secondary Test Product', liveProductName: 'BRUFEN', taps: 11 },
  { name: 'Confirm: start again', answers: [...CLEAN.slice(0, -1), 'no'], expected: 'MORE_INFORMATION', screen: 'symptom', taps: 7 },
  { name: 'Invalid symptom value', answers: ['i want drugs'], expected: 'MORE_INFORMATION', message: 'Please choose one of the available symptom categories', screen: 'symptom', taps: 1 },
  { name: 'Invalid age value', answers: ['pain_fever', 'abc'], expected: 'MORE_INFORMATION', message: 'Enter an age from 0 to 120', screen: 'age', taps: 2 },
  { name: 'Age above 120 rejected', answers: ['pain_fever', 999], expected: 'MORE_INFORMATION', message: 'Enter an age from 0 to 120', screen: 'age', taps: 2 },
  { name: 'Empty allergy list rejected', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ''], expected: 'MORE_INFORMATION', message: 'Enter at least one medicine or ingredient allergy', screen: 'allergy_terms', taps: 8 },
  { name: 'HTML injection in a free-text answer is stripped', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ['<script>alert(1)</script> paracetamol'], 'no', 'no', 'yes'], expected: 'PRODUCT_ELIGIBLE', noHtml: true, taps: 11 },
  { name: 'Oversized free text is truncated', answers: ['pain_fever', 30, 'today', 'mild', 'no', 'history', 'yes', ['x'.repeat(5000)], 'no', 'no', 'yes'], expected: 'PRODUCT_ELIGIBLE', maxLength: 90, taps: 11 },
];

const extraChecks = [
  { name: 'Catalogue unavailable (Supabase error)', check: () => {
    const base = offlineRun(CLEAN);
    const lookup = () => ({ first: () => ({ json: base.result }) });
    const out = runCatalogCode({ first: () => ({ json: { error: { message: 'database offline' } } }) }, lookup)[0].json;
    return out.outcome === 'NO_SUITABLE_PRODUCT' && out.reason_codes.includes('catalog_unavailable')
      ? null : `got ${out.outcome} ${JSON.stringify(out.reason_codes)}`;
  }, liveSkip: true },
  { name: 'Empty catalogue returns no recommendation', check: () => {
    const base = offlineRun(CLEAN, { rows: [] });
    return base.result.outcome === 'NO_SUITABLE_PRODUCT' && base.result.reason_codes.includes('no_approved_product_for_pathway')
      ? null : `got ${base.result.outcome}`;
  }, liveSkip: true },
  { name: 'First touch with no state shows the symptom question', check: () => {
    const out = runIntakeCode({ first: () => ({ json: { body: { country_code: 'MA' } } }) })[0].json;
    return out.screen?.question_id === 'symptom' && out.outcome === 'MORE_INFORMATION' ? null : `got ${out.outcome}`;
  }, liveSkip: true },
  { name: 'Answer after a finished session starts a new assessment', check: () => {
    const base = offlineRun(['pain_fever', 17]);
    const out = runIntakeCode({
      first: () => ({ json: { body: { session_id: base.result.session_id, country_code: 'ZZ', state: base.result.state, answer: { question_id: 'complete', value: 'today' } } } }),
    })[0].json;
    return out.screen?.question_id === 'symptom' ? null : `got ${out.screen?.question_id}`;
  }, liveSkip: true },
  { name: 'Tampered state cannot skip to a product result', check: () => {
    const forged = { version: 1, country_code: 'ZZ', language_code: 'en', step: 'confirm', pathway_code: 'pain_fever', age_years: 30, duration_code: 'today', severity: 'mild', warning_signs: false, pregnancy_breastfeeding: 'no', allergy_status: 'no', medication_status: 'no', condition_status: 'no', confirmed: false, completed: false, turns: 0 };
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: 'tamper_check_0001', country_code: 'ZZ', state: forged, answer: { question_id: 'confirm', value: 'yes' } } } }) })[0].json;
    return out.needs_catalog === true && out.outcome === 'CATALOG_CHECK_REQUIRED' ? null : `got ${out.outcome}`;
  }, liveSkip: true },
  { name: 'Forged state cannot skip the severe-symptom gate', check: () => {
    const forged = { version: 1, country_code: 'ZZ', language_code: 'en', step: 'confirm', pathway_code: 'pain_fever', age_years: 30, duration_code: 'today', severity: 'severe', warning_signs: false, pregnancy_breastfeeding: 'no', allergy_status: 'no', medication_status: 'no', condition_status: 'no', confirmed: false, completed: false, turns: 9 };
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: 'tamper_severe_001', country_code: 'ZZ', state: forged, answer: { question_id: 'confirm', value: 'yes' } } } }) })[0].json;
    return out.outcome === 'CLINIC_REFERRAL' && out.reason_codes.includes('severe_symptom') && out.needs_catalog !== true
      ? null : `got ${out.outcome} ${JSON.stringify(out.reason_codes)}`;
  }, liveSkip: true },
  { name: 'Forged state cannot assess an out-of-scope pathway', check: () => {
    const forged = { version: 1, country_code: 'MA', language_code: 'en', step: 'confirm', pathway_code: 'diarrhoea', age_years: 30, duration_code: 'today', severity: 'mild', warning_signs: false, pregnancy_breastfeeding: 'no', allergy_status: 'no', medication_status: 'no', condition_status: 'no', confirmed: false, completed: false, turns: 9 };
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: 'tamper_scope_001', country_code: 'MA', state: forged, answer: { question_id: 'confirm', value: 'yes' } } } }) })[0].json;
    return out.outcome === 'NO_SUITABLE_PRODUCT' && out.reason_codes.includes('pathway_not_serviced') && out.needs_catalog !== true
      ? null : `got ${out.outcome} ${JSON.stringify(out.reason_codes)}`;
  }, liveSkip: true },
  { name: 'Widened demo pathway still cannot skip the warning-sign gate', check: () => {
    const forged = { version: 1, country_code: 'ZZ', language_code: 'en', step: 'confirm', pathway_code: 'diarrhoea', age_years: 30, duration_code: 'today', severity: 'mild', warning_signs: true, warning_signs_answer: 'yes', pregnancy_breastfeeding: 'no', allergy_status: 'no', medication_status: 'no', condition_status: 'no', confirmed: false, completed: false, turns: 9 };
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: 'tamper_scope_002', country_code: 'ZZ', state: forged, answer: { question_id: 'confirm', value: 'yes' } } } }) })[0].json;
    return out.outcome === 'IMMEDIATE_MEDICAL_CARE' && out.reason_codes.includes('warning_sign_reported_or_uncertain') && out.needs_catalog !== true
      ? null : `got ${out.outcome} ${JSON.stringify(out.reason_codes)}`;
  }, liveSkip: true },
  { name: 'Every response reports turns and elapsed_ms', check: () => {
    const intake = body => runIntakeCode({ first: () => ({ json: { body } }) })[0].json;
    let turn = intake({ session_id: `timing_check_01`, country_code: 'ZZ', language_code: 'en', reset: true });
    for (const value of ['pain_fever', 30, 'today', 'mild']) {
      if (!Number.isInteger(turn.turns) || turn.turns < 0) return `turns = ${JSON.stringify(turn.turns)}`;
      if (!Number.isInteger(turn.elapsed_ms) || turn.elapsed_ms < 0) return `elapsed_ms = ${JSON.stringify(turn.elapsed_ms)}`;
      turn = intake({ session_id: turn.session_id, country_code: 'ZZ', language_code: 'en', state: turn.state, answer: { question_id: turn.screen.question_id, value } });
    }
    return turn.elapsed_ms >= 0 ? null : 'elapsed_ms went backwards';
  }, liveSkip: true },
  { name: 'Forged completed flag is ignored', check: () => {
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: 'forged_done_0001', country_code: 'ZZ', state: { step: 'age', completed: true, age_years: 40 }, answer: { question_id: 'age', value: 40 } } } }) })[0].json;
    return out.screen?.question_id === 'symptom' ? null : `got ${out.screen?.question_id}`;
  }, liveSkip: true },
  { name: 'Invalid country code falls back to Germany', check: () => {
    const out = runIntakeCode({ first: () => ({ json: { body: { country_code: 'zz-ZZ hack', reset: true, session_id: 'country_check_1' } } }) })[0].json;
    return out.state.country_code === 'DE' ? null : `got ${out.state.country_code}`;
  }, liveSkip: true },
  { name: 'Session limit stops a looping customer', check: () => {
    const state = { version: 1, country_code: 'ZZ', language_code: 'en', step: 'symptom', pathway_code: null, age_years: null, duration_code: null, severity: null, warning_signs: null, pregnancy_breastfeeding: null, allergy_status: null, allergy_terms: [], medication_status: null, medication_terms: [], condition_status: null, condition_terms: [], confirmed: false, completed: false, turns: 31 };
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: 'loop_limit_00001', country_code: 'ZZ', state, answer: { question_id: 'symptom', value: 'pain_fever' } } } }) })[0].json;
    return out.outcome === 'CLINIC_REFERRAL' && out.reason_codes.includes('session_limit') ? null : `got ${out.outcome}`;
  }, liveSkip: true },
  { name: 'Garbage session id is replaced', check: () => {
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: '../etc/passwd', reset: true } } }) })[0].json;
    return /^session_/.test(out.session_id) ? null : `got ${out.session_id}`;
  }, liveSkip: true },
  { name: 'Answer for a different question is rejected', check: () => {
    const base = offlineRun(['pain_fever']);
    const out = runIntakeCode({ first: () => ({ json: { body: { session_id: base.result.session_id, country_code: 'ZZ', state: base.result.state, answer: { question_id: 'duration', value: 'today' } } } }) })[0].json;
    return out.outcome === 'MORE_INFORMATION' && String(out.message).includes('does not match the current question') && out.screen?.question_id === 'age'
      ? null : `got ${out.outcome} @${out.screen?.question_id} "${out.message}"`;
  }, liveSkip: true },
  { name: 'Nothing ever authorizes dispensing', check: () => {
    const journeys = [offlineRun(CLEAN), offlineRun(['pain_fever', 30, 'today', 'mild', 'yes']), offlineRun(CLEAN, { country: 'MA', rows: [] })];
    const bad = journeys.find(j => j.result.dispense_authorized !== false);
    return bad ? `dispense_authorized leaked in ${bad.result.outcome}` : null;
  }, liveSkip: true },
];

const pad = (text, width) => `${text}${' '.repeat(Math.max(0, width - String(text).length))}`;
const failures = [];
let index = 0;
let skipped = 0;

console.log(isLive ? `Live journeys against ${webhookUrl}${webhookSecret ? ' (with auth header)' : ' (NO SECRET - requests will be rejected)'}` : 'Offline journeys against n8n/src');
console.log('');

for (const scenario of scenarios) {
  index += 1;
  if (isLive && scenario.offlineOnly) {
    skipped += 1;
    console.log(`${pad(index, 3)} ${pad('SKIP', 22)} ${scenario.name} -> needs a catalogue row this database does not have (${scenario.offlineOnly})`);
    continue;
  }
  let result;
  let trail;
  try {
    ({ result, trail } = await run(isLive && scenario.liveAnswers ? scenario.liveAnswers : scenario.answers, { country: scenario.country || ZZ, rows: scenario.offlineRows || [fixtureProduct] }));
  } catch (error) {
    failures.push(`${scenario.name}: request failed - ${error.message}`);
    console.log(`${pad(index, 3)} ${pad('FAIL', 22)} ${scenario.name} -> ${error.message}`);
    continue;
  }

  const allowed = isLive && scenario.live ? scenario.live : [scenario.expected];
  const problems = [];
  if (!allowed.includes(result.outcome)) problems.push(`outcome ${result.outcome}, expected ${allowed.join('/')}`);
  if (scenario.reason && !(result.reason_codes || []).includes(scenario.reason) && !(isLive && scenario.live)) problems.push(`missing reason ${scenario.reason} (${JSON.stringify(result.reason_codes)})`);
  if (scenario.screen && result.screen?.question_id !== scenario.screen) problems.push(`screen ${result.screen?.question_id}, expected ${scenario.screen}`);
  if (scenario.message && !String(result.message || '').includes(scenario.message)) problems.push(`message "${result.message}"`);
  if (scenario.taps && trail.length - 1 !== scenario.taps) problems.push(`took ${trail.length - 1} taps, expected exactly ${scenario.taps}`);
  for (const field of scenario.summaryNotAsked || []) {
    const value = result.summary?.[field];
    if (value !== 'Not asked') problems.push(`summary.${field} = ${JSON.stringify(value)}, expected "Not asked"`);
  }
  if (scenario.summaryWarning && result.summary?.warning_signs !== scenario.summaryWarning) {
    problems.push(`summary.warning_signs = ${JSON.stringify(result.summary?.warning_signs)}, expected "${scenario.summaryWarning}"`);
  }
  if (scenario.productName && !(isLive && (scenario.live || scenario.liveProductName)) && result.product?.name !== scenario.productName) problems.push(`product ${result.product?.name}`);
  if (scenario.liveProductName && isLive && !String(result.product?.name || '').includes(scenario.liveProductName)) {
    problems.push(`live product ${JSON.stringify(result.product?.name)}, expected one containing "${scenario.liveProductName}"`);
  }
  if (scenario.detailReason && !(isLive && scenario.live) && !(result.system_detail || []).some(entry => (entry.reasons || []).includes(scenario.detailReason))) problems.push(`system_detail missing ${scenario.detailReason} (${JSON.stringify(result.system_detail)})`);
  if (scenario.noHtml && /<[>a-z]/i.test(JSON.stringify(result.state.allergy_terms))) problems.push('html survived sanitising');
  if (scenario.maxLength && (result.state.allergy_terms || []).some(t => t.length > scenario.maxLength)) problems.push('text not truncated');
  if (result.dispense_authorized !== false) problems.push('dispense_authorized is not false');

  const label = problems.length ? 'FAIL' : 'PASS';
  if (problems.length) failures.push(`${scenario.name}: ${problems.join('; ')}`);
  console.log(`${pad(index, 3)} ${pad(label, 22)} ${scenario.name} -> ${result.outcome}${result.product ? ` (${result.product.name})` : ''}${result.reason_codes?.length ? ` [${result.reason_codes.join(',')}]` : ''}${result.screen ? ` @${result.screen.question_id}` : ''} ${trail.length - 1} taps`);
}

for (const extra of extraChecks) {
  if (isLive && extra.liveSkip) continue;
  index += 1;
  const problem = extra.check();
  console.log(`${pad(index, 3)} ${pad(problem ? 'FAIL' : 'PASS', 22)} ${extra.name}${problem ? ` -> ${problem}` : ''}`);
  if (problem) failures.push(`${extra.name}: ${problem}`);
}

console.log('');
if (failures.length) {
  console.log(`${failures.length} failing check(s):`);
  for (const failure of failures) console.log(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`All ${index - skipped} customer journey checks passed${skipped ? ` (${skipped} skipped: they need catalogue rows this database does not have)` : ''}.`);
}
