/**
 * Guards against the failure class that bit twice: the workflow JSON that is
 * imported into n8n drifting from the n8n/src code it is generated from.
 *
 * Usage: node scripts/check-workflow-drift.mjs
 * Exits non-zero (and prints the diff location) when the artefact is stale.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workflowPath = resolve('n8n/workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json');
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));

const codeNodes = [
  { name: 'Intake and Safety Engine', source: resolve('n8n/src/intake-and-safety-engine.js') },
  { name: 'Deterministic Product Matcher', source: resolve('n8n/src/catalog-decision.js') },
];

const problems = [];
const nodesByName = new Map(workflow.nodes.map(node => [node.name, node]));

for (const expected of codeNodes) {
  const node = nodesByName.get(expected.name);
  if (!node) {
    problems.push(`node "${expected.name}" is missing from the built workflow`);
    continue;
  }
  const source = await readFile(expected.source, 'utf8');
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

const terminal = workflow.nodes.filter(node => node.name === 'Log Outcome (anonymised)');
if (!terminal.length) {
  problems.push('no "Log Outcome (anonymised)" node - decisions are not being recorded');
} else if (terminal[0].onError !== 'continueRegularOutput') {
  problems.push('Log Outcome (anonymised) must keep onError: continueRegularOutput so logging can never break the kiosk');
}

function firstDiff(a, b) {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) if (a[i] !== b[i]) return i;
  return limit;
}

if (problems.length) {
  console.error('Workflow drift detected:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Workflow JSON matches n8n/src (${workflow.nodes.length} nodes, no $env, all credentials bound).`);
}
