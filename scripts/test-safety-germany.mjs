import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { loadEngineSource } from '../n8n/load-engine-source.mjs';
import { inspectSnapshot } from '../web/catalog-snapshot.mjs';
import { createSessionManager } from '../web/session-manager.mjs';
import { medicineTermsConflict, productApprovalReasons } from '../web/safety-policy.js';
import { processChatTurn, validateCombination } from '../web/local-engine.mjs';
import { DEFAULT_LANGUAGE, languageCoverage, localizeScreen, localizeResult, t } from '../web/i18n.js';
import { assessmentSpeech, splitSpeechText } from '../web/assessment-speech.js';
import { VoiceAssistant } from '../web/voice-assistant.js';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const state = {
  country_code: 'DE', language_code: 'de', pathway_code: 'pain_fever', age_years: 30,
  duration_code: 'today', severity: 'mild', warning_signs: false, pregnancy_breastfeeding: 'no',
  allergy_status: 'no', medication_status: 'no', condition_status: 'no',
  allergy_terms: [], medication_terms: [], condition_terms: [], confirmed: true,
};
// Synthetic objects exist only inside this test, never in the operational catalogue.
const product = {
  id: 'isolated-test-product', sku: 'ISOLATED-PRODUCT', product_name: 'Test product', country_code: 'DE',
  pathway_code: 'pain_fever', language_code: 'de', chatbot_enabled: true, market_status: 'commercialised',
  clinical_status: 'approved', legal_status: 'approved', review_status: 'approved', pathway_approval_status: 'approved',
  data_origin: 'reviewed', is_fixture: false, reviewer_name: 'Test-only evidence', reviewed_at: '2026-11-09T00:00:00Z',
  clinical_source_url: 'https://unit-tests.example/source', label_url: 'https://unit-tests.example/leaflet',
  allowed_indications: ['pain_fever'], active_ingredients: [{ name: 'paracetamol', strength: '500', unit: 'mg' }],
  minimum_age_months: 216, maximum_duration_days: 3,
  allergy_terms: [], contraindications: [], interaction_rules: [],
  dose_instructions: { status: 'approved', display_text: 'Test-only placeholder. Not for medical use.' },
};
const run = new Function('$input', '$', await loadEngineSource(new URL('../n8n/src/catalog-decision.js', import.meta.url)));
function match(p = product, s = state) {
  return run({ all: () => [{ json: p }] }, () => ({ first: () => ({ json: { state: s } }) }))[0].json;
}
assert.equal(match().outcome, 'PRODUCT_ELIGIBLE');
for (const language_code of ['de', 'en', 'hi']) {
  const result = match(product, { ...state, language_code });
  assert.equal(result.product.sku, product.sku, `language ${language_code} must not change German eligibility`);
  assert.equal(result.dispense_authorized, false);
}
for (const key of ['chatbot_enabled', 'market_status', 'clinical_status', 'legal_status', 'review_status',
  'pathway_approval_status', 'data_origin', 'is_fixture', 'reviewer_name', 'reviewed_at', 'clinical_source_url',
  'label_url', 'allowed_indications', 'minimum_age_months', 'maximum_duration_days', 'dose_instructions', 'active_ingredients', 'interaction_rules']) {
  const copy = structuredClone(product);
  delete copy[key];
  assert.equal(match(copy).outcome, 'NO_SUITABLE_PRODUCT', `missing ${key} must fail closed`);
}
for (const market_status of ['withdrawn', 'recalled', 'retired', 'unknown']) {
  assert.equal(match({ ...product, market_status }).outcome, 'NO_SUITABLE_PRODUCT');
}
for (const country_code of ['IN', 'MA', 'ZZ']) assert.equal(match({ ...product, country_code }).product, null);
for (const data_origin of ['synthetic', 'imported']) assert.ok(productApprovalReasons({ ...product, data_origin }, 'DE').length);
assert.equal(match({ ...product, dose_instructions: { status: 'approved' } }).outcome, 'NO_SUITABLE_PRODUCT');
for (const key of ['age_years', 'duration_code', 'severity', 'warning_signs', 'pregnancy_breastfeeding', 'allergy_status',
  'medication_status', 'condition_status', 'confirmed', 'allergy_terms']) {
  const copy = { ...state }; delete copy[key];
  assert.ok(match(product, copy).reason_codes.includes('incomplete_safety_assessment'), key);
}
for (const allergy of ['acetaminophen', 'Panadol', 'paracetamol']) {
  const result = match(product, { ...state, allergy_status: 'yes', allergy_terms: [allergy] });
  assert.equal(result.outcome, 'NO_SUITABLE_PRODUCT');
  assert.ok(result.system_detail[0].reasons.includes('allergy_conflict'));
}
for (const medicine of ['acetaminophen', 'Panadol', 'Dolo 650']) {
  const result = match(product, { ...state, medication_status: 'yes', medication_terms: [medicine] });
  assert.equal(result.outcome, 'NO_SUITABLE_PRODUCT');
  assert.ok(result.system_detail[0].reasons.includes('duplicate_active_ingredient'));
}
assert.equal(medicineTermsConflict(['ASS'], ['aspirin']), true);
assert.equal(medicineTermsConflict(['Brufen'], ['ibuprofen']), true);
assert.equal((await validateCombination('MA-DOLIPRANE-500-EFF', [], ['acetaminophen'])).reason, 'allergy_conflict');

// Corruption, forged checksum, wrong key, missing dates and expiry are separate cases.
const now = Date.parse('2026-11-09T12:00:00Z');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const otherKey = generateKeyPairSync('ed25519').publicKey;
function release(overrides = {}) {
  const payload = { snapshot_version: 'test', products: [product], vending_inventory: [], alternatives: [],
    valid_from: '2026-11-09T00:00:00Z', expires_at: '2026-11-10T00:00:00Z', ...overrides };
  const bytes = Buffer.from(JSON.stringify(payload, null, 2));
  return { ...payload, integrity_sha256: createHash('sha256').update(bytes).digest('hex'), signature: sign(null, bytes, privateKey).toString('base64') };
}
assert.equal(inspectSnapshot(release(), publicKey, now).trusted, true);
assert.equal(inspectSnapshot(release(), null, now).trusted, false);
assert.equal(inspectSnapshot(release(), otherKey, now).trusted, false);
assert.equal(inspectSnapshot(release({ expires_at: '2026-11-08T00:00:00Z' }), publicKey, now).trusted, false);
assert.equal(inspectSnapshot(release({ valid_from: '2026-11-10T00:00:00Z' }), publicKey, now).trusted, false);
assert.equal(inspectSnapshot(release({ expires_at: null }), publicKey, now).trusted, false);
assert.throws(() => inspectSnapshot({ ...release(), products: [] }, publicKey, now), /checksum/);
const tampered = release(); tampered.products = [{ ...product, sku: 'MODIFIED' }];
delete tampered.signature;
const { integrity_sha256, ...tamperedPayload } = tampered;
tampered.integrity_sha256 = createHash('sha256').update(JSON.stringify(tamperedPayload, null, 2)).digest('hex');
assert.equal(inspectSnapshot(tampered, publicKey, now).trusted, false, 'recalculating a checksum cannot sign a release');

// Positive integration: an isolated signed release must work through the actual
// local adapter, not merely through a mocked policy. No operational data changes.
const temp = await mkdtemp(join(tmpdir(), 'pillpal-safety-'));
const releasePath = join(temp, 'catalogue.json');
const keyPath = join(temp, 'public.pem');
try {
  await writeFile(releasePath, JSON.stringify(release({
    valid_from: new Date(Date.now() - 60000).toISOString(),
    expires_at: new Date(Date.now() + 60000).toISOString(),
  })));
  await writeFile(keyPath, publicKey.export({ type: 'spki', format: 'pem' }));
  const source = `import { processChatTurn } from './web/local-engine.mjs';
    let turn = await processChatTurn({ reset: true, country_code: 'DE', language_code: 'hi' });
    for (const value of ['pain_fever', 30, 'today', 'mild', 'no', 'none', 'yes']) {
      turn = await processChatTurn({ country_code: 'DE', language_code: 'hi', state: turn.state,
        answer: { question_id: turn.screen.question_id, value } });
    }
    console.log(JSON.stringify({ outcome: turn.outcome, sku: turn.product?.sku, dispense_authorized: turn.dispense_authorized }));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PILLPAL_CATALOG_FILE: releasePath, PILLPAL_CATALOG_PUBLIC_KEY_FILE: keyPath },
  }));
  assert.equal(result.outcome, 'PRODUCT_ELIGIBLE');
  assert.equal(result.sku, product.sku);
  assert.equal(result.dispense_authorized, false);
} finally {
  await unlink(releasePath).catch(() => {});
  await unlink(keyPath).catch(() => {});
  await rmdir(temp);
}

// The real engine is exercised through server-owned state, including corrections by restart.
const chat = createSessionManager(processChatTurn);
let { result: turn } = await chat({ reset: true, country_code: 'IN', language_code: 'hi' });
assert.equal(turn.state.country_code, 'DE');
assert.equal(turn.state.language_code, 'hi');
const forged = await chat({ session_id: turn.session_id, revision: turn.revision,
  state: { ...state, step: 'confirm' }, answer: { question_id: 'confirm', value: 'yes' } });
assert.equal(forged.result.screen.question_id, 'symptom');
assert.equal((await chat({ session_id: turn.session_id, revision: turn.revision })).status, 409);
turn = forged.result;
for (const value of ['pain_fever', 30, 'today', 'mild', 'no', 'none', 'yes']) {
  const response = await chat({ session_id: turn.session_id, revision: turn.revision, language_code: 'hi',
    country_code: 'IN', answer: { question_id: turn.screen.question_id, value } });
  assert.equal(response.status, 200);
  turn = response.result;
  assert.equal(turn.state.country_code, 'DE');
}
assert.equal(turn.outcome, 'NO_SUITABLE_PRODUCT');
const expired = createSessionManager(processChatTurn, { ttlMs: 1, now: () => clock });
let clock = 0;
const initial = (await expired({ reset: true })).result;
clock = 2;
assert.equal((await expired({ session_id: initial.session_id, revision: 0,
  answer: { question_id: 'confirm', value: 'yes' } })).result.screen.question_id, 'symptom');

assert.equal(DEFAULT_LANGUAGE, 'de');
for (const language of ['de', 'en', 'hi']) {
  const opening = assessmentSpeech({ question_id: 'symptom', title: 'Choose a category',
    subtitle: 'Choose the closest option.', options: [{ value: 'pain_fever', label: 'Headache, pain or fever' },
      { value: 'other', label: 'Other symptom' }] }, language);
  assert.equal(opening, t('voiceOpening', language));
  assert.doesNotMatch(opening, /choose|select|options|category|closest|Headache, pain or fever|Other symptom/i);
}
assert.equal(languageCoverage('hi').interface, 'preview');
assert.equal(languageCoverage('te').interface, 'english-fallback');
assert.equal(languageCoverage('de').clinical_validation, false);
const hindi = localizeScreen({ question_id: 'age', options: [] }, 'hi');
assert.match(hindi.title, /उम्र/);
let warnings = await processChatTurn({ reset: true, country_code: 'DE', language_code: 'de' });
for (const value of ['pain_fever', 30, 'today', 'mild']) {
  warnings = await processChatTurn({ country_code: 'DE', language_code: 'de', state: warnings.state,
    answer: { question_id: warnings.screen.question_id, value } });
}
const localizedWarnings = localizeScreen(warnings.screen, 'de');
assert.equal(localizedWarnings.red_flags.length, warnings.screen.red_flags.length);
assert.match(localizedWarnings.red_flags[0], /Nackensteifigkeit/);
assert.ok(localizedWarnings.red_flags.every((flag, i) => flag !== warnings.screen.red_flags[i]), 'every rendered pain/fever warning must be German');
for (const language of ['de', 'en']) {
  const localized = localizeScreen(warnings.screen, language);
  const spoken = assessmentSpeech(warnings.screen, language);
  for (const flag of localized.red_flags) assert.ok(spoken.includes(flag), `voice must include: ${flag}`);
  assert.ok(spoken.includes(t('voiceWarningReply', language)));
  assert.doesNotMatch(spoken, /Options are|Optionen sind/);
  assert.doesNotMatch(spoken, /check.*screen|Hinweise auf dem Bildschirm/i);
  const chunks = splitSpeechText(spoken);
  assert.ok(chunks.every(chunk => chunk.length <= 760));
  assert.equal(chunks.join(' '), spoken, 'all warning text must survive TTS chunking');
}
const speech = new VoiceAssistant({ provider: 'none', fallbackToBrowser: true });
const played = [];
speech.playBrowser = async text => { played.push(text); return true; };
const longWarning = [assessmentSpeech(warnings.screen, 'de'), ...Array(8).fill('Zusätzlicher geprüfter Hinweis.')].join(' ');
assert.ok(longWarning.length > 800, 'exercise the former server truncation boundary');
speech.speak(longWarning);
while (speech.processing || speech.queue.length) await new Promise(resolve => setImmediate(resolve));
assert.equal(played.join(' '), longWarning);
speech.destroy();
assert.equal(t('option.confirm.yes', 'hi'), 'पुष्टि करें और जाँच करें');
const emergency = localizeResult({ outcome: 'IMMEDIATE_MEDICAL_CARE', state: { country_code: 'DE' } }, 'de');
assert.match(emergency.message, /112/);
assert.doesNotMatch(localizeResult({ outcome: 'IMMEDIATE_MEDICAL_CARE', state: { country_code: 'MA' } }, 'de').message, /112/);
console.log('Germany safety regressions passed: approvals, aliases, duplicate ingredients, multilingual parity, release authenticity, sessions and expiry.');
