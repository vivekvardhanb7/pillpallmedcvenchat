import { readFile } from 'node:fs/promises';

// Import-free bundle for n8n and the local adapter; one policy source for both.
export async function loadEngineSource(path) {
  const source = await readFile(path, 'utf8');
  if (!source.includes('/* @shared-safety-policy */')) return source;
  const policy = await readFile(new URL('../web/safety-policy.js', import.meta.url), 'utf8');
  return source.replace('/* @shared-safety-policy */', policy.replace(/^export /gm, ''));
}
