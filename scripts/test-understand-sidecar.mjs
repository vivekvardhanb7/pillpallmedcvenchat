// Runs the sidecar workflow's Code nodes offline, the same way the n8n Code node
// does (new Function with $json / $input / $), so a broken generated script is
// caught here instead of in a live kiosk turn.
//
//   node scripts/test-understand-sidecar.mjs

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workflowPath = resolve('n8n/workflows/PILLPAL_Understand_Sidecar.json');
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));
const nodes = new Map(workflow.nodes.map(node => [node.name, node]));

function runCode(name, { json = {}, items = [], prior = {} } = {}) {
  const source = nodes.get(name).parameters.jsCode;
  const dollar = (nodeName) => ({
    first: () => ({ json: prior[nodeName] ?? prior.$default ?? {} }),
  });
  const input = {
    first: () => ({ json: items.length ? items[0] : json }),
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('$', '$input', '$json', `${source}\n//@ts-nocheck`);
  const result = fn(dollar, input, json);
  assert.ok(Array.isArray(result), `${name} must return an array of items`);
  return result.map(item => item.json);
}

function geminiReply(text) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

const screenPayload = {
  body: {
    question_id: 'symptom',
    type: 'single_select',
    title: 'What would you like help with?',
    language: 'fr',
    transcript: "j'ai tres mal a la tete",
    options: [
      { value: 'pain_fever', label: 'Headache, pain or fever' },
      { value: 'cold_cough', label: 'Cold or cough' },
    ],
  },
};

// --- request shape -----------------------------------------------------------
const rejected = runCode('Sanitize Request', { json: { body: { question_id: 'not_a_screen', transcript: 'x' } } });
assert.equal(rejected[0].ok, false);
assert.match(rejected[0].error, /Unsupported question/);

const accepted = runCode('Sanitize Request', { json: screenPayload });
assert.equal(accepted[0].ok, true);
assert.equal(accepted[0].context.questionId, 'symptom');
assert.equal(accepted[0].context.options.length, 2);
assert.ok(accepted[0].system.includes('Never invent a value'));
assert.ok(accepted[0].user.includes("j'ai tres mal a la tete"));

// Nothing the kiosk sends besides the screen may reach the model.
for (const forbidden of ['dispense_authorized', 'webhookSecret', 'state', 'outcome']) {
  assert.ok(!JSON.stringify(accepted[0]).includes(forbidden), `${forbidden} leaked into the provider call`);
}

// --- response shape ----------------------------------------------------------
const good = runCode('Validate Understanding', {
  items: [geminiReply('{"value":"pain_fever","confidence":0.95}')],
  prior: { 'Sanitize Request': accepted[0] },
});
assert.deepEqual(
  { matched: good[0].matched, value: good[0].value, label: good[0].label, provider: good[0].provider },
  { matched: true, value: 'pain_fever', label: 'Headache, pain or fever', provider: 'gemini-n8n' },
);

const invented = runCode('Validate Understanding', {
  items: [geminiReply('{"value":"ibuprofen_400","confidence":0.99}')],
  prior: { 'Sanitize Request': accepted[0] },
});
assert.equal(invented[0].matched, false);
assert.equal(invented[0].reason, 'value_not_allowed');

const vague = runCode('Validate Understanding', {
  items: [geminiReply('{"value":"unknown","confidence":0}')],
  prior: { 'Sanitize Request': accepted[0] },
});
assert.equal(vague[0].matched, false);
assert.equal(vague[0].reason, 'low_confidence');

const silent = runCode('Validate Understanding', {
  items: [geminiReply('{"value":"none","confidence":0.9}')],
  prior: { 'Sanitize Request': accepted[0] },
});
assert.equal(silent[0].matched, false);
assert.equal(silent[0].reason, 'not_answered');

// The HTTP node is onError: continueRegularOutput, so a provider failure arrives
// as an item without candidates and must come back as an honest no-match.
const failed = runCode('Validate Understanding', {
  items: [{ error: '429 quota exceeded' }],
  prior: { 'Sanitize Request': accepted[0] },
});
assert.equal(failed[0].matched, false);
assert.equal(failed[0].reason, 'provider_failed');

const badRequest = runCode('Refuse Bad Request', { json: { ok: false, error: 'Unsupported question.' } });
assert.equal(badRequest[0].matched, false);
assert.equal(badRequest[0].reason, 'bad_request');

const status = runCode('Report Status', {});
assert.equal(status[0].available, true);
assert.equal(status[0].provider, 'gemini-n8n');

// --- workflow shape ----------------------------------------------------------
const webhook = nodes.get('Understand Webhook');
assert.equal(webhook.parameters.authentication, 'headerAuth');
assert.ok(webhook.credentials.httpHeaderAuth.id, 'the sidecar must not be an open Gemini proxy');
assert.equal(nodes.get('Status Webhook').parameters.authentication, 'headerAuth');

const ask = nodes.get('Ask Gemini');
assert.equal(ask.onError, 'continueRegularOutput');
assert.equal(ask.retryOnFail, false, 'a retried provider call is billed twice');
assert.equal(ask.parameters.nodeCredentialType, 'googlePalmApi');
assert.ok(ask.parameters.url.endsWith(':generateContent'));
assert.ok(!JSON.stringify(workflow).includes('$env'), 'this instance denies $env');

const returnNode = nodes.get('Return Understanding');
const connected = Object.entries(workflow.connections)
  .filter(([, value]) => JSON.stringify(value).includes(returnNode.name))
  .map(([name]) => name)
  .sort();
assert.deepEqual(connected, ['Refuse Bad Request', 'Validate Understanding']);

console.log('Spoken-answer sidecar workflow tests passed.');
