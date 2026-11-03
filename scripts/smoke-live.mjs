/**
 * Fast live smoke test for the deployed workflow.
 *
 * Proves the four things that break silently after an n8n re-import:
 * the webhook answers, the Header Auth secret matches, the engine walks
 * symptom -> age -> duration, and dispensing stays unauthorised.
 *
 * Usage:
 *   PILLPAL_WEBHOOK_SECRET=... node scripts/smoke-live.mjs [url]
 *   (or put PILLPAL_WEBHOOK_URL / PILLPAL_WEBHOOK_SECRET in .env)
 */

import './load-env.mjs';

const url = process.argv[2]
  || process.env.PILLPAL_WEBHOOK_URL
  || 'https://n8n.naf-cloudsystem.de/webhook/pillpal-chat-turn';
const secret = process.env.PILLPAL_WEBHOOK_SECRET || '';

if (!secret) {
  console.error('PILLPAL_WEBHOOK_SECRET is not set. Export it or add it to .env (never commit it).');
  process.exit(2);
}

const sessionId = `smoke_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const failures = [];

async function post(body, { withAuth = true } = {}) {
  const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
  if (withAuth) headers['X-PILLPAL-Auth'] = secret;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ country_code: 'ZZ', language_code: 'en', ...body }),
    signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* reported below */ }
  return { status: response.status, json, text };
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    console.log(`FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
    failures.push(name);
  }
}

console.log(`Smoke testing ${url}`);

const unauthorized = await post({ session_id: sessionId, reset: true }, { withAuth: false });
check('rejects a request without the auth header', unauthorized.status === 401 || unauthorized.status === 403,
  `HTTP ${unauthorized.status} - the webhook may have lost its Header Auth credential`);

let turn = await post({ session_id: sessionId, reset: true });
check('accepts the configured secret', turn.status === 200, `HTTP ${turn.status}: ${turn.text.slice(0, 180)}`);
check('starts at the symptom question', turn.json?.screen?.question_id === 'symptom',
  `got ${turn.json?.screen?.question_id || turn.json?.outcome || 'no screen'}`);

const steps = [
  ['symptom', 'pain_fever', 'age'],
  ['age', 30, 'duration'],
  ['duration', 'today', 'severity'],
];
for (const [questionId, value, expectedNext] of steps) {
  if (!turn.json?.state) break;
  turn = await post({
    session_id: sessionId,
    state: turn.json.state,
    answer: { question_id: questionId, value },
  });
  check(`answering ${questionId} moves to ${expectedNext}`, turn.json?.screen?.question_id === expectedNext,
    `HTTP ${turn.status}, got ${turn.json?.screen?.question_id || turn.json?.outcome || 'no screen'}`);
}

check('reports turns and elapsed time', Number.isInteger(turn.json?.turns) && Number.isInteger(turn.json?.elapsed_ms),
  `turns=${JSON.stringify(turn.json?.turns)} elapsed_ms=${JSON.stringify(turn.json?.elapsed_ms)}`);
check('dispensing stays unauthorised', turn.json?.dispense_authorized === false,
  `got ${JSON.stringify(turn.json?.dispense_authorized)}`);

console.log('');
if (failures.length) {
  console.log(`${failures.length} smoke check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('Live smoke test passed.');
}
