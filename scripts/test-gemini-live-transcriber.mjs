import assert from 'node:assert/strict';

const saved = {
  fetch: globalThis.fetch,
  WebSocket: globalThis.WebSocket,
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  AudioContext: globalThis.AudioContext,
};

class MockNode {
  connect() {}
  disconnect() {}
}

class MockProcessor extends MockNode {
  constructor() {
    super();
    this.onaudioprocess = null;
  }
}

class MockAudioContext {
  constructor() {
    MockAudioContext.instance = this;
    this.sampleRate = 48000;
    this.state = 'running';
  }
  createMediaStreamSource() { return new MockNode(); }
  createScriptProcessor() { this.processor = new MockProcessor(); return this.processor; }
  createGain() {
    const node = new MockNode();
    node.gain = { value: 1 };
    return node;
  }
  close() { return Promise.resolve(); }
}

class MockWebSocket {
  static OPEN = 1;
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.sent = [];
    MockWebSocket.instance = this;
    // Simulate a noticeable WebSocket handshake. Microphone audio produced in
    // this interval must be retained as pre-roll instead of being discarded.
    setTimeout(() => this.onopen?.(), 15);
  }
  send(raw) {
    const payload = JSON.parse(raw);
    this.sent.push(payload);
    if (payload.setup) {
      setTimeout(() => this.onmessage?.({ data: new Blob([JSON.stringify({ setupComplete: {} })]) }), 0);
    }
    if (payload.realtimeInput?.audioStreamEnd) {
      setTimeout(() => this.onmessage?.({
        data: new Blob([JSON.stringify({ serverContent: { inputTranscription: { text: 'Can I take paracetimel for fever?' }, turnComplete: true } })]),
      }), 0);
    }
  }
  close() {
    this.readyState = 3;
    setTimeout(() => this.onclose?.(), 0);
  }
}

let tokenFetches = 0;
globalThis.fetch = async () => {
  tokenFetches += 1;
  return ({
  ok: true,
  json: async () => ({
    token: 'short_lived_token',
    endpoint: 'wss://example.test/live',
    setup: { model: 'models/gemini-3.5-transcribe-live', generationConfig: { responseModalities: ['TEXT'] } },
  }),
  });
};
globalThis.WebSocket = MockWebSocket;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { mediaDevices: { getUserMedia: async () => ({}) } },
});
globalThis.AudioContext = MockAudioContext;

const { GeminiLiveTranscriber } = await import('../web/gemini-live-transcriber.js');
const final = [];
const errors = [];
const transcriber = new GeminiLiveTranscriber({ tokenUrl: '/api/gemini-live-token' });
assert.equal(await transcriber.prepare(), true, 'next token can be prefetched during assistant speech');
const startPromise = transcriber.start({
  onFinal: text => final.push(text),
  onError: code => errors.push(code),
});
await new Promise(resolve => setTimeout(resolve, 3));
assert.ok(MockAudioContext.instance?.processor, 'microphone capture starts before the WebSocket handshake completes');
const preRollSamples = new Float32Array(4800).fill(0.18);
MockAudioContext.instance.processor.onaudioprocess({
  inputBuffer: { getChannelData: () => preRollSamples },
});
await startPromise;
assert.equal(tokenFetches, 1, 'start consumes the prefetched token without another request');
await new Promise(resolve => setTimeout(resolve, 5));

const samples = new Float32Array(4800).fill(0.2);
MockAudioContext.instance.processor.onaudioprocess({
  inputBuffer: { getChannelData: () => samples },
});
assert.ok(
  MockWebSocket.instance.sent.some(message => message.realtimeInput?.audio?.mimeType === 'audio/pcm;rate=16000'),
  'pre-roll and live audio are resampled and streamed as Gemini PCM',
);
transcriber.finish();
await new Promise(resolve => setTimeout(resolve, 10));
assert.deepEqual(final, ['Can I take paracetimel for fever?']);
assert.deepEqual(errors, []);

globalThis.fetch = saved.fetch;
globalThis.WebSocket = saved.WebSocket;
if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
else delete globalThis.navigator;
globalThis.AudioContext = saved.AudioContext;

console.log('Gemini Live transcription transport tests passed.');
