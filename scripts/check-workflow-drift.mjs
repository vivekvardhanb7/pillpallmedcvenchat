import { loadEngineSource } from '../n8n/load-engine-source.mjs';
/**
 * Guards against the failure class that bit twice: the workflow JSON that is
 * imported into n8n drifting from the n8n/src code it is generated from.
 *
 * Usage: node scripts/check-workflow-drift.mjs
 * Exits non-zero (and prints the diff location) when the artefact is stale.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import './load-env.mjs';
import {
  badRequestNodeCode,
  sanitizeNodeCode,
  statusNodeCode,
  validateNodeCode,
} from '../n8n/understand-workflow.mjs';

const workflowPath = resolve('n8n/workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json');
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));

const codeNodes = [
  { name: 'Intake and Safety Engine', source: resolve('n8n/src/intake-and-safety-engine.js') },
  { name: 'Deterministic Product Matcher', source: resolve('n8n/src/catalog-decision.js') },
  { name: 'Build Outcome Log Row', source: resolve('n8n/src/outcome-log-payload.js') },
];

const problems = [];
const nodesByName = new Map(workflow.nodes.map(node => [node.name, node]));

for (const expected of codeNodes) {
  const node = nodesByName.get(expected.name);
  if (!node) {
    problems.push(`node "${expected.name}" is missing from the built workflow`);
    continue;
  }
  const source = await loadEngineSource(expected.source);
  if (node.parameters.jsCode !== source) {
    const embedded = node.parameters.jsCode || '';
    problems.push(
      `"${expected.name}" is stale:\n`
      + `    source  ${expected.source} (${source.length} chars, ${source.split('\n').length} lines)\n`
      + `    embedded ${embedded.length} chars, ${embedded.split('\n').length} lines\n`
      + `    first difference at character ${firstDiff(source, embedded)}\n`
      + `    run: npm run build:workflow, then re-import the JSON into n8n`,
    );
  }
}

const webhook = nodesByName.get('Chat Turn Webhook');
if (!webhook) {
  problems.push('node "Chat Turn Webhook" is missing');
} else {
  if (webhook.parameters.authentication !== 'headerAuth') {
    problems.push('Chat Turn Webhook must use authentication: headerAuth (the instance blocks $env)');
  }
  if (!webhook.credentials?.httpHeaderAuth?.id) {
    problems.push('Chat Turn Webhook has no bound Header Auth credential id');
  }
}

if (JSON.stringify(workflow).includes('$env')) {
  problems.push('the built workflow still references $env, which this n8n instance denies');
}

for (const node of workflow.nodes) {
  if (!node.credentials) continue;
  for (const [type, credential] of Object.entries(node.credentials)) {
    if (!credential.id || !credential.name) {
      problems.push(`${node.name}: ${type} credential is not bound to a real instance credential`);
    }
  }
}

const logger = workflow.nodes.filter(node => node.name === 'Insert Outcome Log Row');
if (!logger.length) {
  problems.push('no "Insert Outcome Log Row" node - decisions are not being recorded');
} else {
  const node = logger[0];
  if (node.onError !== 'continueRegularOutput') {
    problems.push('Insert Outcome Log Row must keep onError: continueRegularOutput so logging can never break the kiosk');
  }
  if (!/\/rest\/v1\/kiosk_outcome_log$/.test(node.parameters.url || '')) {
    problems.push(`Insert Outcome Log Row posts to ${node.parameters.url}, not /rest/v1/kiosk_outcome_log`);
  }
  if (!node.credentials?.supabaseApi?.id) {
    problems.push('Insert Outcome Log Row has no bound Supabase credential');
  }
  if (node.type !== 'n8n-nodes-base.httpRequest') {
    problems.push('Insert Outcome Log Row must be an HTTP Request node - the Supabase insert node cannot be configured from generated JSON');
  }
  if (!workflow.nodes.some(built => built.name === 'Build Outcome Log Row')) {
    problems.push('no "Build Outcome Log Row" node - the outcome row is not sanitised before it is posted');
  }
}

// The sidecar is generated from web/answer-understanding.js, so the settings are
// read back out of the built artefact before regenerating: what this check cares
// about is "the module changed and nobody rebuilt", not what .env happened to say.
const sidecarPath = resolve('n8n/workflows/PILLPAL_Understand_Sidecar.json');
let sidecar = null;
try {
  sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
} catch (_) {
  problems.push(`${sidecarPath} is missing - run npm run build:sidecar`);
}

const sidecarNodes = new Map((sidecar?.nodes || []).map(node => [node.name, node]));
const askGemini = sidecarNodes.get('Ask Gemini');
const sidecarSettings = {
  model: String(askGemini?.parameters?.url || '').match(/models\/([^/]+):generateContent/)?.[1],
  minConfidence: String(sidecarNodes.get('Sanitize Request')?.parameters?.jsCode || '').match(/minConfidence: ([0-9.]+)/)?.[1],
  timeoutMs: askGemini?.parameters?.options?.timeout,
};

const expectedSidecarCode = {
  'Sanitize Request': sidecarSettings.model ? await sanitizeNodeCode(sidecarSettings.minConfidence) : null,
  'Validate Understanding': sidecarSettings.model ? await validateNodeCode() : null,
  'Refuse Bad Request': sidecarSettings.model ? await badRequestNodeCode() : null,
  'Report Status': sidecarSettings.model ? statusNodeCode(sidecarSettings.model, sidecarSettings.minConfidence, sidecarSettings.timeoutMs) : null,
};

if (sidecar) {
  if (!sidecarSettings.model) {
    problems.push('Ask Gemini is missing or does not POST to .../models/<model>:generateContent');
  }
  for (const [name, expected] of Object.entries(expectedSidecarCode)) {
    const node = sidecarNodes.get(name);
    if (!node) {
      problems.push(`sidecar node "${name}" is missing`);
      continue;
    }
    if (expected !== null && node.parameters.jsCode !== expected) {
      problems.push(
        `sidecar "${name}" is stale (first difference at character ${firstDiff(expected, node.parameters.jsCode || '')}) - run npm run build:sidecar`,
      );
    }
  }

  for (const name of ['Understand Webhook', 'Status Webhook']) {
    const node = sidecarNodes.get(name);
    if (!node) {
      problems.push(`sidecar node "${name}" is missing`);
      continue;
    }
    if (node.parameters.authentication !== 'headerAuth') {
      problems.push(`${name} must use headerAuth - an unauthenticated Gemini proxy invites abuse`);
    }
    if (!node.credentials?.httpHeaderAuth?.id) {
      problems.push(`${name} has no bound Header Auth credential id`);
    }
  }

  if (askGemini) {
    if (askGemini.onError !== 'continueRegularOutput') {
      problems.push('Ask Gemini must keep onError: continueRegularOutput so a provider outage cannot break a kiosk turn');
    }
    if (askGemini.retryOnFail !== false) {
      problems.push('Ask Gemini must not retry - a retried provider call is billed twice');
    }
    if (askGemini.parameters?.nodeCredentialType !== 'googlePalmApi' || !askGemini.credentials?.googlePalmApi?.id) {
      problems.push('Ask Gemini has no bound Google Gemini(PaLM) credential - the key must live in n8n, not in the workflow');
    }
  }

  if (JSON.stringify(sidecar).includes('$env')) {
    problems.push('the sidecar workflow still references $env, which this n8n instance denies');
  }
  if (sidecar.nodes.some(node => node.type === 'n8n-nodes-base.supabase')) {
    problems.push('the sidecar should not touch Supabase - it only understands one answer');
  }
}

function firstDiff(a, b) {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) if (a[i] !== b[i]) return i;
  return limit;
}

if (process.argv.includes('--live')) {
  const base = String(process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
  const key = process.env.N8N_API_KEY || '';
  const deployedId = process.env.N8N_WORKFLOW_ID || '';
  const sidecarId = String(process.env.N8N_UNDERSTAND_WORKFLOW_ID || '').trim();
  if (!base || !key || !deployedId) {
    console.error('--live needs N8N_BASE_URL, N8N_API_KEY and N8N_WORKFLOW_ID in .env');
    process.exitCode = 1;
  } else {
    const response = await fetch(`${base}/api/v1/workflows/${deployedId}`, { headers: { 'X-N8N-API-KEY': key } });
    if (!response.ok) {
      console.error(`n8n API returned HTTP ${response.status} for workflow ${deployedId}`);
      process.exitCode = 1;
    } else {
      const deployed = await response.json();
      const deployedByName = new Map(deployed.nodes.map(node => [node.name, node]));
      console.log(`Deployed ${deployed.id} "${deployed.name}" active=${deployed.active}, updated ${deployed.updatedAt}`);
      for (const expected of codeNodes) {
        const live = deployedByName.get(expected.name);
        const source = await loadEngineSource(expected.source);
        if (!live) {
          problems.push(`deployed workflow has no "${expected.name}" node`);
          continue;
        }
        const same = (live.parameters.jsCode || '').replace(/\r\n/g, '\n').trim() === source.replace(/\r\n/g, '\n').trim();
        console.log(`  ${same ? 'MATCH' : 'DIFFER'}  ${expected.name}`);
        if (!same) problems.push(`the ${expected.name} node deployed in n8n differs from ${expected.source} - re-import or push the built JSON`);
      }
      if (!deployedByName.get('Insert Outcome Log Row')) {
        problems.push('the deployed workflow has no "Insert Outcome Log Row" node, so outcomes are not logged');
      }
    }

    if (sidecarId && sidecar) {
      const sidecarResponse = await fetch(`${base}/api/v1/workflows/${sidecarId}`, { headers: { 'X-N8N-API-KEY': key } });
      if (!sidecarResponse.ok) {
        problems.push(`n8n API returned HTTP ${sidecarResponse.status} for sidecar workflow ${sidecarId}`);
      } else {
        const deployedSidecar = await sidecarResponse.json();
        const liveByName = new Map(deployedSidecar.nodes.map(node => [node.name, node]));
        console.log(`Deployed ${deployedSidecar.id} "${deployedSidecar.name}" active=${deployedSidecar.active}, updated ${deployedSidecar.updatedAt}`);
        for (const [name, expected] of Object.entries(expectedSidecarCode)) {
          const live = liveByName.get(name);
          if (!live) {
            problems.push(`deployed sidecar has no "${name}" node`);
            continue;
          }
          const same = expected !== null
            && (live.parameters.jsCode || '').replace(/\r\n/g, '\n').trim() === expected.trim();
          console.log(`  ${same ? 'MATCH' : 'DIFFER'}  sidecar/${name}`);
          if (!same) problems.push(`the deployed sidecar's "${name}" node differs from the generated code - push n8n/workflows/PILLPAL_Understand_Sidecar.json`);
        }
        const liveAsk = liveByName.get('Ask Gemini');
        if (!liveAsk?.credentials?.googlePalmApi?.id) {
          problems.push('the deployed sidecar has no Gemini credential bound - the provider call will fail');
        } else if (!deployedSidecar.active) {
          problems.push('the deployed sidecar is inactive, so /webhook/pillpal-understand returns 404');
        }
      }
    }
  }
}

if (problems.length) {
  console.error('Workflow drift detected:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Workflow JSON matches n8n/src (${workflow.nodes.length} nodes, no $env, all credentials bound).`);
}
