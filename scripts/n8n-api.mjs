// n8n REST API helper. Reads N8N_BASE_URL and N8N_API_KEY from .env so the key
// never appears on a command line or in chat output.
//
//   node scripts/n8n-api.mjs workflows
//   node scripts/n8n-api.mjs credentials
//   node scripts/n8n-api.mjs get <workflowId>            # JSON to stdout
//   node scripts/n8n-api.mjs executions <workflowId> [n]  # last n runs
//   node scripts/n8n-api.mjs execution <executionId>
//   node scripts/n8n-api.mjs push <workflowId> <file.json> --yes
//   node scripts/n8n-api.mjs create <file.json> --yes
//   node scripts/n8n-api.mjs activate <workflowId> | deactivate <workflowId>

import './load-env.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');

const base = String(process.env.N8N_BASE_URL || '').trim().replace(/\/+$/, '');
const key = String(process.env.N8N_API_KEY || '').trim();

if (!base || !key) {
  console.error('Missing N8N_BASE_URL or N8N_API_KEY. Put them in .env (never on the command line).');
  process.exit(1);
}

const [, , command, ...rest] = process.argv;
const args = rest.filter(arg => arg !== '--yes');
const confirmed = rest.includes('--yes');

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`${method} ${path} -> HTTP ${response.status}`);
    console.error(text.slice(0, 1200));
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

function summarizeNode(node) {
  const problems = [];
  if (node.type === 'n8n-nodes-base.supabase') problems.push(`table=${node.parameters?.tableId}`);
  if (node.type === 'n8n-nodes-base.if') problems.push(`filter=${JSON.stringify(node.parameters?.conditions?.conditions?.map(c => c.leftValue))}`);
  if (node.type === 'n8n-nodes-base.code') problems.push(`${(node.parameters?.jsCode || '').split('\n').length} lines`);
  const credentialNames = Object.entries(node.credentials || {}).map(([k, v]) => `${k}:${v.name}#${v.id}`);
  return `  - ${node.name} [${node.type}:${node.typeVersion}] ${problems.join(' ')}${credentialNames.length ? ` creds{${credentialNames.join(', ')}}` : ''}${node.disabled ? ' DISABLED' : ''}`;
}

switch (command) {
  case 'workflows': {
    const list = await call('GET', '/api/v1/workflows?limit=100');
    for (const workflow of list.data) {
      console.log(`${workflow.id}  active=${workflow.active}  ${workflow.name}  (${workflow.nodeCount ?? '?'} nodes)`);
    }
    break;
  }
  case 'credentials': {
    const list = await call('GET', '/api/v1/credentials?limit=100');
    for (const credential of list.data) console.log(`${credential.id}  ${credential.name}  [${credential.type}]`);
    break;
  }
  case 'get': {
    const workflow = await call('GET', `/api/v1/workflows/${args[0]}`);
    if (process.argv.includes('--nodes')) {
      console.log(`${workflow.id}  ${workflow.name}  active=${workflow.active}  triggers=${(workflow.triggerNodes || []).join(',')}`);
      for (const node of workflow.nodes) console.log(summarizeNode(node));
      for (const [source, targets] of Object.entries(workflow.connections || {})) {
        for (const branch of targets.main || []) {
          for (const target of branch || []) console.log(`  ${source} -> ${target.node}`);
        }
      }
    } else {
      console.log(JSON.stringify(workflow, null, 2));
    }
    break;
  }
  case 'executions': {
    const limit = Number(args[1]) || 10;
    const list = await call('GET', `/api/v1/executions?workflowId=${args[0]}&limit=${limit}`);
    if (!list.data.length) console.log('no executions found');
    for (const execution of list.data) {
      console.log(`${execution.id}  ${execution.status}  ${execution.finishedDate || ''}  mode=${execution.mode}  ${execution.workflowName || ''}`);
    }
    break;
  }
  case 'execution': {
    const detail = await call('GET', `/api/v1/executions/${args[0]}?includeData=true`);
    console.log(`status=${detail.status} error=${detail.data?.resultData?.error?.message || detail.data?.resultData?.error?.description || 'none'}`);
    const runData = detail.data?.resultData?.runData || {};
    for (const [node, runs] of Object.entries(runData)) {
      for (const run of runs) {
        const error = run.error ? ` ERROR: ${run.error.message || JSON.stringify(run.error).slice(0, 300)}` : '';
        const items = run.data?.json ? 1 : (run.data?.result?.length ?? 0);
        const preview = run.data?.result?.[0]?.json
          ? ` out=${JSON.stringify(run.data.result[0].json).slice(0, 260)}`
          : '';
        console.log(`  ${node} [${run.startedAt}] ${run.executionStatus} items~${items}${error}${preview}`);
      }
    }
    if (!Object.keys(runData).length) console.log('  (no node run data)');
    break;
  }
  case 'push': {
    if (!confirmed) {
      console.error('Refusing to modify a live workflow without --yes.');
      process.exit(1);
    }
    const body = JSON.parse(await readFile(resolve(projectRoot, args[1]), 'utf8'));
    const updated = await call('PUT', `/api/v1/workflows/${args[0]}`, {
      name: body.name,
      nodes: body.nodes,
      connections: body.connections,
      settings: body.settings || {},
    });
    console.log(`pushed ${updated.id} (${updated.name}) active=${updated.active}`);
    break;
  }
  case 'create': {
    if (!confirmed) {
      console.error('Refusing to create a workflow without --yes.');
      process.exit(1);
    }
    const body = JSON.parse(await readFile(resolve(projectRoot, args[0]), 'utf8'));
    const created = await call('POST', '/api/v1/workflows', {
      name: body.name,
      nodes: body.nodes,
      connections: body.connections,
      settings: body.settings || {},
    });
    console.log(`created ${created.id} (${created.name}) active=${created.active}`);
    break;
  }
  case 'activate':
  case 'deactivate': {
    if (!confirmed) {
      console.error(`Refusing to ${command} a workflow without --yes.`);
      process.exit(1);
    }
    const path = command === 'activate' ? 'activate' : 'deactivate';
    const result = await call('POST', `/api/v1/workflows/${args[0]}/${path}`);
    console.log(`${args[0]} active=${result.active}`);
    break;
  }
  default:
    console.error(`Unknown command: ${command || '(none)'}`);
    console.error('Use: workflows | credentials | get | executions | execution | push | create | activate | deactivate');
    process.exit(1);
}
