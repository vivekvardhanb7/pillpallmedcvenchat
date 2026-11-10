import assert from 'node:assert/strict';
import { VoiceAssistant } from '../web/voice-assistant.js';

class AudioContext {
  state = 'running'; sampleRate = 16000; destination = {};
  node() { return { connect() {}, disconnect() {}, gain: {} }; }
  createMediaStreamSource() { return this.node(); }
  createScriptProcessor() { return this.node(); }
  createGain() { return this.node(); }
  async close() { this.state = 'closed'; }
}
globalThis.AudioContext = AudioContext;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  mediaDevices: { getUserMedia: async constraints => {
    assert.equal(constraints.audio.echoCancellation, true);
    return { getTracks: () => [{ stop() {} }] };
  } },
} });
globalThis.fetch = async (_url, options) => options?.method === 'POST'
  ? { ok: true, json: async () => ({ transcript: 'unused' }) }
  : { ok: true };

for (const language of ['en', 'de']) {
  const voice = new VoiceAssistant({ localWhisper: true, bargeIn: true, provider: 'piper', fallbackToBrowser: false, languageCode: language });
  let cancelled = 0, interruptions = 0, sent = [];
  voice.onBargeIn = () => interruptions++;
  voice.onFinalTranscript = text => sent.push(text);
  voice.playNeural = () => new Promise(resolve => {
    voice.currentAbort = { abort() { cancelled++; resolve(false); } };
  });
  voice.speak(language === 'en' ? 'Tell me when this started.' : 'Seit wann haben Sie diese Beschwerden?');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(voice.localWhisper.monitoring, true);
  const frame = value => voice.localWhisper.processor.onaudioprocess({
    inputBuffer: { getChannelData: () => new Float32Array(512).fill(value) },
  });
  for (let i = 0; i < 10; i++) frame(0.002);
  frame(0.2); // isolated click, not sustained speech
  for (let i = 0; i < 10; i++) frame(0.002);
  assert.equal(cancelled, 0, 'quiet noise and a single click must not stop playback');
  assert.ok(voice.localWhisper.chunks.reduce((n, c) => n + c.length, 0) <= 10400);
  // Three quieter pre-roll frames are followed by louder sustained speech. The
  // barge-in must keep the pre-roll so the first word is not cut off.
  for (let i = 0; i < 3; i++) frame(0.06);
  for (let i = 0; i < 9; i++) frame(0.2);
  assert.equal(cancelled, 1, 'sustained acoustic input stops the pending audio');
  assert.equal(interruptions, 1);
  assert.equal(voice.listening, true);
  assert.equal(voice.localWhisper.monitoring, false);
  assert.ok(
    voice.localWhisper.chunks.some(chunk => chunk[0] > 1500 && chunk[0] < 2500),
    'pre-roll before detection is preserved',
  );
  assert.ok(voice.localWhisper.chunks.some(chunk => chunk[0] > 5000), 'post-detection speech is retained');
  assert.equal(voice.lastBargeInMetric?.source, 'local-whisper-acoustic');
  assert.ok(voice.lastBargeInMetric.stop_ms >= 0, 'barge-in stop latency is measured');
  const expected = language === 'en' ? 'It started yesterday' : 'Seit gestern';
  globalThis.fetch = async (url, options) => {
    if (options?.method !== 'POST') return { ok: true };
    assert.ok(url.includes(`language=${language}`));
    assert.ok(url.includes('translate=0'));
    assert.ok(options.body.size > 44);
    return { ok: true, json: async () => ({ transcript: expected }) };
  };
  await voice.localWhisper.finish(language);
  assert.deepEqual(sent, [expected], 'only the new customer utterance is delivered');
  voice.destroy();
}

// Finishing an uninterrupted prompt discards monitor audio before collecting an answer.
const voice = new VoiceAssistant({ localWhisper: true, bargeIn: true, provider: 'piper', fallbackToBrowser: false });
let finish;
voice.playNeural = () => new Promise(resolve => { finish = resolve; });
voice.speak('A long question');
await new Promise(resolve => setTimeout(resolve, 0));
voice.localWhisper.chunks = [new Int16Array(512).fill(10)];
finish(true);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(voice.localWhisper.monitoring, false);
assert.equal(voice.localWhisper.chunks.length, 0, 'assistant audio is not a customer answer');
assert.equal(voice.listening, true, 'listening continues without a tap after playback');
voice.destroy();
console.log('Acoustic interruption regressions passed in EN/DE: noise rejection, sustained speech, pre-roll, cancellation, transcript and prompt completion. These use simulated PCM, not a physical microphone.');
