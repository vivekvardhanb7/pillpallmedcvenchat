import assert from 'node:assert/strict';
import { LocalWhisperTranscriber } from '../web/local-whisper-transcriber.js';
import { VoiceAssistant } from '../web/voice-assistant.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const stream = () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  return { track, getTracks: () => [track] };
};
class AudioContext {
  state = 'running';
  sampleRate = 16000;
  destination = {};
  node() { return { connect() {}, disconnect() {}, gain: {} }; }
  createMediaStreamSource() { return this.node(); }
  createScriptProcessor() { return this.node(); }
  createGain() { return this.node(); }
  async close() { this.state = 'closed'; }
}
globalThis.AudioContext = AudioContext;
let acquired;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  mediaDevices: { getUserMedia: async () => (acquired = stream()) },
} });
const final = [];
const errors = [];
const transcriber = new LocalWhisperTranscriber();
await transcriber.start();
transcriber.cancel();
assert.equal(acquired.track.stopped, true, 'cancellation releases an owned microphone');

const permission = deferred();
navigator.mediaDevices.getUserMedia = () => permission.promise;
const starting = transcriber.start();
transcriber.cancel();
const lateStream = stream();
permission.resolve(lateStream);
assert.equal(await starting, false);
assert.equal(lateStream.track.stopped, true, 'late permission result cannot reopen capture');

navigator.mediaDevices.getUserMedia = async () => (acquired = stream());
const response = deferred();
let signal;
globalThis.fetch = (_url, options) => { signal = options.signal; return response.promise; };
await transcriber.start({ onFinal: text => final.push(text), onError: error => errors.push(error) });
transcriber.chunks = [new Int16Array(8000)];
const finishing = transcriber.finish('de');
assert.equal(acquired.track.stopped, true, 'finish releases owned microphone before network response');
transcriber.cancel();
assert.equal(signal.aborted, true);
response.resolve({ ok: true, json: async () => ({ transcript: 'alte Antwort' }) });
await finishing;
assert.deepEqual(final, [], 'late transcript must not enter another session');
assert.deepEqual(errors, [], 'cancelled requests must not surface errors');

globalThis.fetch = async () => ({ ok: true, json: async () => ({ transcript: 'Kopfschmerzen' }) });
await transcriber.start({ onFinal: text => final.push(text) });
transcriber.chunks = [new Int16Array(8000)];
await transcriber.finish('de');
assert.deepEqual(final, ['Kopfschmerzen'], 'fresh turns still deliver their transcript');

const shared = stream();
transcriber.setInputStream(shared);
await transcriber.start();
transcriber.cancel();
assert.equal(shared.track.stopped, false, 'shared analyser stream belongs to its session owner');

const voice = new VoiceAssistant({ localWhisper: true, provider: 'none', fallbackToBrowser: false });
const pending = deferred();
globalThis.fetch = (_url, options) => { signal = options.signal; return pending.promise; };
await voice.localWhisper.start({ onFinal: text => final.push(text) });
voice.localWhisper.chunks = [new Int16Array(8000)];
const voiceFinishing = voice.localWhisper.finish('en');
voice.cancelListening();
assert.equal(signal.aborted, true, 'VoiceAssistant cancels transcription even after recording ends');
pending.resolve({ ok: true, json: async () => ({ transcript: 'stale' }) });
await voiceFinishing;
assert.deepEqual(final, ['Kopfschmerzen']);
voice.destroy();
console.log('Local Whisper lifecycle tests passed: stream ownership, late permission, cancellation, stale results and fresh turns.');
