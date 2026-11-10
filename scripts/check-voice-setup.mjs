import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const failures = [];
function check(ok, description) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${description}`);
  if (!ok) failures.push(description);
}
const context = vm.createContext({ window: {} });
vm.runInContext(await readFile(new URL('web/config.js', root), 'utf8'), context, { timeout: 1000 });
const config = context.window.PILLPAL_CONFIG;
check(config.countryCode === 'DE', 'Germany jurisdiction');
check(config.voiceFirst === true, 'Voice-first interface');
check(config.voice?.localWhisper === true && config.voice?.geminiLive !== true, 'Local speech recognition');
check(config.voice?.localWhisperTranslate !== true, 'Keep German and English in their original language');
check(config.voice?.bargeIn !== false, 'Speech interruption enabled');
check(Number(config.voice?.silenceTimeoutMs) >= 1600, 'Natural pause allowance');
check(config.voice?.ttsUrl === '/api/tts', 'Local text-to-speech endpoint');
for (const path of ['tools/whisper/models/ggml-base.bin']) {
  check(await access(new URL(path, root)).then(() => true, () => false), `Installed ${path}`);
}
const env = await readFile(new URL('.env', root), 'utf8');
const envValue = key => env.match(new RegExp(`^${key}=([^\\r\\n]*)`, 'm'))?.[1]?.trim();
check(envValue('GEMINI_CLOUD_ENABLED') === '0', 'Cloud processing disabled in saved startup settings');
check(envValue('WHISPER_TRANSLATE') === '0', 'Saved transcription translation disabled');
const base = process.env.VOICE_TEST_URL || `http://localhost:${envValue('PORT') || 8080}`;
for (const [path, validate, description] of [
  ['/api/transcribe', s => s.available && s.local, 'Live local Whisper service'],
  ['/api/tts', s => s.models?.de?.available && s.models?.en?.available, 'Live German and English voices'],
  ['/api/understand', s => s.provider === 'off', 'No unbenchmarked language-model sidecar enabled'],
  ['/api/sync/status', s => s.deployment_country === 'DE' && s.medicine_recommendations_ready === false, 'German clinical-release gate remains closed'],
]) {
  try {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
    check(response.ok && validate(await response.json()), description);
  } catch { check(false, `${description} (start the server first)`); }
}
console.log('Physical microphone, speaker echo and clinical accuracy are not certified by this check.');
if (failures.length) process.exitCode = 1;
