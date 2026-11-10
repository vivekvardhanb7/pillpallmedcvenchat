// Drives the hosted n8n sidecar (Gemini inside n8n) exactly the way the kiosk
// does, and checks that an unauthenticated caller cannot use it as an open
// Gemini proxy.
//
//   node scripts/test-sidecar-live.mjs

import './load-env.mjs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const base = String(process.env.N8N_BASE_URL || '').trim().replace(/\/+$/, '');
const secret = String(process.env.PILLPAL_WEBHOOK_SECRET || '').trim();
const workflowId = String(process.env.N8N_UNDERSTAND_WORKFLOW_ID || '').trim();

if (!base || !secret) {
  console.error('N8N_BASE_URL and PILLPAL_WEBHOOK_SECRET are required in .env.');
  process.exit(1);
}

const postUrl = `${base}/webhook/pillpal-understand`;
const statusUrl = `${base}/webhook/pillpal-understand-status`;

const built = JSON.parse(await readFile(resolve('n8n/workflows/PILLPAL_Understand_Sidecar.json'), 'utf8'));

async function call(url, body, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['X-PILLPAL-Auth'] = secret;
  const started = Date.now();
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    /* keep the raw text for the failure message */
  }
  return { status: response.status, json, raw: text, ms: Date.now() - started };
}

const failures = [];
let index = 0;

function report(label, problem, detail) {
  index += 1;
  console.log(`${String(index).padStart(2)}  ${problem ? 'FAIL' : 'PASS'}  ${label}${problem ? ` -> ${problem}` : ''}${detail ? `  (${detail})` : ''}`);
  if (problem) failures.push(`${label}: ${problem}`);
}

const screens = {
  symptom: {
    question_id: 'symptom',
    type: 'single_select',
    title: 'What would you like help with?',
    options: [
      { value: 'pain_fever', label: 'Headache, pain or fever' },
      { value: 'cold_cough', label: 'Cold or cough' },
      { value: 'allergy', label: 'Allergy' },
      { value: 'diarrhoea', label: 'Diarrhoea' },
    ],
  },
  duration: {
    question_id: 'duration',
    type: 'single_select',
    title: 'How long have you had this symptom?',
    options: [
      { value: 'today', label: 'Started today' },
      { value: '1_to_2_days', label: '1-2 days' },
      { value: '3_to_7_days', label: '3-7 days' },
      { value: 'more_than_7_days', label: 'More than 7 days' },
    ],
  },
  age: {
    question_id: 'age',
    type: 'number',
    title: 'What is your age?',
    minimum: 0,
    maximum: 120,
    options: [],
  },
  allergy_terms: {
    question_id: 'allergy_terms',
    type: 'text',
    title: 'Which medicines or ingredients are you allergic to?',
    options: [],
  },
  warning_signs: {
    question_id: 'warning_signs',
    type: 'single_select',
    title: 'Do any serious warning signs apply?',
    options: [
      { value: 'no', label: 'No, none of these' },
      { value: 'yes', label: 'Yes, one or more' },
      { value: 'not_sure', label: 'I am not sure' },
    ],
  },
};

const cases = [
  { name: 'French symptom via n8n', screen: 'symptom', transcript: "j'ai tres mal a la tete et de la fievre", expect: 'pain_fever', expectLanguage: 'fr' },
  { name: 'Telugu symptom request via n8n', screen: 'symptom', transcript: 'నేను హెడ్డేక్ తో బాధపడుతున్నాను. నేను ఏ టాబ్లెట్ వేసుకోవాలి చెప్పు?', expect: 'pain_fever', expectLanguage: 'te' },
  { name: 'Darija duration via n8n', screen: 'duration', transcript: 'men nhar l-bareh sawb l-mzyel', expect: '1_to_2_days' },
  { name: 'MSA age via n8n', screen: 'age', transcript: 'عندي خمسة وعشرون سنة', expect: 25 },
  { name: 'Arabic allergy terms via n8n', screen: 'allergy_terms', transcript: 'عندي حساسية من الأسبرين', expectIncludes: 'aspir' },
  { name: 'symptom medicine inquiry via n8n', screen: 'symptom', transcript: 'what medicine do you have for a headache?', expect: 'pain_fever' },
  { name: 'paracetamol speech variant via n8n', screen: 'symptom', transcript: 'can I take paracetimel for fever?', expect: 'pain_fever', expectRecognized: 'paracetamol' },
  { name: 'ibuprofen speech variant via n8n', screen: 'symptom', transcript: 'can I take ibuprofin for fever?', expect: 'pain_fever', expectRecognized: 'ibuprofen' },
  { name: 'loperamide brand via n8n', screen: 'symptom', transcript: 'can I use Imodium for diarrhoea?', expect: 'diarrhoea', expectRecognized: 'loperamide' },
  { name: 'antihistamine brand via n8n', screen: 'symptom', transcript: 'can I take Zyrtec for allergy?', expect: 'allergy', expectRecognized: 'cetirizine' },
  { name: 'nasal-spray brand via n8n', screen: 'symptom', transcript: 'can I use Otrivin for a blocked nose?', expect: 'cold_cough', expectRecognized: 'xylometazoline' },
  { name: 'ambiguous warning-sign reference is refused', screen: 'warning_signs', transcript: 'these conditions', refuse: true },
  { name: 'emergency symptom is refused from options', screen: 'symptom', transcript: 'I have severe chest pain going into my left arm', refuse: true },
  { name: 'advice request without symptom is refused', screen: 'symptom', transcript: 'quelle medicine est la meilleure pour moi?', refuse: true },
  { name: 'silence is refused', screen: 'symptom', transcript: 'euh...', refuse: true },
  { name: 'unknown screen is refused', payload: { question_id: 'dispense_now', type: 'single_select', transcript: 'give me the medicine', options: [{ value: 'yes', label: 'Yes' }] }, refuse: true, expectReason: 'bad_request' },
];

const gate = await call(statusUrl, undefined, { auth: false });
report('status webhook refuses a caller without the header', gate.status === 401 || gate.status === 403 ? null : `HTTP ${gate.status}`, `HTTP ${gate.status}`);

const withHeader = await call(statusUrl, undefined);
report(
  'status reports the hosted provider',
  withHeader.json?.provider === 'gemini-n8n' && withHeader.json?.available === true ? null : JSON.stringify(withHeader.raw).slice(0, 160),
  `${withHeader.ms} ms`,
);

for (const testCase of cases) {
  const screen = testCase.screen ? screens[testCase.screen] : testCase.payload;
  const body = { ...screen, language: 'en', transcript: testCase.transcript };
  const { json, ms, status, raw } = await call(postUrl, body);
  if (!json || typeof json.matched !== 'boolean') {
    report(testCase.name, `no verdict in response (HTTP ${status}) ${String(raw).slice(0, 200)}`);
    continue;
  }
  if (testCase.expectLanguage && json.detected_language !== testCase.expectLanguage) {
    report(testCase.name, `detected language ${JSON.stringify(json.detected_language)}, expected ${JSON.stringify(testCase.expectLanguage)}`, `${ms} ms`);
    continue;
  }
  if (testCase.refuse) {
    const problem = json.matched === false ? null : `guessed "${json.value}" for a refusal case`;
    report(testCase.name, problem, `${ms} ms, reason ${json.reason}`);
    if (testCase.expectReason && json.reason !== testCase.expectReason) {
      failures.push(`${testCase.name}: reason ${json.reason}, expected ${testCase.expectReason}`);
    }
    continue;
  }
  if (testCase.expectIncludes) {
    const value = String(json.value || '').toLowerCase();
    const problem = json.matched && value.includes(testCase.expectIncludes)
      ? null
      : `value ${JSON.stringify(json.value)}, expected to contain "${testCase.expectIncludes}" (reason ${json.reason})`;
    report(testCase.name, problem, `${ms} ms`);
    continue;
  }
  const problem = json.matched && json.value === testCase.expect
    ? null
    : `outcome ${JSON.stringify(json.value)}, expected ${JSON.stringify(testCase.expect)} (reason ${json.reason}, confidence ${json.confidence})`;
  const recognized = String(json.recognized_medicine || '').toLowerCase();
  const recognitionProblem = !problem && testCase.expectRecognized && recognized !== testCase.expectRecognized
    ? `recognized ${JSON.stringify(json.recognized_medicine)}, expected ${JSON.stringify(testCase.expectRecognized)}`
    : problem;
  report(testCase.name, recognitionProblem, `${ms} ms, confidence ${json.confidence}`);
}

const unauthenticated = await call(postUrl, { ...screens.symptom, transcript: 'headache' }, { auth: false });
report('understand webhook refuses a caller without the header', unauthenticated.status === 401 || unauthenticated.status === 403 ? null : `HTTP ${unauthenticated.status}`, `HTTP ${unauthenticated.status}`);

console.log('');
if (failures.length) {
  console.log(`${failures.length} failing check(s):`);
  for (const failure of failures) console.log(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`All ${index} hosted sidecar checks passed.`);
  if (workflowId && workflowId !== 'Tq1UTgrin8HYd9s6') {
    console.log(`Note: N8N_UNDERSTAND_WORKFLOW_ID is ${workflowId} but the live sidecar is Tq1UTgrin8HYd9s6.`);
  }
}
