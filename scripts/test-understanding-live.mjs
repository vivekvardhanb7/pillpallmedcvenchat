// End-to-end check of the spoken-answer helper against the live kiosk.
//
// It drives a real session through the safety workflow, and for every question
// it feeds the model an answer in a language the deterministic mapper does not
// know (Darija, French, Moroccan Arabic script). The value the model picks is
// then submitted to the workflow, so a wrong or invented answer cannot slip
// through unnoticed: the engine rejects it and the run fails.
//
//   node scripts/test-understanding-live.mjs
//
// Needs PILLPAL_AI_PROVIDER plus a provider key and PILLPAL_WEBHOOK_URL /
// PILLPAL_WEBHOOK_SECRET in .env.

import assert from 'node:assert/strict';
import './load-env.mjs';
import {
  buildCall,
  extractModelText,
  readProviderConfig,
  sanitizeRequest,
  validateModelAnswer,
} from '../web/answer-understanding.js';

const webhookUrl = process.env.PILLPAL_WEBHOOK_URL;
const webhookSecret = process.env.PILLPAL_WEBHOOK_SECRET || '';
if (!webhookUrl) {
  console.error('PILLPAL_WEBHOOK_URL is not set.');
  process.exit(1);
}

const config = readProviderConfig(process.env);
if (!config.usable) {
  console.error(`Answer understanding is not usable (provider=${config.provider}, note=${config.note || 'none'}).`);
  console.error('Set PILLPAL_AI_PROVIDER=gemini and GEMINI_API_KEY in .env, or ollama + OLLAMA_MODEL.');
  process.exit(1);
}

async function turn(body) {
  const headers = { 'Content-Type': 'text/plain' };
  if (webhookSecret) headers['X-PILLPAL-Auth'] = webhookSecret;
  const response = await fetch(webhookUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`workflow HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function askModel(screen, transcript) {
  const prepared = sanitizeRequest({
    transcript,
    language: 'auto',
    question_id: screen.question_id,
    type: screen.type,
    title: screen.title,
    minimum: screen.minimum,
    maximum: screen.maximum,
    options: (screen.options || []).map(option => ({ value: option.value, label: option.label })),
  }, config);
  assert.ok(prepared.ok, `screen ${screen.question_id} was refused by the limiter: ${prepared.error}`);
  const call = buildCall(config, prepared.context);
  const started = Date.now();
  const response = await fetch(call.url, {
    method: 'POST',
    headers: call.headers,
    body: JSON.stringify(call.body),
    signal: AbortSignal.timeout(Math.max(config.timeoutMs, 20000)),
  });
  if (!response.ok) throw new Error(`provider HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const result = validateModelAnswer(extractModelText(call.provider, await response.json()), prepared.context);
  return { ...result, ms: Date.now() - started };
}

let index = 0;
const failures = [];
const timings = [];

function report(label, detail) {
  index += 1;
  console.log(`${String(index).padStart(3)}  ${label}  ${detail}`);
}

async function expectAnswer(screen, transcript, expected, description) {
  const answer = await askModel(screen, transcript);
  timings.push(answer.ms);
  const got = answer.matched ? answer.value : `no match (${answer.reason})`;
  if (!answer.matched || answer.value !== expected) {
    failures.push(`${screen.question_id}: "${transcript}" -> ${got}, expected ${expected}`);
    report('FAIL', `${description}: "${transcript}" -> ${got}`);
    // Continue the session on the documented path instead of stacking ten
    // unrelated failures behind the one that actually missed.
    return { value: expected, label: String(expected) };
  }
  report('PASS', `${description}: "${transcript}" -> ${answer.value} (${answer.ms} ms, confidence ${answer.confidence})`);
  return answer;
}

async function expectNoAnswer(screen, transcript, description) {
  const answer = await askModel(screen, transcript);
  timings.push(answer.ms);
  if (answer.matched) {
    failures.push(`${screen.question_id}: "${transcript}" invented ${answer.value}`);
    report('FAIL', `${description}: invented ${answer.value}`);
  } else {
    report('PASS', `${description}: refused (${answer.reason})`);
  }
}

console.log(`Provider ${config.provider} / ${config.model}, confidence floor ${config.minConfidence}`);
console.log(`Live workflow ${webhookUrl}\n`);

let turnState = await turn({ session_id: `understand_${Date.now()}`, country_code: 'ZZ', language_code: 'en', reset: true });

async function advance(screen, answer) {
  if (!answer) return;
  turnState = await turn({
    session_id: turnState.session_id,
    country_code: 'ZZ',
    language_code: 'en',
    state: turnState.state,
    answer: { question_id: screen.question_id, value: answer.value },
  });
}

// --- symptom: three languages the deterministic mapper does not know ---
let screen = turnState.screen;
await expectNoAnswer(screen, 'I am not sure what I want, maybe several things at once', 'a vague answer must not be guessed');
const symptom = await expectAnswer(screen, "j'ai très mal à la tête et j'ai de la fièvre", 'pain_fever', 'French symptom');
await advance(screen, symptom);

screen = turnState.screen;
const age = await expectAnswer(screen, 'عندي خمسة وعشرون سنة', 25, 'Modern Standard Arabic age');
await advance(screen, age);

screen = turnState.screen;
const duration = await expectAnswer(screen, 'men nhar l-bareh, sawb l-mzyel', '1_to_2_days', 'Darija duration');
await advance(screen, duration);

screen = turnState.screen;
const severity = await expectAnswer(screen, 'ce n’est pas trop grave, c’est supportable', 'mild', 'French severity');
await advance(screen, severity);

screen = turnState.screen;
await expectNoAnswer(screen, 'est-ce que tu peux me dire quel médicament est le meilleur pour moi ?', 'a request for advice is not an answer');
const warnings = await expectAnswer(screen, 'la, walo, ma kayn walou', 'no', 'Darija warning signs');
await advance(screen, warnings);

screen = turnState.screen;
const pregnancy = await expectAnswer(screen, 'non, je ne suis pas enceinte', 'no', 'French pregnancy');
await advance(screen, pregnancy);

screen = turnState.screen;
const allergies = await expectAnswer(screen, 'oui, je suis allergique au paracétamol', 'yes', 'French allergy status');
await advance(screen, allergies);

screen = turnState.screen;
// A name the model has heard is written down as it is normally spelled, so
// "paracétamol" arriving as "paracetamol" is a correct result, not a miss.
const terms = await askModel(screen, 'le paracétamol et l’amoxicilline');
timings.push(terms.ms);
const folded = String(terms.value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
if (!terms.matched || !folded.includes('parac') || !folded.includes('amoxicill')) {
  failures.push(`allergy_terms: "le paracétamol et l’amoxicilline" -> ${terms.matched ? terms.value : `no match (${terms.reason})`}`);
  report('FAIL', `French allergy terms -> ${terms.matched ? terms.value : terms.reason}`);
  await advance(screen, { value: 'paracetamol', label: 'paracetamol' });
} else {
  report('PASS', `French allergy terms: "${terms.value}" (${terms.ms} ms, confidence ${terms.confidence})`);
  await advance(screen, terms);
}

screen = turnState.screen;
const noMedicines = await expectAnswer(screen, 'non, je ne prends aucun traitement', 'no', 'French medication status');
await advance(screen, noMedicines);

screen = turnState.screen;
const noConditions = await expectAnswer(screen, 'la, 3endich chi mard', 'no', 'Darija condition status');
await advance(screen, noConditions);

screen = turnState.screen;
const confirm = await expectAnswer(screen, 'oui, c’est exact', 'yes', 'French confirmation');
await advance(screen, confirm);

const outcome = turnState.outcome;
if (outcome === 'MORE_INFORMATION') {
  failures.push(`the session did not finish after mapped answers: ${JSON.stringify(turnState.screen)}`);
  report('FAIL', `session stopped at ${turnState.screen?.question_id}`);
} else {
  report('PASS', `mapped answers completed a real assessment -> ${outcome} [${(turnState.reason_codes || []).join(',')}]`);
}

assert.notEqual(turnState.dispense_authorized, true, 'dispensing was authorized');

const ordered = timings.slice().sort((a, b) => a - b);
console.log(`\n${timings.length} model calls: median ${ordered[Math.floor(ordered.length / 2)]} ms, slowest ${ordered.at(-1)} ms`);
console.log('');
if (failures.length) {
  console.log(`${failures.length} failing check(s):`);
  for (const failure of failures) console.log(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`All ${index} spoken-answer checks passed.`);
}
