import { speechLocale, t } from './i18n.js';

export class VoiceAssistant {
  constructor(options = {}) {
    this.languageCode = (options.languageCode || 'en').split('-')[0];
    this.language = options.language || speechLocale(this.languageCode);
    this.rate = Number(options.rate || 1.05);
    this.pitch = Number(options.pitch || 1);
    this.preferredNames = Array.isArray(options.preferredNames) ? options.preferredNames : [];
    this.provider = options.provider || 'piper';
    this.ttsUrl = options.ttsUrl || '/api/tts';
    this.fallbackToBrowser = options.fallbackToBrowser !== false;

    this.muted = false;
    this.listening = false;
    this.speaking = false;
    this.onFinalTranscript = () => {};
    this.onInterimTranscript = () => {};
    this.onStateChange = () => {};
    this.onError = () => {};

    this.queue = [];
    this.processing = false;
    this.runId = 0;
    this.currentAudio = null;
    this.currentAudioUrl = null;
    this.currentAudioReject = null;
    this.currentAbort = null;
    this.currentUtterance = null;
    this.neuralUnavailableUntil = new Map();
    this.neuralAvailability = new Map();

    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    this.recognitionSupported = Boolean(Recognition);
    this.synthesisSupported = 'speechSynthesis' in globalThis && 'SpeechSynthesisUtterance' in globalThis;

    if (Recognition) {
      this.recognition = new Recognition();
      this.recognition.lang = this.language;
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;
      this.recognition.onstart = () => {
        this.listening = true;
        this.onStateChange('listening');
      };
      this.recognition.onresult = event => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = event.results[i][0]?.transcript?.trim() || '';
          if (event.results[i].isFinal) finalText += `${text} `;
          else interimText += `${text} `;
        }
        this.onInterimTranscript(interimText.trim());
        if (finalText.trim()) this.onFinalTranscript(finalText.trim());
      };
      this.recognition.onerror = event => {
        const message = event.error === 'not-allowed'
          ? t('voice.micDenied', this.languageCode)
          : t('voice.recognitionError', this.languageCode, { error: event.error || 'unknown error' });
        this.onError(message);
      };
      this.recognition.onend = () => {
        this.listening = false;
        this.onInterimTranscript('');
        if (!this.speaking) this.onStateChange('idle');
      };
    }
  }

  setLanguage(code) {
    this.languageCode = String(code || 'en').split('-')[0];
    this.language = speechLocale(this.languageCode);
    if (this.recognition) this.recognition.lang = this.language;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.muted) this.stopSpeaking();
    else this.onStateChange(this.listening ? 'listening' : 'idle');
  }

  get neuralAvailable() {
    return this.neuralAvailability.get(this.languageCode) !== false;
  }

  setNeuralAvailability(language, available) {
    const code = String(language || this.languageCode).split('-')[0];
    this.neuralAvailability.set(code, Boolean(available));
    if (available) this.neuralUnavailableUntil.delete(code);
    this.onStateChange(this.speaking ? 'speaking' : this.listening ? 'listening' : 'idle');
  }

  setSpeaking(value) {
    const speaking = Boolean(value);
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    this.onStateChange(speaking ? 'speaking' : this.listening ? 'listening' : 'idle');
  }

  getPreferredVoice() {
    if (!this.synthesisSupported) return null;
    const voices = globalThis.speechSynthesis.getVoices();
    const target = this.language.toLowerCase().replace('_', '-');
    const base = target.split('-')[0];
    const matching = voices.filter(voice => {
      const lang = String(voice.lang || '').toLowerCase().replace('_', '-');
      return lang === target || lang.split('-')[0] === base;
    });
    const exact = matching.filter(voice => String(voice.lang || '').toLowerCase().replace('_', '-') === target);
    const pool = exact.length ? exact : matching;
    for (const preferred of this.preferredNames) {
      const match = pool.find(voice => voice.name.toLowerCase().includes(preferred.toLowerCase()));
      if (match) return match;
    }
    return pool.find(voice => voice.default) || pool[0] || null;
  }

  speak(text, { interrupt = false } = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean || this.muted) return false;
    if (this.listening) this.stopListening();
    if (interrupt) this.stopSpeaking();
    this.queue.push(clean);
    this.processQueue();
    return true;
  }

  async processQueue() {
    if (this.processing || this.muted || !this.queue.length) return;

    this.processing = true;
    const text = this.queue.shift();
    const run = ++this.runId;

    let spoke = false;
    try {
      const unavailableUntil = this.neuralUnavailableUntil.get(this.languageCode) || 0;
      if (this.provider === 'piper' && this.neuralAvailable && Date.now() >= unavailableUntil) {
        spoke = await this.playNeural(text, run);
      }
      if (!spoke && this.fallbackToBrowser && run === this.runId && !this.muted) {
        spoke = await this.playBrowser(text, run);
      }
    } catch (_) {
      spoke = false;
    } finally {
      if (run === this.runId) {
        this.processing = false;
        this.setSpeaking(false);
        this.processQueue();
      }
    }
  }

  async playNeural(text, run) {
    const controller = new AbortController();
    this.currentAbort = controller;

    let response;
    try {
      response = await fetch(this.ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: this.languageCode }),
        signal: controller.signal,
      });
    } catch (_) {
      return false;
    } finally {
      if (this.currentAbort === controller) this.currentAbort = null;
    }

    if (run !== this.runId || this.muted) return false;
    if (!response.ok) {
      if (response.status === 503) {
        this.neuralUnavailableUntil.set(this.languageCode, Date.now() + 60000);
        const detail = await response.json().catch(() => null);
        if (detail?.code === 'tts_language_unavailable') this.setNeuralAvailability(this.languageCode, false);
      }
      return false;
    }

    const blob = await response.blob();
    if (run !== this.runId || this.muted || !blob.size) return false;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.currentAudio = audio;
    this.currentAudioUrl = url;

    try {
      await new Promise((resolvePromise, rejectPromise) => {
        this.currentAudioReject = rejectPromise;
        audio.onended = () => resolvePromise();
        audio.onerror = () => rejectPromise(new Error('Audio playback failed'));
        audio.play()
          .then(() => {
            if (run === this.runId && !this.muted) this.setSpeaking(true);
            else resolvePromise();
          })
          .catch(rejectPromise);
      });
      return true;
    } catch (_) {
      return false;
    } finally {
      this.currentAudioReject = null;
      this.clearAudio(audio, url);
    }
  }

  playBrowser(text, run) {
    if (!this.synthesisSupported || this.muted || run !== this.runId) return Promise.resolve(false);

    return new Promise(resolvePromise => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.language;
      utterance.rate = Math.min(Math.max(this.rate, 0.75), 1.35);
      utterance.pitch = Math.min(Math.max(this.pitch, 0.75), 1.35);
      const voice = this.getPreferredVoice();
      if (voice) utterance.voice = voice;

      let settled = false;
      let watchdog = null;
      const finish = result => {
        if (settled) return;
        settled = true;
        if (watchdog) clearTimeout(watchdog);
        if (this.currentUtterance === utterance) this.currentUtterance = null;
        resolvePromise(result);
      };

      watchdog = setTimeout(() => {
        try { globalThis.speechSynthesis.cancel(); } catch (_) { /* ignored */ }
        finish(false);
      }, Math.max(5000, text.length * 120));

      utterance.onstart = () => {
        if (run === this.runId && !this.muted) this.setSpeaking(true);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      this.currentUtterance = utterance;
      globalThis.speechSynthesis.cancel();
      globalThis.speechSynthesis.speak(utterance);
    });
  }

  clearAudio(audio = this.currentAudio, url = this.currentAudioUrl) {
    if (!audio) return;
    try { audio.pause(); } catch (_) { /* already stopped */ }
    audio.onended = null;
    audio.onerror = null;
    audio.removeAttribute?.('src');
    audio.load?.();
    if (url) URL.revokeObjectURL(url);
    if (this.currentAudio === audio) this.currentAudio = null;
    if (this.currentAudioUrl === url) this.currentAudioUrl = null;
  }

  startListening() {
    if (!this.recognitionSupported || this.listening || this.speaking) return false;
    try {
      this.recognition.start();
      return true;
    } catch (_) {
      return false;
    }
  }

  stopSpeaking() {
    this.runId += 1;
    this.queue.length = 0;
    this.processing = false;
    this.speaking = false;

    this.currentAbort?.abort();
    this.currentAbort = null;

    const rejectAudio = this.currentAudioReject;
    this.currentAudioReject = null;
    if (rejectAudio) rejectAudio(new Error('Speech stopped'));

    this.clearAudio();

    if (this.synthesisSupported) globalThis.speechSynthesis.cancel();
    this.currentUtterance = null;

    this.onStateChange(this.listening ? 'listening' : 'idle');
  }

  stopListening() {
    if (!this.recognitionSupported || !this.listening) return;
    try { this.recognition.stop(); } catch (_) { /* already stopping */ }
  }

  destroy() {
    this.stopListening();
    this.stopSpeaking();
  }
}

