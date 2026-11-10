import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Official Piper voice repository, pinned revision. Dataset license: CC0.
// See the downloaded MODEL_CARD; this is a voice asset, not a medical model.
const revision = 'e7229f7d33a10e145e109b886d661984201ac3c4';
const base = `https://huggingface.co/rhasspy/piper-voices/resolve/${revision}/de/de_DE/kerstin/low`;
const directory = fileURLToPath(new URL('../tools/piper/voices/', import.meta.url));
const files = [
  { name: 'de_DE-kerstin-low.onnx', size: 63104526, algorithm: 'sha256', hash: 'd352a7641892cebf2903859af94e9ba81a141110215fe3943bcda7f7da401b7a' },
  { name: 'de_DE-kerstin-low.onnx.json', size: 4158, algorithm: 'git-sha1', hash: 'b673a5cfc6c61aa724c5a2526cd416db385b7268' },
  { name: 'MODEL_CARD', target: 'de_DE-kerstin-low.MODEL_CARD', size: 272, algorithm: 'git-sha1', hash: '2da47e36d5507784368e1d4dc6b9e7394e6cc3c8' },
];
function check(bytes, file) {
  const hash = file.algorithm === 'git-sha1'
    ? createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    : createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== file.size || hash !== file.hash) throw new Error(`Voice asset integrity check failed: ${file.name}`);
}
await mkdir(directory, { recursive: true });
for (const file of files) {
  const target = resolve(directory, file.target || file.name);
  let existing;
  try { existing = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    check(existing, file);
    console.log(`Verified existing ${file.name}`);
    continue;
  }
  if (process.argv.includes('--check')) throw new Error(`Missing voice asset: ${file.name}`);
  const response = await fetch(`${base}/${file.name}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Voice download returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  check(bytes, file);
  const partial = `${target}.partial`;
  try { await writeFile(partial, bytes); await rename(partial, target); }
  finally { await unlink(partial).catch(() => {}); }
  console.log(`Installed and verified ${file.name}`);
}
