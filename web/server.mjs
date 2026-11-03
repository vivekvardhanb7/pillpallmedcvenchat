import { createServer } from 'node:http';
import { readFile, stat, mkdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCall,
  extractModelText,
  readProviderConfig,
  sanitizeRequest,
  statusPayload,
  validateModelAnswer,
} from './answer-understanding.js';

const webRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const projectRoot = resolve(webRoot, '..');

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(resolve(projectRoot, '.env'));
  } catch (_) {
    // .env is optional.
  }
}

const port = Number(process.env.PORT || 8080);
const MAX_TTS_CHARS = 800;
const MAX_TTS_BODY_BYTES = 8 * 1024;

function envPath(name, fallback) {
  const value = process.env[name];
  return value ? resolve(projectRoot, value) : fallback;
}

function optionalPositiveNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

const piperBin = envPath(
  'PIPER_BIN',
  join(projectRoot, 'tools', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper'),
);
const defaultPiperModel = envPath(
  'PIPER_MODEL',
  join(projectRoot, 'tools', 'piper', 'voices', 'en_US-hfc_female-medium.onnx'),
);

function parsePiperModels(raw) {
  const models = {
    en: defaultPiperModel,
    de: join(projectRoot, 'tools', 'piper', 'voices', 'de_DE-thorsten-medium.onnx'),
  };
  if (!raw) return models;
  for (const entry of String(raw).split(/[,;]/)) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const code = entry.slice(0, separator).trim().toLowerCase().split('-')[0];
    const modelPath = entry.slice(separator + 1).trim();
    if (/^[a-z]{2}$/.test(code) && modelPath) models[code] = resolve(projectRoot, modelPath);
  }
  return models;
}

const piperModels = parsePiperModels(process.env.PIPER_MODELS);

function languageCode(value) {
  const base = String(value || 'en').toLowerCase().split('-')[0];
  return /^[a-z]{2}$/.test(base) ? base : 'en';
}

function modelForLanguage(value) {
  return piperModels[languageCode(value)] || null;
}

function modelStatus(code) {
  const model = piperModels[code] || null;
  const binary = existsSync(piperBin);
  const modelFile = Boolean(model && existsSync(model));
  const config = Boolean(model && existsSync(`${model}.json`));
  return {
    language: code,
    available: binary && modelFile && config,
    voice: model ? basename(model).replace(/\.onnx$/i, '') : null,
    binary,
    model: modelFile,
    config,
  };
}

const piperLengthScale = optionalPositiveNumber(process.env.PIPER_LENGTH_SCALE);
const piperTimeoutMs = optionalPositiveNumber(process.env.PIPER_TIMEOUT_MS) || 20000;
const ttsCacheDir = envPath('PIPER_CACHE_DIR', join(projectRoot, 'tmp', 'tts-cache'));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function ttsStatus() {
  const models = Object.fromEntries(Object.keys(piperModels).map(code => [code, modelStatus(code)]));
  const primary = models.en || Object.values(models)[0] || null;
  return {
    available: Boolean(primary?.available),
    voice: primary?.voice || null,
    binary: existsSync(piperBin),
    model: Boolean(primary?.model),
    config: Boolean(primary?.config),
    piperBin,
    models,
  };
}

function sanitizeTtsText(value) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

async function readJsonBody(request, limitBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

const ttsJobs = new Map();
const MAX_TTS_RUNNING = 2;
let ttsRunning = 0;
const ttsWaiters = [];

function acquireTtsSlot() {
  if (ttsRunning < MAX_TTS_RUNNING) {
    ttsRunning += 1;
    return Promise.resolve();
  }
  return new Promise(resolvePromise => ttsWaiters.push(resolvePromise));
}

function releaseTtsSlot() {
  if (ttsWaiters.length) {
    ttsWaiters.shift()();
    return;
  }
  ttsRunning = Math.max(0, ttsRunning - 1);
}

function synthesize(text, language = 'en') {
  const model = modelForLanguage(language);
  if (!model) throw new Error(`No voice model is configured for ${languageCode(language)}`);
  const key = createHash('sha256')
    .update(`${model}\n${piperLengthScale ?? 'default'}\n${text}`)
    .digest('hex');
  if (ttsJobs.has(key)) return ttsJobs.get(key);

  const cachePath = join(ttsCacheDir, `${key}.wav`);
  const job = readFile(cachePath)
    .catch(() => null)
    .then(async cached => {
      if (cached) return cached;
      await mkdir(ttsCacheDir, { recursive: true });
      const temporaryPath = join(ttsCacheDir, `.${key}.${randomUUID()}.tmp`);
      await acquireTtsSlot();
      try {
        await runPiper(text, temporaryPath, model);
        await rename(temporaryPath, cachePath);
        return await readFile(cachePath);
      } finally {
        releaseTtsSlot();
        await rm(temporaryPath, { force: true }).catch(() => {});
      }
    })
    .finally(() => ttsJobs.delete(key));

  ttsJobs.set(key, job);
  return job;
}

function runPiper(text, outputPath, model) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['--model', model, '--output_file', outputPath];
    if (piperLengthScale) args.push('--length_scale', String(piperLengthScale));

    const child = spawn(piperBin, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error('Voice synthesis timed out'));
    }, piperTimeoutMs);

    const finish = callback => {
      clearTimeout(timer);
      callback();
    };

    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on('error', error => finish(() => rejectPromise(error)));
    child.on('close', code => finish(() => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`Piper exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    }));
    child.stdin.on('error', () => {});
    child.stdin.end(`${text}\n`);
  });
}

async function handleTtsRequest(request, response) {
  let payload;
  try {
    payload = await readJsonBody(request, MAX_TTS_BODY_BYTES);
  } catch (error) {
    const tooLarge = error.statusCode === 413;
    sendJson(response, tooLarge ? 413 : 400, {
      error: tooLarge ? 'TTS text is too long.' : 'Invalid JSON body.',
      code: 'bad_request',
    });
    return;
  }

  const text = sanitizeTtsText(payload.text);
  if (!text) {
    sendJson(response, 400, { error: 'A non-empty text field is required.', code: 'bad_request' });
    return;
  }

  const language = languageCode(payload.language);
  const status = ttsStatus();
  const languageStatus = status.models[language];
  if (!languageStatus?.available) {
    sendJson(response, 503, {
      error: `The local neural voice is not installed for ${language}.`,
      code: 'tts_language_unavailable',
      language,
      voice: languageStatus?.voice || null,
      binary: status.binary,
      model: Boolean(languageStatus?.model),
      config: Boolean(languageStatus?.config),
      models: Object.fromEntries(Object.entries(status.models).map(([code, model]) => [code, model.available])),
    });
    return;
  }

  try {
    if (ttsJobs.size >= 8) {
      sendJson(response, 503, { error: 'The local voice is busy. Please try again shortly.', code: 'tts_busy' });
      return;
    }
    const audio = await synthesize(text, language);
    response.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(audio);
  } catch (error) {
    console.error('TTS synthesis failed:', error.message);
    sendJson(response, 502, {
      error: 'The local voice could not synthesize this text.',
      code: 'tts_failed',
    });
  }
}

const aiConfig = readProviderConfig(process.env);
const MAX_UNDERSTAND_BODY_BYTES = 8 * 1024;
const MAX_AI_RUNNING = 2;
let aiRunning = 0;

function logUnderstandingResult(context, result) {
  if (process.env.PILLPAL_AI_LOG_TRANSCRIPT === '1') {
    console.log(`[understand] ${context.questionId} matched=${result.matched} reason=${result.reason || 'ok'} confidence=${result.confidence} transcript="${context.transcript}"`);
    return;
  }
  console.log(`[understand] ${context.questionId} matched=${result.matched} reason=${result.reason || 'ok'} confidence=${result.confidence}`);
}

async function handleUnderstandRequest(request, response) {
  if (!aiConfig.usable) {
    sendJson(response, 503, {
      error: 'Spoken-answer understanding is switched off on this kiosk.',
      code: 'ai_unavailable',
      ...statusPayload(aiConfig),
    });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request, MAX_UNDERSTAND_BODY_BYTES);
  } catch (error) {
    const tooLarge = error.statusCode === 413;
    sendJson(response, tooLarge ? 413 : 400, {
      error: tooLarge ? 'Request body is too large.' : 'Invalid JSON body.',
      code: 'bad_request',
    });
    return;
  }

  const prepared = sanitizeRequest(payload, aiConfig);
  if (!prepared.ok) {
    sendJson(response, 400, { error: prepared.error, code: 'bad_request' });
    return;
  }
  const context = prepared.context;

  if (aiRunning >= MAX_AI_RUNNING) {
    sendJson(response, 503, { error: 'The answer helper is busy.', code: 'ai_busy' });
    return;
  }

  const call = buildCall(aiConfig, context);
  aiRunning += 1;
  try {
    const upstream = await fetch(call.url, {
      method: 'POST',
      headers: call.headers,
      body: JSON.stringify(call.body),
      signal: AbortSignal.timeout(aiConfig.timeoutMs),
    });
    if (!upstream.ok) {
      logUnderstandingResult(context, { matched: false, reason: `http_${upstream.status}`, confidence: 0 });
      sendJson(response, 502, { error: 'The answer helper is not responding.', code: 'ai_failed' });
      return;
    }
    const modelText = extractModelText(call.provider, await upstream.json());
    const result = validateModelAnswer(modelText, context);
    logUnderstandingResult(context, result);
    sendJson(response, 200, {
      matched: result.matched,
      value: result.matched ? result.value : null,
      label: result.matched ? result.label : null,
      confidence: result.confidence,
      reason: result.matched ? null : result.reason,
      provider: aiConfig.provider,
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    logUnderstandingResult(context, { matched: false, reason: timedOut ? 'timeout' : 'unreachable', confidence: 0 });
    sendJson(response, 503, {
      error: timedOut ? 'The answer helper took too long.' : 'The answer helper could not be reached.',
      code: timedOut ? 'ai_timeout' : 'ai_unreachable',
    });
  } finally {
    aiRunning -= 1;
  }
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safeRelative = normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, '');
  const filePath = resolve(join(webRoot, safeRelative));
  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${sep}`)) throw new Error('Invalid path');
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('Not a file');
  const data = await readFile(filePath);
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(data);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');

    if (url.pathname === '/api/tts') {
      if (request.method === 'GET') return sendJson(response, 200, ttsStatus());
      if (request.method === 'POST') return await handleTtsRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/understand') {
      if (request.method === 'GET') return sendJson(response, 200, statusPayload(aiConfig));
      if (request.method === 'POST') return await handleUnderstandRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      return response.end();
    }

    return await serveStatic(url.pathname, response);
  } catch (_) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`PILLPAL touchscreen running at http://localhost:${port}`);
  const status = ttsStatus();
  const installed = Object.values(status.models).filter(model => model.available);
  if (installed.length) {
    console.log(`Neural voices ready: ${installed.map(model => `${model.language}=${model.voice}`).join(', ')}`);
    synthesize('Hello, how can I help you today?', 'en').catch(error => {
      console.warn(`Voice warm-up failed: ${error.message}`);
    });
  } else {
    console.warn(`Neural voice not installed. The browser voice will be used as fallback.`);
    console.warn(`  PIPER_BIN: ${status.piperBin} (${status.binary ? 'found' : 'missing'})`);
  }
  for (const model of Object.values(status.models)) {
    if (!model.available) console.warn(`  ${model.language} voice unavailable (model ${model.model ? 'found' : 'missing'}, config ${model.config ? 'found' : 'missing'})`);
  }
  const ai = statusPayload(aiConfig);
  if (ai.available) console.log(`Spoken-answer understanding: ${ai.provider} (${ai.model}, min confidence ${ai.min_confidence}, ${ai.timeout_ms} ms)`);
  else console.log(`Spoken-answer understanding: off${ai.note ? ` (${ai.note})` : ''}. Voice answers use the deterministic mapper only.`);
});
