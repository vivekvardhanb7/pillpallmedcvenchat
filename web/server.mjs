import { createSessionManager } from './session-manager.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile, stat, mkdir, rename, rm } from 'node:fs/promises';
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
import {
  processChatTurn,
  searchCatalog,
  findAlternatives,
  validateCombination,
  catalogReadiness,
} from './local-engine.mjs';

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
const deploymentCountry = process.env.PILLPAL_COUNTRY_CODE || 'DE';
if (!/^[A-Z]{2}$/.test(deploymentCountry)) throw new Error('Invalid PILLPAL_COUNTRY_CODE');
const handleSessionTurn = createSessionManager(processChatTurn, { country: deploymentCountry });
const MAX_TTS_CHARS = 800;
const MAX_TTS_BODY_BYTES = 8 * 1024;
const MAX_TRANSCRIBE_BODY_BYTES = 6 * 1024 * 1024;

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
    de: join(projectRoot, 'tools', 'piper', 'voices', 'de_DE-kerstin-low.onnx'),
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
const geminiTtsModel = String(process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts').trim();
const geminiTtsVoice = String(process.env.GEMINI_TTS_VOICE || 'Sulafat').trim();
const geminiTtsApiKey = String(process.env.GEMINI_API_KEY || '').trim();
const geminiCloudEnabled = process.env.GEMINI_CLOUD_ENABLED !== '0';
const geminiTtsCacheDir = envPath('GEMINI_TTS_CACHE_DIR', join(projectRoot, 'tmp', 'gemini-tts-cache'));
const whisperBin = envPath('WHISPER_BIN', join(projectRoot, 'tools', 'whisper', 'Release', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'));
const whisperModel = envPath('WHISPER_MODEL', join(projectRoot, 'tools', 'whisper', 'models', 'ggml-base.bin'));
const whisperTimeoutMs = optionalPositiveNumber(process.env.WHISPER_TIMEOUT_MS) || 30000;
const whisperTranslateDefault = process.env.WHISPER_TRANSLATE === '1';
const whisperTempDir = envPath('WHISPER_TEMP_DIR', join(projectRoot, 'tmp', 'whisper'));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
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

function geminiTtsStatus() {
  const available = Boolean(geminiCloudEnabled && geminiTtsApiKey && geminiTtsModel && geminiTtsVoice);
  return {
    available,
    provider: available ? 'gemini-tts' : 'off',
    model: available ? geminiTtsModel : null,
    voice: available ? geminiTtsVoice : null,
    gender: available ? 'female' : null,
    models: {
      en: { available, voice: available ? geminiTtsVoice : null },
      de: { available, voice: available ? geminiTtsVoice : null },
    },
  };
}

function sanitizeTtsText(value) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

async function readRawBody(request, limitBytes) {
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
  return Buffer.concat(chunks);
}

function whisperStatus() {
  const available = existsSync(whisperBin) && existsSync(whisperModel);
  return {
    available,
    provider: available ? 'whisper.cpp' : 'off',
    model: available ? basename(whisperModel) : null,
    local: true,
  };
}

async function handleTranscribeRequest(request, response, url) {
  if (!whisperStatus().available) return sendJson(response, 503, { error: 'Local Whisper is not installed.', code: 'local_whisper_unavailable' });
  let audio;
  try {
    audio = await readRawBody(request, MAX_TRANSCRIBE_BODY_BYTES);
  } catch (error) {
    return sendJson(response, error.statusCode === 413 ? 413 : 400, { error: 'Invalid audio request.', code: 'bad_audio' });
  }
  if (audio.length < 1000 || audio.subarray(0, 4).toString('ascii') !== 'RIFF') {
    return sendJson(response, 400, { error: 'A WAV recording is required.', code: 'bad_audio' });
  }
  await mkdir(whisperTempDir, { recursive: true });
  const id = randomUUID();
  const inputPath = join(whisperTempDir, `${id}.wav`);
  const outputBase = join(whisperTempDir, id);
  const outputPath = `${outputBase}.txt`;
  await writeFile(inputPath, audio);
  const requestedLanguage = languageCode(url.searchParams.get('language') || 'en');
  const language = url.searchParams.get('language') === 'auto' ? 'auto' : requestedLanguage;
  // An explicit client choice must override the legacy environment default.
  const translate = url.searchParams.has('translate')
    ? url.searchParams.get('translate') === '1'
    : whisperTranslateDefault;
  try {
    await new Promise((resolvePromise, rejectPromise) => {
      const args = ['-m', whisperModel, '-f', inputPath, '-l', language, '-t', '6', '-nt', '-np', '-otxt', '-of', outputBase];
      if (translate) args.push('-tr');
      const child = spawn(whisperBin, args, { cwd: join(projectRoot, 'tools', 'whisper', 'Release'), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      const timer = setTimeout(() => { child.kill(); rejectPromise(new Error('Local transcription timed out')); }, whisperTimeoutMs);
      child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-2000); });
      child.on('error', error => { clearTimeout(timer); rejectPromise(error); });
      child.on('close', code => {
        clearTimeout(timer);
        if (code === 0) resolvePromise();
        else rejectPromise(new Error(`whisper.cpp exited with ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
      });
    });
    const transcript = String(await readFile(outputPath, 'utf8')).replace(/\s+/g, ' ').trim();
    if (!transcript) return sendJson(response, 422, { error: 'No speech was identified.', code: 'no_speech' });
    return sendJson(response, 200, { transcript, provider: 'whisper.cpp', local: true, translated_to_english: translate });
  } catch (error) {
    return sendJson(response, 500, { error: error.message, code: 'local_whisper_failed' });
  } finally {
    await Promise.all([rm(inputPath, { force: true }), rm(outputPath, { force: true })]);
  }
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

function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const geminiTtsJobs = new Map();
const GEMINI_TTS_WARM_PROMPTS = [
  'Hello, how can I help you?',
  'Hello, I’m your PILLPAL assistant. Tell me what is bothering you today and what you would like help with.',
  'Thank you. How old are you?',
  'How long have you been feeling this way? For example, did it start today, yesterday, or several days ago?',
  'How strong is the symptom right now: mild, moderate, or severe?',
  'For medicine safety, could pregnancy or breastfeeding apply to you? You can also say not applicable or prefer not to say.',
  'Do you have any medicine allergies, take any medicines, or have an ongoing health condition? Please say yes, no, or that you are not sure.',
  'Do you have any allergies to medicines or medicine ingredients? Please say yes, no, or not sure.',
  'Are you currently taking any medicines, including prescription and non-prescription products? Please say yes, no, or not sure.',
  'Do you have any ongoing health or medical conditions? Please say yes, no, or not sure.',
  'Thank you. I have the safety information I need. Should I check the approved products now, or would you like to start again?',
];

function synthesizeGemini(text, language = 'en') {
  const key = createHash('sha256')
    // Gemini 3.8 treats the input as a verbatim transcript. The cache version
    // prevents audio made by the old instruction-prefixed request from being
    // replayed after this correction.
    .update(`exact-text-v2\n${geminiTtsModel}\n${geminiTtsVoice}\n${language}\n${text}`)
    .digest('hex');
  if (geminiTtsJobs.has(key)) return geminiTtsJobs.get(key);
  const cachePath = join(geminiTtsCacheDir, `${key}.wav`);
  const job = readFile(cachePath)
    .catch(() => null)
    .then(async cached => {
      if (cached) return cached;
      await acquireTtsSlot();
      try {
        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiTtsModel)}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiTtsApiKey },
            body: JSON.stringify({
              // Send only words that should be spoken. Do not put delivery
              // instructions in this text: Gemini 3.8 will read them aloud.
              contents: [{ parts: [{ text }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiTtsVoice } } },
              },
            }),
            signal: AbortSignal.timeout(25000),
          },
        );
        if (!upstream.ok) throw new Error(`Gemini TTS returned HTTP ${upstream.status}`);
        const result = await upstream.json();
        const inline = result?.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
        if (!inline?.data) throw new Error('Gemini TTS returned no audio');
        const pcm = Buffer.from(inline.data, 'base64');
        const sampleRate = Number(String(inline.mimeType || '').match(/rate=(\d+)/i)?.[1] || 24000);
        const wav = /^audio\/wav/i.test(inline.mimeType || '') ? pcm : pcmToWav(pcm, sampleRate);
        await mkdir(geminiTtsCacheDir, { recursive: true });
        await writeFile(cachePath, wav);
        return wav;
      } finally {
        releaseTtsSlot();
      }
    })
    .finally(() => geminiTtsJobs.delete(key));
  geminiTtsJobs.set(key, job);
  return job;
}

async function handleGeminiTtsRequest(request, response) {
  if (!geminiTtsStatus().available) {
    sendJson(response, 503, { error: 'Gemini TTS is not configured.', code: 'tts_unavailable' });
    return;
  }
  let payload;
  try {
    payload = await readJsonBody(request, MAX_TTS_BODY_BYTES);
  } catch (error) {
    sendJson(response, error.statusCode === 413 ? 413 : 400, { error: 'Invalid TTS request.', code: 'bad_request' });
    return;
  }
  const text = sanitizeTtsText(payload.text);
  if (text.length > MAX_TTS_CHARS) return sendJson(response, 413, { error: 'Split long speech into chunks.', code: 'tts_text_too_long' });
  if (!text) {
    sendJson(response, 400, { error: 'A non-empty text field is required.', code: 'bad_request' });
    return;
  }
  if (geminiTtsJobs.size >= 8) {
    sendJson(response, 503, { error: 'The voice service is busy.', code: 'tts_busy' });
    return;
  }
  try {
    const audio = await synthesizeGemini(text, languageCode(payload.language));
    response.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-PillPal-Voice': geminiTtsVoice,
    });
    response.end(audio);
  } catch (error) {
    console.error('Gemini TTS synthesis failed:', error.message);
    sendJson(response, 502, { error: 'The Gemini voice could not synthesize this text.', code: 'tts_failed' });
  }
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
  if (text.length > MAX_TTS_CHARS) return sendJson(response, 413, { error: 'Split long speech into chunks.', code: 'tts_text_too_long' });
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
const MAX_UNDERSTAND_BODY_BYTES = 4 * 1024 * 1024;
const MAX_AI_RUNNING = 2;
let aiRunning = 0;
const translationModel = String(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
const translationCache = new Map();

function cleanTranslationText(value) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2400);
}

function parseTranslationJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  if (start < 0) return null;
  for (let end = text.length - 1; end > start; end--) {
    if (text[end] === '}') {
      try {
        const obj = JSON.parse(text.slice(start, end + 1));
        if (obj && typeof obj.translation === 'string') return cleanTranslationText(obj.translation);
      } catch (_) {}
    }
  }
  return null;
}

const LANGUAGE_NAMES = {
  te: 'Telugu', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam',
  bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi', ur: 'Urdu',
  de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
  nl: 'Dutch', tr: 'Turkish', ar: 'Arabic', ru: 'Russian', ja: 'Japanese',
  ko: 'Korean', zh: 'Chinese', en: 'English'
};

function translationStatus() {
  if (geminiCloudEnabled && geminiTtsApiKey) {
    return { available: true, provider: 'gemini', model: translationModel };
  }
  if (aiConfig.provider === 'ollama' && aiConfig.usable) {
    return { available: true, provider: 'ollama', model: aiConfig.model };
  }
  return { available: false, provider: 'off', model: null };
}

async function handleTranslateRequest(request, response) {
  if (!translationStatus().available) {
    sendJson(response, 503, { error: 'Translation is not configured.', code: 'translation_unavailable' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(request, 12 * 1024);
  } catch (error) {
    sendJson(response, error.statusCode === 413 ? 413 : 400, { error: 'Invalid translation request.', code: 'bad_request' });
    return;
  }
  const text = cleanTranslationText(body.text);
  const target = String(body.target_language || '').toLowerCase().split('-')[0];
  if (!text || !/^[a-z]{2}$/.test(target)) {
    sendJson(response, 400, { error: 'Text and a two-letter target language are required.', code: 'bad_request' });
    return;
  }
  if (target === 'en') return sendJson(response, 200, { translation: text, language: target, cached: true });
  const key = createHash('sha256').update(`${translationModel}\n${target}\n${text}`).digest('hex');
  const cached = translationCache.get(key);
  if (cached) return sendJson(response, 200, { translation: cached, language: target, cached: true });
  try {
    const langName = LANGUAGE_NAMES[target] || target;
    let translation;
    if (geminiCloudEnabled && geminiTtsApiKey) {
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(translationModel)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiTtsApiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Translate pharmacy kiosk text naturally and accurately into the target language. Preserve medicine names, active ingredients, strengths, numbers, units, dose intervals, URLs and option meaning. Return JSON only: {"translation":"..."}.' }] },
          contents: [{ role: 'user', parts: [{ text: `Target language: ${langName} (${target})\nText: ${text}` }] }],
          generationConfig: { temperature: 0, topP: 0, maxOutputTokens: 900, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (upstream.ok) {
        const parts = (await upstream.json())?.candidates?.[0]?.content?.parts;
        const raw = Array.isArray(parts) ? parts.map(part => part?.text || '').join('') : '';
        translation = parseTranslationJson(raw);
      }
    }
    if (!translation && aiConfig.provider === 'ollama') {
      const upstream = await fetch(`${aiConfig.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiConfig.model,
          stream: false,
          think: false,
          keep_alive: '30m',
          format: 'json',
          options: { temperature: 0, top_p: 0, num_predict: 900, seed: 7 },
          messages: [
            { role: 'system', content: `Translate pharmacy kiosk text exactly into ${langName}. Preserve medicine names, strengths, numbers, units, dose intervals and warnings. Return JSON only: {"translation":"..."}.` },
            { role: 'user', content: `Target language: ${langName}\nText: ${text}` },
          ],
        }),
        signal: AbortSignal.timeout(aiConfig.timeoutMs),
      });
      if (upstream.ok) {
        const rawContent = (await upstream.json())?.message?.content;
        translation = parseTranslationJson(rawContent);
      }
    }
    if (!translation) throw new Error('empty_translation');
    if (translationCache.size > 500) translationCache.clear();
    translationCache.set(key, translation);
    sendJson(response, 200, { translation, language: target, cached: false });
  } catch (_) {
    sendJson(response, 502, { error: 'Translation could not be completed.', code: 'translation_failed' });
  }
}

// Gemini Live runs directly between the kiosk browser and Google so microphone
// audio does not make an extra round trip through this server. The long-lived
// API key never leaves this process: each tap receives a constrained, one-use
// token with a five-minute lifetime.
const geminiLiveEnabled = process.env.GEMINI_LIVE_TRANSCRIBE === '1'
  && Boolean(String(process.env.GEMINI_API_KEY || '').trim());
const geminiLiveApiKey = String(process.env.GEMINI_API_KEY || '').trim();
const geminiLiveModel = 'models/gemini-3.5-transcribe-live';
const geminiLiveVocabulary = [
  'paracetamol', 'acetaminophen', 'Dolo', 'Doliprane', 'ibuprofen', 'Brufen',
  'aspirin', 'loperamide', 'Imodium', 'cetirizine', 'Zyrtec', 'loratadine',
  'xylometazoline', 'Otrivin', 'dextromethorphan', 'dimenhydrinate', 'simethicone',
];
const geminiLiveSetup = {
  model: geminiLiveModel,
  generationConfig: { responseModalities: ['TEXT'] },
  inputAudioTranscription: {
    languageCodes: [],
    customVocabulary: geminiLiveVocabulary,
    mode: 'SMART',
  },
};
const geminiLiveTokenAttempts = new Map();

function geminiLiveStatus() {
  return {
    available: geminiLiveEnabled,
    provider: geminiLiveEnabled ? 'gemini-live-transcribe' : 'off',
    model: geminiLiveEnabled ? geminiLiveModel.replace(/^models\//, '') : null,
  };
}

function allowGeminiLiveToken(request) {
  const key = String(request.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  const prior = (geminiLiveTokenAttempts.get(key) || []).filter(at => now - at < 60_000);
  // A complete safety interview can exceed six short turns in one minute.
  // Allow enough one-use tokens for a normal kiosk session while retaining a
  // per-address abuse ceiling.
  if (prior.length >= 20) return false;
  prior.push(now);
  geminiLiveTokenAttempts.set(key, prior);
  return true;
}

async function handleGeminiLiveTokenRequest(request, response) {
  if (!geminiLiveEnabled) {
    sendJson(response, 503, { error: 'Gemini Live transcription is not enabled on this kiosk.', code: 'gemini_live_unavailable', ...geminiLiveStatus() });
    return;
  }
  if (!allowGeminiLiveToken(request)) {
    sendJson(response, 429, { error: 'Please wait before starting another voice turn.', code: 'gemini_live_rate_limited' });
    return;
  }
  try {
    await readJsonBody(request, 1024);
  } catch (_) {
    sendJson(response, 400, { error: 'Invalid voice-token request.', code: 'bad_request' });
    return;
  }

  const now = Date.now();
  const payload = {
    uses: 1,
    expireTime: new Date(now + 5 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now + 60_000).toISOString(),
    liveConnectConstraints: {
      model: geminiLiveModel,
      config: {
        responseModalities: ['TEXT'],
        inputAudioTranscription: geminiLiveSetup.inputAudioTranscription,
      },
    },
  };
  const requestToken = body => fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiLiveApiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  try {
    let upstream = await requestToken(payload);
    let tokenRestricted = upstream.ok;
    if (!upstream.ok && upstream.status === 400) {
      // Some existing API keys are provisioned against an older auth-token
      // schema that does not yet accept liveConnectConstraints. Keep the Live
      // feature usable with a short-lived one-use token rather than ever
      // placing the long-lived key in browser code. Rate limiting remains in
      // force above; newer keys take the constrained branch.
      const detail = await upstream.text();
      if (/liveConnectConstraints/i.test(detail)) {
        upstream = await requestToken({
          uses: payload.uses,
          expireTime: payload.expireTime,
          newSessionExpireTime: payload.newSessionExpireTime,
        });
        tokenRestricted = false;
      } else {
        sendJson(response, 502, { error: 'Gemini Live token service is unavailable.', code: 'gemini_live_token_failed' });
        return;
      }
    }
    if (!upstream.ok) {
      sendJson(response, 502, { error: 'Gemini Live token service is unavailable.', code: 'gemini_live_token_failed' });
      return;
    }
    const token = String((await upstream.json())?.name || '').trim();
    if (!token) {
      sendJson(response, 502, { error: 'Gemini Live token service returned an invalid response.', code: 'gemini_live_token_failed' });
      return;
    }
    sendJson(response, 200, {
      token,
      endpoint: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
      setup: geminiLiveSetup,
      token_restricted: tokenRestricted,
      ...geminiLiveStatus(),
    });
  } catch (_) {
    sendJson(response, 503, { error: 'Gemini Live token service could not be reached.', code: 'gemini_live_token_unreachable' });
  }
}

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
      emergency: result.emergency || false,
      recognized_medicine: result.recognized_medicine || null,
      follow_up_question: result.follow_up_question || null,
      possible_categories: result.possible_categories || [],
      volunteered_context: result.volunteered_context || null,
      detected_language: result.detected_language || null,
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

async function handleChatTurnRequest(request, response) {
  try {
    const body = await readJsonBody(request, 64 * 1024);
    const { status, result } = await handleSessionTurn(body);
    return sendJson(response, status, result);
  } catch (error) {
    return sendJson(response, 400, {
      outcome: 'NO_SUITABLE_PRODUCT',
      message: error?.message || 'Invalid request body',
      reason_codes: ['request_error'],
      dispense_authorized: false,
    });
  }
}

async function handleCatalogSearchRequest(request, response, url) {
  try {
    let params = {};
    if (request.method === 'POST') {
      params = await readJsonBody(request, 16 * 1024);
    } else {
      params = {
        query: url.searchParams.get('q') || url.searchParams.get('query') || '',
        country: url.searchParams.get('country') || 'ALL',
        pathway: url.searchParams.get('pathway') || null,
      };
    }
    const result = await searchCatalog(params);
    return sendJson(response, 200, result);
  } catch (error) {
    return sendJson(response, 500, { error: error?.message || 'Catalog search failed' });
  }
}

async function handleAlternativesRequest(request, response, url) {
  try {
    let sku = url.searchParams.get('sku') || '';
    if (request.method === 'POST') {
      const body = await readJsonBody(request, 16 * 1024);
      sku = body.sku || sku;
    }
    const result = await findAlternatives(sku);
    return sendJson(response, 200, result);
  } catch (error) {
    return sendJson(response, 500, { error: error?.message || 'Alternative search failed' });
  }
}

async function handleCombinationValidateRequest(request, response) {
  try {
    const body = await readJsonBody(request, 16 * 1024);
    const result = await validateCombination(body.sku, body.currentMedications ?? [], body.allergies ?? [], deploymentCountry);
    return sendJson(response, 200, result);
  } catch (error) {
    return sendJson(response, error.statusCode === 413 ? 413 : 400, { error: 'Invalid combination request', valid: false, blocked: true, dispense_authorized: false });
  }
}

async function handleSyncStatus(response) {
  const queuePath = join(projectRoot, 'tmp', 'offline_outcome_queue.jsonl');
  let pendingCount = 0;
  if (existsSync(queuePath)) {
    try {
      const content = await readFile(queuePath, 'utf8');
      pendingCount = content.trim().split('\n').filter(Boolean).length;
    } catch (_) {}
  }
  const catalogue = await catalogReadiness(deploymentCountry);
  return sendJson(response, 200, {
    deployment_country: deploymentCountry,
    offline_ready: true,
    medicine_recommendations_ready: catalogue.trusted && catalogue.approved_product_count > 0,
    catalogue,
    pending_sync_count: pendingCount,
    models: {
      whisper: whisperStatus().available,
      piper: ttsStatus().available,
      catalog: catalogue.available,
    },
    local_catalog_jurisdictions: catalogue.jurisdictions,
    timestamp: new Date().toISOString(),
  });
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/voice.html' : pathname;
  const safeRelative = normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, '');
  const filePath = resolve(join(webRoot, safeRelative));
  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${sep}`)) throw new Error('Invalid path');
  // Only browser assets are servable. Without this, /server.mjs, source maps,
  // notes or anything else dropped into web/ would be published as-is.
  const extension = extname(filePath).toLowerCase();
  if (!Object.hasOwn(contentTypes, extension)) throw new Error('Not a servable asset');
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('Not a file');
  const data = await readFile(filePath);
  response.writeHead(200, {
    'Content-Type': contentTypes[extension],
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https: wss:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  response.end(data);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/') && request.headers.origin) {
      let sameOrigin = false;
      try {
        const origin = new URL(request.headers.origin);
        sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === request.headers.host;
      } catch (_) { /* opaque origins are not trusted */ }
      if (!sameOrigin) return sendJson(response, 403, { error: 'Cross-origin API access is not allowed.', dispense_authorized: false });
    }

    if (url.pathname === '/api/tts') {
      if (request.method === 'GET') return sendJson(response, 200, ttsStatus());
      if (request.method === 'POST') return await handleTtsRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/gemini-tts') {
      if (request.method === 'GET') return sendJson(response, 200, geminiTtsStatus());
      if (request.method === 'POST') return await handleGeminiTtsRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/understand') {
      if (request.method === 'GET') return sendJson(response, 200, statusPayload(aiConfig));
      if (request.method === 'POST') return await handleUnderstandRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/transcribe') {
      if (request.method === 'GET') return sendJson(response, 200, whisperStatus());
      if (request.method === 'POST') return await handleTranscribeRequest(request, response, url);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/translate') {
      if (request.method === 'GET') return sendJson(response, 200, translationStatus());
      if (request.method === 'POST') return await handleTranslateRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/gemini-live-token') {
      if (request.method === 'GET') return sendJson(response, 200, geminiLiveStatus());
      if (request.method === 'POST') return await handleGeminiLiveTokenRequest(request, response);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/chat-turn') {
      if (request.method === 'POST') return await handleChatTurnRequest(request, response);
      response.writeHead(405, { Allow: 'POST' });
      return response.end();
    }

    if (url.pathname === '/api/catalog/search') {
      if (request.method === 'GET' || request.method === 'POST') return await handleCatalogSearchRequest(request, response, url);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/alternatives') {
      if (request.method === 'GET' || request.method === 'POST') return await handleAlternativesRequest(request, response, url);
      response.writeHead(405, { Allow: 'GET, POST' });
      return response.end();
    }

    if (url.pathname === '/api/combination/validate') {
      if (request.method === 'POST') return await handleCombinationValidateRequest(request, response);
      response.writeHead(405, { Allow: 'POST' });
      return response.end();
    }

    if (url.pathname === '/api/sync/status') {
      if (request.method === 'GET') return await handleSyncStatus(response);
      response.writeHead(405, { Allow: 'GET' });
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
}).listen(port, process.env.PILLPAL_HOST || '127.0.0.1', () => {
  console.log(`PILLPAL touchscreen running at http://localhost:${port}`);
  const status = ttsStatus();
  const installed = Object.values(status.models).filter(model => model.available);
  if (installed.length) {
    console.log(`Neural voices ready: ${installed.map(model => `${model.language}=${model.voice}`).join(', ')}`);
    if (process.env.PILLPAL_VOICE_WARMUP !== '0') synthesize('Willkommen bei PILLPAL.', 'de').catch(error => {
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
  const live = geminiLiveStatus();
  console.log(`Gemini Live transcription: ${live.available ? `on (${live.model})` : 'off'}.`);
  if (geminiTtsStatus().available) {
    Promise.allSettled(GEMINI_TTS_WARM_PROMPTS.map(text => synthesizeGemini(text, 'en')))
      .then(results => {
        const ready = results.filter(result => result.status === 'fulfilled').length;
        console.log(`Gemini TTS ready: ${geminiTtsVoice} (${ready}/${results.length} common prompts cached).`);
      });
  }
});
