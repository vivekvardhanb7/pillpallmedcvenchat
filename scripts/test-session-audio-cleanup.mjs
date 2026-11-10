import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Execute the actual browser functions with controlled permission/network timing.
const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const audioSource = source.slice(source.indexOf('let micAnalyser = null;'), source.indexOf('function startVisualizer()'));
const pending = () => {
  let resolve;
  return { promise: new Promise(done => { resolve = done; }), resolve: value => resolve(value) };
};
const permission = pending();
let stopped = 0;
const stream = { getTracks: () => [{ stop() { stopped++; } }] };
const context = vm.createContext({
  navigator: { mediaDevices: { getUserMedia: () => permission.promise } },
  voice: { setMicrophoneStream() {}, cancelListening() {}, stopSpeaking() {} },
  addEventListener() {},
});
vm.runInContext(audioSource, context);
const opening = vm.runInContext('initMicAudioAnalyser()', context);
vm.runInContext('releaseMicAudioAnalyser()', context);
permission.resolve(stream);
assert.equal(await opening, null);
assert.equal(stopped, 1, 'ending session before microphone permission resolves stops the late stream');

const request = pending();
let renders = 0;
const state = vm.createContext({
  busy: false, sessionId: 'old', current: null, config: {}, currentLanguage: 'de',
  setVoiceMode() {}, setLoading() {}, t: () => '', clearPendingSubmission() {},
  activeLanguage: () => 'de', AbortSignal, fetch: () => request.promise,
  render() { renders++; },
});
const workflow = source.slice(source.indexOf('let assessmentGeneration = 0;'), source.indexOf('function renderSummary('));
vm.runInContext(workflow, state);
const turn = vm.runInContext('callWorkflow({ reset: true })', state);
vm.runInContext('assessmentGeneration++; sessionId = "new"; busy = true;', state);
request.resolve({ ok: true, json: async () => ({ screen: {}, session_id: 'old-server' }) });
await turn;
assert.equal(state.sessionId, 'new', 'old response cannot overwrite the new session');
assert.equal(state.busy, true, 'old finally cannot unlock a newer pending request');
assert.equal(renders, 0, 'old response cannot render or speak after session reset');
console.log('Session audio cleanup tests passed: late permission and stale assessment response.');
