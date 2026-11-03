// Shared generator for the "understand an answer" sidecar workflow.
//
// The logic lives in web/answer-understanding.js and is pasted into the Code
// nodes at build time, so the kiosk bridge and the n8n sidecar cannot drift
// apart. The sidecar is a separate workflow from the customer safety chain: it
// only rewrites a transcript into a value the screen already offers.

import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export async function sharedUnderstandingSource() {
  const source = await readFile(resolve(here, '../web/answer-understanding.js'), 'utf8');
  return source.replace(/^export /gm, '');
}

const DRIVER_HEADER = [
  '// Generated from web/answer-understanding.js by n8n/build-understand-workflow.mjs.',
  '// Edit the module, not this node.',
  '',
].join('\n');

export async function sanitizeNodeCode(minConfidence) {
  const shared = await sharedUnderstandingSource();
  return `${DRIVER_HEADER}${shared}
const config = { minConfidence: ${Number(minConfidence) || 0.6} };
const body = $json.body || $json;
const result = sanitizeRequest(body, config);
if (!result.ok) return [{ json: { ok: false, error: result.error } }];
const messages = buildMessages(result.context);
return [{ json: { ok: true, system: messages.system, user: messages.user, context: result.context } }];
`;
}

export async function validateNodeCode() {
  const shared = await sharedUnderstandingSource();
  return `${DRIVER_HEADER}${shared}
const sanitized = $('Sanitize Request').first().json || {};
const context = sanitized.context || {};
const modelText = extractModelText('gemini', $input.first().json || {});
const verdict = modelText ? validateModelAnswer(modelText, context) : reject('provider_failed');
return [{
  json: {
    matched: verdict.matched === true,
    value: verdict.value ?? null,
    label: verdict.label ?? null,
    confidence: verdict.confidence ?? 0,
    reason: verdict.reason || null,
    provider: 'gemini-n8n',
  },
}];
`;
}

export async function badRequestNodeCode() {
  return `${DRIVER_HEADER}const error = $json.error || 'The request is not usable.';
return [{
  json: {
    matched: false,
    value: null,
    label: null,
    confidence: 0,
    reason: 'bad_request',
    detail: String(error).slice(0, 120),
    provider: 'gemini-n8n',
  },
}];
`;
}

export function statusNodeCode(model, minConfidence, timeoutMs) {
  return `${DRIVER_HEADER}return [{
  json: {
    available: true,
    provider: 'gemini-n8n',
    model: ${JSON.stringify(String(model))},
    min_confidence: ${Number(minConfidence) || 0.6},
    timeout_ms: ${Number(timeoutMs) || 12000},
    note: null,
  },
}];
`;
}

function ifNode(name, leftValue, position) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        combinator: 'and',
        conditions: [{
          id: randomUUID(),
          leftValue,
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
      },
      options: {},
    },
    id: randomUUID(),
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position,
  };
}

function codeNode(name, jsCode, position) {
  return {
    parameters: { jsCode },
    id: randomUUID(),
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
  };
}

function respondNode(name, position) {
  return {
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json }}',
      options: {
        responseCode: 200,
        responseHeaders: {
          entries: [
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Cache-Control', value: 'no-store' },
            { name: 'X-Content-Type-Options', value: 'nosniff' },
          ],
        },
      },
    },
    id: randomUUID(),
    name,
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position,
  };
}

export function buildUnderstandWorkflow(options) {
  const {
    model,
    minConfidence,
    timeoutMs,
    headerAuthCredential,
    geminiCredential,
    codes,
  } = options;

  return {
    name: 'PILLPAL MedAssist - Spoken Answer Understanding (Gemini sidecar)',
    nodes: [
      {
        parameters: {
          httpMethod: 'POST',
          path: 'pillpal-understand',
          responseMode: 'responseNode',
          authentication: 'headerAuth',
          options: {},
        },
        id: randomUUID(),
        name: 'Understand Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [-780, 120],
        webhookId: randomUUID(),
        credentials: { httpHeaderAuth: headerAuthCredential },
      },
      codeNode('Sanitize Request', codes.sanitize, [-540, 120]),
      ifNode('Usable Request?', '={{ $json.ok === true }}', [-300, 120]),
      {
        parameters: {
          method: 'POST',
          url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'googlePalmApi',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify({ systemInstruction: { parts: [{ text: $json.system }] }, contents: [{ role: "user", parts: [{ text: $json.user }] }], generationConfig: { temperature: 0, topP: 0, maxOutputTokens: 64, responseMimeType: "application/json" } }) }}',
          options: { timeout: Number(timeoutMs) || 12000 },
        },
        id: randomUUID(),
        name: 'Ask Gemini',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [-60, 20],
        alwaysOutputData: true,
        onError: 'continueRegularOutput',
        retryOnFail: false,
        credentials: { googlePalmApi: geminiCredential },
      },
      codeNode('Validate Understanding', codes.validate, [180, 20]),
      codeNode('Refuse Bad Request', codes.badRequest, [-60, 240]),
      respondNode('Return Understanding', [420, 120]),
      {
        parameters: {
          httpMethod: 'GET',
          path: 'pillpal-understand-status',
          responseMode: 'responseNode',
          authentication: 'headerAuth',
          options: {},
        },
        id: randomUUID(),
        name: 'Status Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [-780, 380],
        webhookId: randomUUID(),
        credentials: { httpHeaderAuth: headerAuthCredential },
      },
      codeNode('Report Status', codes.status, [-540, 380]),
      respondNode('Return Status', [-300, 380]),
    ],
    pinData: {},
    connections: {
      'Understand Webhook': { main: [[{ node: 'Sanitize Request', type: 'main', index: 0 }]] },
      'Sanitize Request': { main: [[{ node: 'Usable Request?', type: 'main', index: 0 }]] },
      'Usable Request?': {
        main: [
          [{ node: 'Ask Gemini', type: 'main', index: 0 }],
          [{ node: 'Refuse Bad Request', type: 'main', index: 0 }],
        ],
      },
      'Ask Gemini': { main: [[{ node: 'Validate Understanding', type: 'main', index: 0 }]] },
      'Validate Understanding': { main: [[{ node: 'Return Understanding', type: 'main', index: 0 }]] },
      'Refuse Bad Request': { main: [[{ node: 'Return Understanding', type: 'main', index: 0 }]] },
      'Status Webhook': { main: [[{ node: 'Report Status', type: 'main', index: 0 }]] },
      'Report Status': { main: [[{ node: 'Return Status', type: 'main', index: 0 }]] },
    },
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
    versionId: randomUUID(),
    meta: { templateCredsSetupCompleted: true },
    nodeGroups: [],
    id: randomUUID().replaceAll('-', '').slice(0, 16),
    tags: [],
  };
}
