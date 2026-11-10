const SAMPLE_RATE = 16000;
const TARGET_CHUNK_SAMPLES = 1600; // 100 ms at 16 kHz

function toBase64(bytes) {
  let binary = '';
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + block)));
  }
  return btoa(binary);
}

function resamplePcm(input, sourceRate) {
  const ratio = sourceRate / SAMPLE_RATE;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio) || start + 1);
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor] || 0;
    const value = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return output;
}

function takeSamples(queue, wanted) {
  const result = new Int16Array(wanted);
  let written = 0;
  while (written < wanted && queue.length) {
    const current = queue[0];
    const count = Math.min(wanted - written, current.length);
    result.set(current.subarray(0, count), written);
    written += count;
    if (count === current.length) queue.shift();
    else queue[0] = current.subarray(count);
  }
  return result;
}

/**
 * A short, single-turn connection to Gemini Live Transcription.
 *
 * The browser receives only a short-lived, constrained token from the local
 * kiosk server. It never sees GEMINI_API_KEY. This class deliberately returns
 * transcript text only; it cannot return a medical recommendation or invoke a
 * kiosk action.
 */
export class GeminiLiveTranscriber {
  constructor(options = {}) {
    this.tokenUrl = options.tokenUrl || '/api/gemini-live-token';
    this.inputStream = null;
    this.socket = null;
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.silentGain = null;
    this.pcmQueue = [];
    this.pcmCount = 0;
    this.ready = false;
    this.active = false;
    this.finishing = false;
    this.closed = false;
    this.finalText = '';
    this.finalTimeout = null;
    this.prefetchedToken = null;
    this.tokenPromise = null;
    this.tokenReceivedAt = 0;
    this.onInterim = () => {};
    this.onFinal = () => {};
    this.onError = () => {};
  }

  setInputStream(stream) {
    this.inputStream = stream || null;
  }

  async requestToken() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`gemini_live_token_${response.status}`);
      const payload = await response.json();
      if (!payload?.token || !payload?.endpoint || !payload?.setup) throw new Error('gemini_live_token_invalid');
      return payload;
    } catch (error) {
      if (/^gemini_live_token_/.test(String(error?.message || ''))) throw error;
      throw new Error('gemini_live_token_unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  prepare() {
    if (this.prefetchedToken && Date.now() - this.tokenReceivedAt < 45_000) return Promise.resolve(true);
    if (this.tokenPromise) return this.tokenPromise.then(() => true).catch(() => false);
    this.tokenPromise = this.requestToken()
      .then(payload => {
        this.prefetchedToken = payload;
        this.tokenReceivedAt = Date.now();
        return payload;
      })
      .finally(() => { this.tokenPromise = null; });
    return this.tokenPromise.then(() => true).catch(() => false);
  }

  async consumeToken() {
    if (this.prefetchedToken && Date.now() - this.tokenReceivedAt < 45_000) {
      const payload = this.prefetchedToken;
      this.prefetchedToken = null;
      this.tokenReceivedAt = 0;
      return payload;
    }
    if (this.tokenPromise) {
      await this.tokenPromise;
      return this.consumeToken();
    }
    return this.requestToken();
  }

  async start({ onInterim, onFinal, onError } = {}) {
    if (this.active) return true;
    if (!globalThis.WebSocket || !globalThis.navigator?.mediaDevices?.getUserMedia) {
      throw new Error('gemini_live_not_supported');
    }
    this.onInterim = typeof onInterim === 'function' ? onInterim : () => {};
    this.onFinal = typeof onFinal === 'function' ? onFinal : () => {};
    this.onError = typeof onError === 'function' ? onError : () => {};
    this.closed = false;
    this.finishing = false;
    this.finalText = '';
    this.pcmQueue = [];
    this.pcmCount = 0;

    // Start capturing before token/WebSocket setup finishes. Audio remains in
    // pcmQueue until setupComplete, preserving the first words when a customer
    // begins speaking immediately after the assistant stops.
    try {
      await this.attachAudio();
      this.active = true;
    } catch (error) {
      this.cancel();
      throw error;
    }

    let tokenPayload;
    try {
      tokenPayload = await this.consumeToken();
    } catch (error) {
      this.cancel();
      throw error;
    }

    const endpoint = `${tokenPayload.endpoint}${tokenPayload.endpoint.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(tokenPayload.token)}`;
    await new Promise((resolvePromise, rejectPromise) => {
      let settled = false;
      const settle = callback => {
        if (settled) return;
        settled = true;
        callback();
      };
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      socket.onopen = () => {
        try {
          socket.send(JSON.stringify({ setup: tokenPayload.setup }));
          settle(resolvePromise);
        } catch (error) {
          settle(() => rejectPromise(error));
          this.cancel();
        }
      };
      socket.onmessage = event => { this.handleMessage(event.data).catch(() => this.fail('gemini_live_response_invalid')); };
      socket.onerror = () => {
        if (!settled) settle(() => rejectPromise(new Error('gemini_live_socket_error')));
        else if (!this.finishing && !this.closed) this.fail('gemini_live_socket_error');
      };
      socket.onclose = () => {
        if (!settled) settle(() => rejectPromise(new Error('gemini_live_socket_closed')));
        else if (!this.closed && !this.finishing) this.fail('gemini_live_socket_closed');
      };
    });
    return true;
  }

  async attachAudio() {
    const stream = this.inputStream || await globalThis.navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.inputStream = stream;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('gemini_live_audio_context_unsupported');
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
    this.processor.onaudioprocess = event => {
      if (!this.active || this.finishing || this.closed) return;
      const pcm = resamplePcm(event.inputBuffer.getChannelData(0), this.audioContext.sampleRate);
      this.pcmQueue.push(pcm);
      this.pcmCount += pcm.length;
      this.flushPcm();
    };
  }

  flushPcm(includeRemainder = false) {
    // Keep the first few hundred milliseconds until Gemini acknowledges the
    // setup message. Dropping that prefix regularly loses the medicine name at
    // the beginning of a short customer request.
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    while (this.pcmCount >= TARGET_CHUNK_SAMPLES || (includeRemainder && this.pcmCount > 0)) {
      const count = this.pcmCount >= TARGET_CHUNK_SAMPLES ? TARGET_CHUNK_SAMPLES : this.pcmCount;
      const pcm = takeSamples(this.pcmQueue, count);
      this.pcmCount -= count;
      this.socket.send(JSON.stringify({
        realtimeInput: { audio: { data: toBase64(new Uint8Array(pcm.buffer)), mimeType: 'audio/pcm;rate=16000' } },
      }));
    }
  }

  async handleMessage(raw) {
    if (raw && typeof raw.text === 'function') raw = await raw.text();
    let payload;
    try { payload = JSON.parse(raw); } catch (_) { return; }
    if (payload.setupComplete) {
      this.ready = true;
      this.flushPcm();
      return;
    }
    const content = payload.serverContent;
    if (!content) return;
    const interim = String(content.interimInputTranscription?.text || '').trim();
    if (interim) this.onInterim(interim);
    const final = String(content.inputTranscription?.text || '').trim();
    if (final) {
      this.finalText = final;
      if (this.finishing || content.turnComplete) this.complete(final);
    }
    if (content.turnComplete && this.finishing) this.complete(this.finalText);
  }

  finish() {
    if (!this.socket || this.closed) return;
    this.finishing = true;
    this.flushPcm(true);
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
    this.detachAudio();
    // audioStreamEnd asks Gemini to finalize immediately. Keep only a short
    // network fallback instead of holding the UI in Thinking for 6.5 seconds.
    this.finalTimeout = setTimeout(() => this.complete(this.finalText), 2500);
  }

  cancel() {
    this.closed = true;
    this.finishing = false;
    if (this.finalTimeout) clearTimeout(this.finalTimeout);
    this.finalTimeout = null;
    this.detachAudio();
    try { this.socket?.close(); } catch (_) { /* ignored */ }
    this.socket = null;
    this.active = false;
    this.ready = false;
    this.pcmQueue = [];
    this.pcmCount = 0;
  }

  detachAudio() {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      try { this.processor.disconnect(); } catch (_) { /* ignored */ }
    }
    if (this.source) {
      try { this.source.disconnect(); } catch (_) { /* ignored */ }
    }
    if (this.silentGain) {
      try { this.silentGain.disconnect(); } catch (_) { /* ignored */ }
    }
    this.processor = null;
    this.source = null;
    this.silentGain = null;
    this.audioContext?.close?.().catch?.(() => {});
    this.audioContext = null;
  }

  complete(text) {
    if (this.closed) return;
    const transcript = String(text || '').trim();
    this.cancel();
    if (transcript) this.onFinal(transcript);
    else this.onError('no-speech');
  }

  fail(code) {
    if (this.closed) return;
    this.cancel();
    this.onError(code);
  }
}
