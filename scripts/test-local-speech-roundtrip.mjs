import assert from 'node:assert/strict';
import { extractVolunteeredContext } from '../web/question-intent.js';
import { resolveVoiceAnswer } from '../web/voice-input-mapper.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { VoiceAssistant } from '../web/voice-assistant.js';

// Real Piper -> PCM resampling -> whisper.cpp. Synthetic speech only; this is
// not evidence about the user's microphone, accent, noise or speaker audibility.
const base = process.env.VOICE_TEST_URL || 'http://localhost:8091';
function mono16k(wav) {
  let format, pcm;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString('ascii', offset, offset + 4);
    const length = wav.readUInt32LE(offset + 4);
    const chunk = wav.subarray(offset + 8, offset + 8 + length);
    if (name === 'fmt ') format = chunk;
    if (name === 'data') pcm = chunk;
    offset += 8 + length + (length % 2);
  }
  assert.equal(format.readUInt16LE(0), 1);
  assert.equal(format.readUInt16LE(14), 16);
  const channels = format.readUInt16LE(2), rate = format.readUInt32LE(4);
  const frames = pcm.length / (channels * 2);
  const count = Math.floor(frames * 16000 / rate);
  const result = Buffer.alloc(44 + count * 2);
  result.write('RIFF'); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(16000, 24); result.writeUInt32LE(32000, 28); result.writeUInt16LE(2, 32); result.writeUInt16LE(16, 34);
  result.write('data', 36); result.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) result.writeInt16LE(pcm.readInt16LE(Math.floor(i * rate / 16000) * channels * 2), 44 + i * 2);
  return result;
}
const reports = [];
const interruptMode = process.argv.includes('--interrupt');
if (interruptMode) {
  globalThis.AudioContext = class {
    state = 'running'; sampleRate = 16000; destination = {};
    node() { return { connect() {}, disconnect() {}, gain: {} }; }
    createMediaStreamSource() { return this.node(); }
    createScriptProcessor() { return this.node(); }
    createGain() { return this.node(); }
    async close() { this.state = 'closed'; }
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
  } });
}
for (const [language, text] of [
  ['en', "I have had a mild headache since this morning. I am thirty years old."],
  ['de', 'Ich habe seit heute Morgen leichte Kopfschmerzen. Ich bin dreißig Jahre alt.'],
]) {
  const audio = await fetch(`${base}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language }) });
  assert.equal(audio.status, 200, 'Piper must synthesize the selected language');
  const start = Date.now();
  const wav = mono16k(Buffer.from(await audio.arrayBuffer()));
  let data;
  if (interruptMode) {
    const voice = new VoiceAssistant({ localWhisper: true, localWhisperUrl: `${base}/api/transcribe`, bargeIn: true, provider: 'piper', fallbackToBrowser: false, languageCode: language });
    let interrupted = 0, transcript, error;
    voice.onBargeIn = () => interrupted++;
    voice.onFinalTranscript = text => { transcript = text; };
    voice.onError = (_message, code) => { error = code; };
    voice.playNeural = () => new Promise(resolve => { voice.currentAbort = { abort: () => resolve(false) }; });
    voice.speak('Simulated assistant playback');
    await new Promise(resolve => setTimeout(resolve, 0));
    const feed = input => voice.localWhisper.processor.onaudioprocess({ inputBuffer: { getChannelData: () => input } });
    for (let i = 0; i < 10; i++) feed(new Float32Array(512));
    for (let offset = 44; offset < wav.length; offset += 1024) {
      const input = new Float32Array(Math.min(512, (wav.length - offset) / 2));
      for (let i = 0; i < input.length; i++) input[i] = wav.readInt16LE(offset + i * 2) / 32768;
      feed(input);
    }
    assert.equal(interrupted, 1, `${language}: generated speech must interrupt playback`);
    await voice.localWhisper.finish(language);
    voice.destroy();
    assert.equal(error, undefined);
    data = { transcript };
  } else {
    const result = await fetch(`${base}/api/transcribe?language=${language}&translate=0`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
    data = await result.json();
    assert.equal(result.status, 200, JSON.stringify(data));
  }
  const facts = extractVolunteeredContext(data.transcript);
  const symptom = resolveVoiceAnswer(data.transcript, { question_id: 'symptom', type: 'single_select', options: [{ value: 'pain_fever', label: 'Headache, pain or fever' }] });
  const report = { language, mode: interruptMode ? 'generated-audio-interruption-mocked-playback' : 'direct-transcription', input: text, transcript: data.transcript, facts, symptom: symptom?.value, transcription_ms: Date.now() - start };
  reports.push(report);
  console.log(JSON.stringify(report));
}
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(new URL('../tmp/voice-roundtrip-results.json', import.meta.url), JSON.stringify(reports, null, 2));
for (const result of reports) {
  assert.deepEqual(result.facts, { duration: 'today', age: 30, severity: 'mild' });
  assert.equal(result.symptom, 'pain_fever');
}
console.log('English/German synthetic audio roundtrip passed. Live microphone acceptance remains separate.');
