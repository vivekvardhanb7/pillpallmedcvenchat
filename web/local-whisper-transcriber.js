const SAMPLE_RATE = 16000;

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
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

function encodeWav(chunks) {
  const sampleCount = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let peak = 0;
  for (const chunk of chunks) {
    for (const sample of chunk) peak = Math.max(peak, Math.abs(sample));
  }
  // Quiet kiosk microphones otherwise produce a valid WAV that Whisper hears
  // as silence. Apply limited peak normalization without aggressively raising
  // room noise.
  const gain = peak > 0 && peak < 8000 ? Math.min(4, 12000 / peak) : 1;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, sampleCount * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(sample * gain))), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export class LocalWhisperTranscriber {
  constructor(options = {}) {
    this.url = options.url || '/api/transcribe';
    this.translate = options.translate === true;
    this.activityThreshold = Number(options.activityThreshold) > 0
      ? Number(options.activityThreshold)
      : 0.004;
    this.inputStream = null;
    this.ownsStream = false;
    this.generation = 0;
    this.requestAbort = null;
    this.active = false;
    this.chunks = [];
    this.onActivity = () => {};
    this.onFinal = () => {};
    this.onError = () => {};
    this.monitoringFirstActivityAt = null;
    this.monitoringFirstSpeechAt = null;
    this.speechStartAt = null;
    this.lastTranscriptionMs = null;
  }

  setInputStream(stream) {
    this.inputStream = stream || null;
    this.ownsStream = false;
  }

  prepare() {
    return fetch(this.url, { method: 'GET', cache: 'no-store' })
      .then(response => response.ok)
      .catch(() => false);
  }

  async start({ onActivity, onFinal, onError, monitoring = false, onSpeechStart } = {}) {
    if (this.active) return true;
    this.cancel();
    const generation = this.generation;
    this.onActivity = typeof onActivity === 'function' ? onActivity : () => {};
    this.onFinal = typeof onFinal === 'function' ? onFinal : () => {};
    this.onError = typeof onError === 'function' ? onError : () => {};
    this.monitoring = monitoring;
    this.onSpeechStart = typeof onSpeechStart === 'function' ? onSpeechStart : () => {};
    this.speechMs = 0;
    this.elapsedMs = 0;
    this.monitoringFirstActivityAt = null;
    this.monitoringFirstSpeechAt = null;
    this.speechStartAt = null;
    const externalStream = this.inputStream;
    const stream = externalStream || await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (generation !== this.generation) {
      if (!externalStream) stream.getTracks().forEach(track => track.stop());
      return false;
    }
    this.inputStream = stream;
    this.ownsStream = !externalStream;
    try {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error('local_whisper_audio_unsupported');
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    if (generation !== this.generation) return false;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
    this.chunks = [];
    this.active = true;
    this.processor.onaudioprocess = event => {
      if (!this.active) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = resamplePcm(input, this.audioContext.sampleRate);
      this.chunks.push(pcm);
      if (!this.monitoring && this.chunks.reduce((n, c) => n + c.length, 0) > SAMPLE_RATE * 45) {
        this.detach();
        this.onError('speech-too-long');
        return;
      }
      let energy = 0;
      for (const value of input) energy += value * value;
      const rms = Math.sqrt(energy / Math.max(1, input.length));
      const frameMs = input.length / this.audioContext.sampleRate * 1000;
      this.elapsedMs += frameMs;
      if (this.monitoring) {
        // Keep only a short pre-roll while the assistant speaks. Never submit
        // the whole assistant prompt as a customer answer. AEC is requested
        // from the browser; level gating is not proof of speaker identity.
        while (this.chunks.length > 1 && this.chunks.reduce((n, c) => n + c.length, 0) > SAMPLE_RATE * 0.65) this.chunks.shift();
        if (rms > this.activityThreshold && this.monitoringFirstActivityAt == null) {
          this.monitoringFirstActivityAt = nowMs();
        }
        const speechGate = Math.max(0.012, this.activityThreshold * 3);
        if (rms > speechGate && this.elapsedMs > 200 && this.monitoringFirstSpeechAt == null) {
          this.monitoringFirstSpeechAt = nowMs();
        }
        this.speechMs = rms > speechGate && this.elapsedMs > 200
          ? this.speechMs + frameMs : 0;
        if (this.speechMs < 240) return;
        this.monitoring = false;
        this.speechStartAt = nowMs();
        this.onSpeechStart();
      }
      if (rms > this.activityThreshold) this.onActivity();
    };
    return true;
    } catch (error) {
      if (generation === this.generation) this.detach();
      throw error;
    }
  }

  async finish(language = 'auto') {
    if (!this.active || this.monitoring) return;
    const generation = this.generation;
    const onFinal = this.onFinal;
    const onError = this.onError;
    const chunks = this.chunks;
    this.detach();
    if (chunks.reduce((sum, chunk) => sum + chunk.length, 0) < SAMPLE_RATE / 4) {
      onError('no-speech');
      return;
    }
    const requestStartedAt = nowMs();
    try {
      const controller = new AbortController();
      this.requestAbort = controller;
      const query = new URLSearchParams({
        language: language || 'auto',
        translate: this.translate ? '1' : '0',
      });
      const response = await fetch(`${this.url}?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: encodeWav(chunks),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (generation !== this.generation) return;
      this.lastTranscriptionMs = Math.round(nowMs() - requestStartedAt);
      if (!response.ok || !payload?.transcript) throw new Error(payload?.code || `local_whisper_${response.status}`);
      onFinal(String(payload.transcript).trim());
    } catch (error) {
      if (generation === this.generation) {
        this.lastTranscriptionMs = Math.round(nowMs() - requestStartedAt);
        onError(String(error?.message || 'local_whisper_failed'));
      }
    } finally {
      if (generation === this.generation) this.requestAbort = null;
    }
  }

  cancel() {
    this.generation += 1;
    this.requestAbort?.abort();
    this.requestAbort = null;
    this.detach();
  }

  endMonitoring({ preserve = false } = {}) {
    if (!this.monitoring) return;
    this.monitoring = false;
    // Barge-in keeps the rolling pre-roll so the beginning of the customer's
    // interruption is still transcribed. Normal prompt completion discards it,
    // because that audio is the assistant's own voice.
    if (!preserve) this.chunks = [];
    this.speechMs = 0;
    this.monitoringFirstActivityAt = null;
    this.monitoringFirstSpeechAt = null;
  }

  detach() {
    this.active = false;
    this.monitoring = false;
    this.chunks = [];
    if (this.processor) this.processor.onaudioprocess = null;
    for (const node of [this.source, this.processor, this.silentGain]) {
      try { node?.disconnect?.(); } catch (_) { /* ignored */ }
    }
    this.audioContext?.close?.().catch?.(() => {});
    this.source = null;
    this.processor = null;
    this.silentGain = null;
    this.audioContext = null;
    if (this.ownsStream) {
      this.inputStream?.getTracks().forEach(track => track.stop());
      this.inputStream = null;
      this.ownsStream = false;
    }
  }
}
