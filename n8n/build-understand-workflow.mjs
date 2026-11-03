// Builds n8n/workflows/PILLPAL_Understand_Sidecar.json from the same module the
// kiosk bridge uses, so the hosted sidecar and the local bridge stay identical.
//
//   node n8n/build-understand-workflow.mjs
//
// Reads GEMINI_MODEL, PILLPAL_AI_MIN_CONFIDENCE, PILLPAL_AI_TIMEOUT_MS and
// N8N_GEMINI_CREDENTIAL_ID from .env. The credential itself has to exist in the
// n8n instance; the public API cannot create credentials.

import '../scripts/load-env.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  badRequestNodeCode,
  buildUnderstandWorkflow,
  sanitizeNodeCode,
  statusNodeCode,
  validateNodeCode,
} from './understand-workflow.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

const model = String(env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim();
const minConfidence = Number(env.PILLPAL_AI_MIN_CONFIDENCE) || 0.6;
const timeoutMs = Number(env.PILLPAL_AI_TIMEOUT_MS) || 12000;
const geminiCredentialId = String(env.N8N_GEMINI_CREDENTIAL_ID || '').trim();

if (!geminiCredentialId) {
  console.error('N8N_GEMINI_CREDENTIAL_ID is missing from .env. Copy the credential id from n8n -> Credentials -> Google Gemini(PaLM) Api.');
  process.exit(1);
}

const headerAuthCredential = {
  id: 'sKKZe6liXy5SsWfl',
  name: 'Backend Service Auth Medtest',
};

const geminiCredential = {
  id: geminiCredentialId,
  name: String(env.N8N_GEMINI_CREDENTIAL_NAME || 'Google Gemini(PaLM) Api account'),
};

const codes = {
  sanitize: await sanitizeNodeCode(minConfidence),
  validate: await validateNodeCode(),
  badRequest: await badRequestNodeCode(),
  status: statusNodeCode(model, minConfidence, timeoutMs),
};

const workflow = buildUnderstandWorkflow({
  model,
  minConfidence,
  timeoutMs,
  headerAuthCredential,
  geminiCredential,
  codes,
});

const outputPath = resolve(here, 'workflows/PILLPAL_Understand_Sidecar.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(`${outputPath} (${model}, min confidence ${minConfidence}, credential ${geminiCredential.name})`);
