import assert from 'node:assert/strict';
import {
  buildCall,
  buildMessages,
  extractModelText,
  readProviderConfig,
  sanitizeRequest,
  statusPayload,
  UNDERSTAND_QUESTIONS,
  validateModelAnswer,
} from '../web/answer-understanding.js';

const offConfig = readProviderConfig({});
assert.equal(offConfig.provider, 'off');
assert.equal(offConfig.usable, false);

const ollamaConfig = readProviderConfig({ PILLPAL_AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:11434/' });
assert.equal(ollamaConfig.usable, true);
assert.equal(ollamaConfig.baseUrl, 'http://127.0.0.1:11434');
assert.equal(ollamaConfig.model, 'gemma3:1b');

// A cloud provider without a key must degrade to "off", not to a broken call.
const noKey = readProviderConfig({ PILLPAL_AI_PROVIDER: 'gemini' });
assert.equal(noKey.provider, 'off');
assert.equal(noKey.usable, false);
assert.equal(noKey.note, 'missing_api_key');
assert.equal(statusPayload(noKey).available, false);

const geminiConfig = readProviderConfig({ PILLPAL_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });
assert.equal(geminiConfig.provider, 'gemini');
assert.equal(geminiConfig.apiKey, 'test-key');
assert.equal(readProviderConfig({ PILLPAL_AI_PROVIDER: 'gemini', PILLPAL_AI_MIN_CONFIDENCE: '9' }).minConfidence, 1);
assert.equal(readProviderConfig({ PILLPAL_AI_PROVIDER: 'nonsense' }).note, 'unknown_provider');

// ---------- request surface is limited to what the screen already shows ----------

const durationScreen = {
  question_id: 'duration',
  type: 'single_select',
  title: 'How long have you had this symptom?',
  options: [
    { value: 'today', label: 'Started today' },
    { value: '1_to_2_days', label: '1–2 days' },
    { value: 'more_than_7_days', label: 'More than 7 days' },
  ],
};

function contextFor(payload, config = offConfig) {
  const prepared = sanitizeRequest(payload, config);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  return prepared.context;
}

const durationContext = contextFor({ ...durationScreen, transcript: 'since yesterday' });
assert.equal(durationContext.transcript, 'since yesterday');
assert.equal(durationContext.options.length, 3);

// The client carries a state blob, product decisions and the kiosk key. None of
// it may reach the model: the request is rebuilt field by field.
const hostile = contextFor({
  ...durationScreen,
  transcript: 'since yesterday',
  state: { allergy_terms: ['paracetamol'], dispense_authorized: true },
  dispense_authorized: true,
  outcome: 'PRODUCT_ELIGIBLE',
  webhookSecret: 'SYNTHETIC_KIOSK_KEY_SENTINEL',
  extra: { nested: 'value' },
});
for (const forbidden of ['state', 'dispense_authorized', 'outcome', 'webhookSecret', 'extra']) {
  assert.ok(!(forbidden in hostile), `sanitizeRequest leaked ${forbidden}`);
}

const messages = buildMessages(hostile);
for (const forbidden of ['SYNTHETIC_KIOSK_KEY_SENTINEL', 'dispense_authorized', 'PRODUCT_ELIGIBLE', 'paracetamol']) {
  assert.ok(!messages.user.includes(forbidden) && !messages.system.includes(forbidden), `prompt leaked ${forbidden}`);
}
assert.ok(messages.user.includes('"1_to_2_days"'));
assert.ok(messages.user.includes('since yesterday'));

const ollamaCall = buildCall(readProviderConfig({ PILLPAL_AI_PROVIDER: 'ollama' }), hostile);
assert.equal(ollamaCall.url, 'http://127.0.0.1:11434/api/chat');
assert.equal(ollamaCall.body.format, 'json');
assert.equal(ollamaCall.body.options.temperature, 0);
assert.ok(!('apiKey' in ollamaCall.headers));

const geminiCall = buildCall(geminiConfig, hostile);
assert.ok(geminiCall.url.endsWith(':generateContent'));
assert.equal(geminiCall.headers['x-goog-api-key'], 'test-key');
assert.ok(!JSON.stringify(geminiCall.body).includes('test-key'), 'the API key must stay out of the request body');
assert.ok(extractModelText('ollama', { message: { content: '{"value":"today","confidence":0.9}' } }).includes('today'));
assert.equal(
  extractModelText('gemini', { candidates: [{ content: { parts: [{ text: '{"value"' }, { text: ':"today"}' }] } }] }),
  '{"value":"today"}',
);
assert.equal(extractModelText('gemini', { candidates: [] }), '');

// Only questions the kiosk actually asks may be interpreted, and only with the
// shape the engine produces.
assert.equal(sanitizeRequest({ ...durationScreen, question_id: 'dispense_authorized', transcript: 'yes' }, offConfig).ok, false);
assert.equal(sanitizeRequest({ ...durationScreen, question_id: 'product_result', transcript: 'yes' }, offConfig).ok, false);
assert.equal(sanitizeRequest({ ...durationScreen, transcript: '   ' }, offConfig).ok, false);
assert.equal(sanitizeRequest({ ...durationScreen, type: 'result' }, offConfig).ok, false);
assert.equal(sanitizeRequest({ question_id: 'severity', type: 'single_select', options: [], transcript: 'mild' }, offConfig).ok, false);
assert.ok(UNDERSTAND_QUESTIONS.has('warning_signs'));
const controlTrimmed = contextFor({ ...durationScreen, transcript: 'today \u0000<script>' });
assert.ok(!controlTrimmed.transcript.includes('\u0000'));
assert.equal(contextFor({ ...durationScreen, transcript: 'x'.repeat(2000) }).transcript.length, 500);
assert.equal(contextFor({ ...durationScreen, transcript: 'today', options: Array.from({ length: 40 }, (_, i) => ({ value: `v${i}`, label: `l${i}` })) }).options.length, 12);

// ---------- model output is only ever a value the screen already offered ----------

const accepted = validateModelAnswer('{"value":"1_to_2_days","confidence":0.85}', hostile);
assert.deepEqual(accepted, {
  matched: true,
  value: '1_to_2_days',
  label: '1–2 days',
  confidence: 0.85,
  reason: null,
});

// An invented value, even with total confidence, cannot become an answer.
const invented = validateModelAnswer('{"value":"ibuprofen_400","confidence":1}', hostile);
assert.equal(invented.matched, false);
assert.equal(invented.reason, 'value_not_allowed');

assert.equal(validateModelAnswer('{"value":"no","confidence":1}', hostile).matched, false);
assert.equal(validateModelAnswer('{"value":"more than 7 days","confidence":0.95}', hostile).value, 'more_than_7_days');
assert.equal(validateModelAnswer('{"value":"MORE THAN 7 DAYS","confidence":0.95}', hostile).value, 'more_than_7_days');
assert.equal(validateModelAnswer('{"value":"today","confidence":0.4}', hostile).reason, 'low_confidence');
assert.equal(validateModelAnswer('{"value":"unknown","confidence":0.99}', hostile).reason, 'not_answered');
assert.equal(validateModelAnswer('{"value":"1_to_2_days"}', hostile).reason, 'low_confidence');
assert.equal(validateModelAnswer('sorry, no json here', hostile).reason, 'unparseable');
assert.equal(validateModelAnswer('', hostile).reason, 'unparseable');
assert.equal(validateModelAnswer('```json\n{"value":"today","confidence":0.9}\n```', hostile).value, 'today');
assert.equal(validateModelAnswer('The customer means: {"value":"today","confidence":0.9}', hostile).value, 'today');
assert.equal(validateModelAnswer('{"value":"today","confidence":9}', hostile).confidence, 1);

// A model that tries to answer for the kiosk instead of for the customer.
const hijack = validateModelAnswer(
  '{"value":"today","confidence":0.99,"dispense_authorized":true,"outcome":"PRODUCT_ELIGIBLE","dose":"2 tablets"}',
  hostile,
);
assert.deepEqual(Object.keys(hijack).sort(), ['confidence', 'label', 'matched', 'reason', 'value']);
assert.equal(hijack.value, 'today');
assert.ok(!('dispense_authorized' in hijack));

// Age: digits only, inside the bounds the screen already declares.
const ageContext = contextFor({
  question_id: 'age',
  type: 'number',
  title: 'What is your age?',
  minimum: 0,
  maximum: 120,
  transcript: 'b-3r-3 s-nin',
});
assert.equal(validateModelAnswer('{"value":"34","confidence":0.9}', ageContext).value, 34);
assert.equal(validateModelAnswer('{"value":"34 years old","confidence":0.9}', ageContext).value, 34);
assert.equal(validateModelAnswer('{"value":"340","confidence":0.99}', ageContext).reason, 'out_of_range');
assert.equal(validateModelAnswer('{"value":"thirty","confidence":0.99}', ageContext).reason, 'no_number');

// Free-text history: names only, deduplicated, capped, and never markup.
const allergyContext = contextFor({
  question_id: 'allergy_terms',
  type: 'text',
  title: 'Which medicine or ingredient are you allergic to?',
  transcript: 'paracetamol and amoxicillin',
});
const terms = validateModelAnswer('{"value":"and paracetamol, amoxicillin ,paracetamol","confidence":0.8}', allergyContext);
assert.equal(terms.matched, true);
assert.equal(terms.value, 'paracetamol, amoxicillin');
assert.equal(validateModelAnswer('{"value":"<script>alert(1)</script>","confidence":0.9}', allergyContext).reason, 'value_not_allowed');
assert.equal(validateModelAnswer('{"value":"none at all","confidence":0.9}', allergyContext).matched, false);
assert.equal(
  validateModelAnswer(`{"value":"${Array.from({ length: 40 }, (_, i) => `drug${i}`).join(', ')}","confidence":0.9}`, allergyContext)
    .value
    .split(', ')
    .length,
  12,
);

console.log('Answer-understanding sidecar tests passed.');
