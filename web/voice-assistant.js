import { splitSpeechText } from './assessment-speech.js';
import { speechLocale, t } from './i18n.js';
import { GeminiLiveTranscriber } from './gemini-live-transcriber.js';
import { LocalWhisperTranscriber } from './local-whisper-transcriber.js';

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export class VoiceAssistant {
  constructor(options = {}) {
    this.languageCode = (options.languageCode || 'en').split('-')[0];
    this.language = options.language || speechLocale(this.languageCode);
    this.rate = Number(options.rate || 1.05);
    this.pitch = Number(options.pitch || 1);
    this.preferredNames = Array.isArray(options.preferredNames) ? options.preferredNames : [];
    this.femaleOnly = options.femaleOnly === true;
    this.provider = options.provider || 'piper';
    this.ttsUrl = options.ttsUrl || '/api/tts';
    this.fallbackToBrowser = options.fallbackToBrowser !== false;

    this.muted = false;
    this.listening = false;
    this.speaking = false;
    this.bargeInEnabled = options.bargeIn !== false;
    this.onBargeIn = typeof options.onBargeIn === 'function' ? options.onBargeIn : () => {};
    this.onFinalTranscript = () => {};
    this.onInterimTranscript = () => {};
    this.onStateChange = () => {};
    this.onError = () => {};
    this.onPlaybackStart = () => {};
    this.lastBargeInMetric = null;

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
    this.shouldBeListening = false;
    this.accumulatedTranscript = '';
    this.interimText = '';
    this.silenceTimer = null;
    // Do not cut a compound answer at an ordinary hesitation. Old local
    // configuration values below this floor caused mid-sentence submissions.
    this.silenceTimeoutMs = Math.max(1600, Number(options.silenceTimeoutMs) || 1800);
    // Web Speech can show an active microphone without ever emitting either a
    // result or a no-speech error. Never leave the kiosk in "Listening" in
    // that state; a customer should be able to tap once and try again.
    this.listenWatchdogTimer = null;
    this.listenTimeoutMs = Number(options.listenTimeoutMs || 15000);
    this.recognitionActive = false;
    this.recognitionStopping = false;
    this.discardTranscript = false;
    this.geminiLiveEnabled = options.geminiLive === true;
    this.localWhisperEnabled = options.localWhisper === true;
    this.geminiLive = this.geminiLiveEnabled
      ? new GeminiLiveTranscriber({ tokenUrl: options.geminiTokenUrl || '/api/gemini-live-token' })
      : null;
    this.localWhisper = this.localWhisperEnabled
      ? new LocalWhisperTranscriber({
          url: options.localWhisperUrl || '/api/transcribe',
          translate: options.localWhisperTranslate === true,
          activityThreshold: options.voiceActivityThreshold,
        })
      : null;
    this.geminiStarting = false;

    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    this.recognitionSupported = Boolean(Recognition) || this.geminiLiveEnabled || this.localWhisperEnabled;
    this.synthesisSupported = 'speechSynthesis' in globalThis && 'SpeechSynthesisUtterance' in globalThis;

    if (Recognition) {
      this.recognition = new Recognition();
      this.recognition.lang = this.language;
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;
      this.recognition.onstart = () => {
        this.recognitionActive = true;
        if (!this.shouldBeListening) {
          this.recognitionStopping = true;
          try { this.recognition.abort(); } catch (_) {}
          return;
        }
        this.listening = true;
        this.armListenWatchdog();
        this.onStateChange('listening');
      };
      this.recognition.onresult = event => {
        if (this.discardTranscript) return;
        let finals = '';
        let interims = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          const text = item[0]?.transcript?.trim() || '';
          if (!text) continue;
          if (item.isFinal) finals += (finals ? ' ' : '') + text;
          else interims += (interims ? ' ' : '') + text;
        }
        this.accumulatedTranscript = finals;
        this.interimText = interims;

        const liveText = (finals + (interims ? ' ' + interims : '')).trim();
        this.onInterimTranscript(liveText);

        if (liveText) {
          if (this.bargeInEnabled && (this.speaking || this.processing)) {
            const stopStartedAt = nowMs();
            this.stopSpeaking();
            // Browser recognition exposes no audio-onset timestamp; only the
            // callback-to-stop portion is measurable here.
            this.lastBargeInMetric = {
              source: 'browser-speech',
              gate_ms: null,
              stop_ms: Math.round(nowMs() - stopStartedAt),
              total_ms: null,
              at: new Date().toISOString(),
            };
            this.onBargeIn(liveText);
          }
          // The browser is producing speech data, so its initial no-result
          // watchdog is no longer relevant. The normal short silence timer
          // ends the turn after the customer stops speaking.
          this.clearListenWatchdog();
          this.scheduleSilenceStop();
        }
      };
      this.recognition.onerror = event => {
        const code = event.error || 'unknown';
        // Errors must end this turn. Retrying automatically was the source of
        // a permanent Listening state when Chrome returned no-speech/network.
        this.shouldBeListening = false;
        this.discardTranscript = true;
        this.clearListenWatchdog();
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
        const message = code === 'not-allowed'
          ? t('voice.micDenied', this.languageCode)
          : code === 'no-speech'
            ? t('voice.noSpeech', this.languageCode)
            : t('voice.recognitionError', this.languageCode, { error: code });
        this.onError(message, code);
      };
      this.recognition.onend = () => {
        this.recognitionActive = false;
        this.recognitionStopping = false;
        this.listening = false;
        const pending = this.discardTranscript ? '' :
          (this.accumulatedTranscript + (this.interimText ? ' ' + this.interimText : '')).trim();
        this.accumulatedTranscript = '';
        this.interimText = '';
        this.clearListenWatchdog();
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
        this.onInterimTranscript('');
        if (pending) {
          this.shouldBeListening = false;
          this.onFinalTranscript(pending);
        } else if (this.shouldBeListening && !this.speaking && !this.processing) {
          this.startRecognition();
          return;
        }
        if (!this.speaking && !this.processing) this.onStateChange('idle');
      };
    }
  }

  setLanguage(code) {
    const nextCode = String(code || 'en').split('-')[0];
    const nextLocale = speechLocale(nextCode);
    const changed = this.language !== nextLocale;
    this.languageCode = nextCode;
    this.language = nextLocale;
    if (this.recognition) {
      this.recognition.lang = this.language;
      if (changed && (this.recognitionActive || this.shouldBeListening)) {
        try {
          this.recognitionStopping = true;
          this.recognition.abort();
        } catch (_) {}
        this.recognitionActive = false;
        this.recognitionStopping = false;
        if (this.shouldBeListening) {
          globalThis.setTimeout(() => {
            if (this.shouldBeListening && !this.recognitionActive && !this.speaking) {
              this.startRecognition();
            }
          }, 80);
        }
      }
    }
  }

  setMicrophoneStream(stream) {
    this.geminiLive?.setInputStream(stream);
    this.localWhisper?.setInputStream(stream);
  }

  prepareListening() {
    return this.localWhisper?.prepare?.() || this.geminiLive?.prepare?.() || Promise.resolve(false);
  }

  clearListenWatchdog() {
    if (this.listenWatchdogTimer) clearTimeout(this.listenWatchdogTimer);
    this.listenWatchdogTimer = null;
  }

  armListenWatchdog() {
    this.clearListenWatchdog();
    this.listenWatchdogTimer = setTimeout(() => {
      if (!this.listening || !this.shouldBeListening) return;
      this.shouldBeListening = false;
      if (this.localWhisper?.active || this.geminiLive?.active || this.geminiStarting) {
        this.localWhisper?.cancel();
        this.geminiLive?.cancel();
        this.geminiStarting = false;
        this.recognitionActive = false;
        this.recognitionStopping = false;
        this.listening = false;
        this.onInterimTranscript('');
        this.onError(t('voice.noSpeech', this.languageCode), 'no-speech');
        this.onStateChange('idle');
        return;
      }
      this.onError(t('voice.noSpeech', this.languageCode), 'no-speech');
      this.finishListening();
    }, Math.max(3000, this.listenTimeoutMs));
  }

  scheduleSilenceStop() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.listening && this.shouldBeListening) this.finishListening();
    }, this.silenceTimeoutMs);
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
    // A long response may contain several audio chunks; keep the microphone
    // in echo-protected monitoring until the final chunk has finished.
    if (!speaking && this.queue.length) return;
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    if (!speaking && this.localWhisper?.monitoring) {
      this.localWhisper.endMonitoring();
      this.armListenWatchdog();
    }
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
    if (this.femaleOnly) {
      const knownFemaleName = /\b(aria|jenny|zira|samantha|ava|emma|olivia|serena|susan|hazel|hedda|katja|anna|female|kalpana|geeta|shruti|veena|pallavi|madhur|neerja|swara)\b/i;
      const female = pool.find(voice => knownFemaleName.test(voice.name));
      if (female) return female;
      return pool[0] || null;
    }
    return pool.find(voice => voice.default) || pool[0] || null;
  }

  speak(text, { interrupt = false, allowBargeIn = true } = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean || this.muted) return false;
    if (interrupt) this.stopSpeaking();
    if (!this.bargeInEnabled || !allowBargeIn) {
      if (this.shouldBeListening || this.recognitionActive) this.cancelListening();
    }
    this.queue.push(...splitSpeechText(clean));
    this.processQueue();
    if (this.bargeInEnabled && allowBargeIn && this.recognitionSupported && !this.shouldBeListening && !this.listening) {
      this.startListening({ bargeIn: true });
    }
    return true;
  }

  async processQueue() {
    if (this.processing || this.muted || !this.queue.length) return;

    this.processing = true;
    // Reserve the voice channel while audio is being prepared, including when
    // playback is unavailable, so hands-free input resumes after the attempt.
    this.setSpeaking(true);
    const text = this.queue.shift();
    const run = ++this.runId;

    let spoke = false;
    try {
      const unavailableUntil = this.neuralUnavailableUntil.get(this.languageCode) || 0;
      if (!spoke && (this.provider === 'piper' || this.provider === 'gemini-tts')
        && this.neuralAvailable && Date.now() >= unavailableUntil) {
        spoke = await this.playNeural(text, run);
      }
      if (!spoke && this.fallbackToBrowser && run === this.runId && !this.muted) {
        spoke = await this.playBrowser(text, run);
      }
      // If Windows has no natural female voice installed, keep the requested
      // female-only contract by falling back to the bundled English female
      // model. Never silently switch to the browser's default male voice.
      if (!spoke && this.provider === 'browser' && this.femaleOnly
        && this.languageCode === 'en' && this.neuralAvailable
        && run === this.runId && !this.muted) {
        spoke = await this.playNeural(text, run);
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
            if (run === this.runId && !this.muted) {
              this.setSpeaking(true);
              this.onPlaybackStart({ provider: 'piper', language: this.languageCode });
            } else resolvePromise();
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

    const selectedVoice = this.getPreferredVoice();
    // If no voice explicitly matches female, SpeechSynthesisUtterance will speak using language locale default
    // if (this.femaleOnly && !selectedVoice) return Promise.resolve(false);

    return new Promise(resolvePromise => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.language;
      utterance.rate = Math.min(Math.max(this.rate, 0.75), 1.35);
      utterance.pitch = Math.min(Math.max(this.pitch, 0.75), 1.35);
      if (selectedVoice) utterance.voice = selectedVoice;

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
        if (run === this.runId && !this.muted) {
          this.setSpeaking(true);
          this.onPlaybackStart({ provider: 'browser', language: this.languageCode });
        }
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

  startRecognition() {
    if (this.recognitionActive || this.recognitionStopping) return true;
    try {
      // Mark active before onstart: start() is asynchronous and can otherwise be
      // called twice, or stopped before the browser opens the microphone.
      this.recognitionActive = true;
      this.recognition.start();
      return true;
    } catch (_) {
      this.recognitionActive = false;
      this.shouldBeListening = false;
      this.discardTranscript = true;
      this.clearListenWatchdog();
      this.onError(t('voice.recognitionError', this.languageCode, { error: 'start-failed' }), 'start-failed');
      this.onStateChange('idle');
      return false;
    }
  }

  async startGeminiRecognition() {
    if (!this.geminiLive || this.geminiStarting || this.geminiLive.active) return;
    this.geminiStarting = true;
    this.recognitionActive = true;
    this.listening = true;
    this.onStateChange('listening');
    try {
      await this.geminiLive.start({
        onInterim: text => {
          if (this.bargeInEnabled && (this.speaking || this.processing)) {
            this.stopSpeaking();
            this.onBargeIn(text);
          }
          if (!this.shouldBeListening) return;
          this.clearListenWatchdog();
          this.onInterimTranscript(text);
          this.scheduleSilenceStop();
        },
        onFinal: text => this.completeGeminiTranscript(text),
        onError: code => this.completeGeminiError(code),
      });
      this.geminiStarting = false;
      if (!this.shouldBeListening) {
        this.geminiLive.cancel();
        return;
      }
      this.armListenWatchdog();
    } catch (error) {
      this.geminiStarting = false;
      this.recognitionActive = false;
      this.listening = false;
      // The standard browser recognizer remains an automatic fallback when a
      // Gemini Live token is not configured, has expired, or cannot connect.
      if (this.shouldBeListening && this.recognition) {
        this.startRecognition();
        return;
      }
      this.shouldBeListening = false;
      const code = String(error?.message || 'gemini_live_unavailable').replace(/^Error:\s*/, '');
      this.onError(t('voice.recognitionError', this.languageCode, { error: code }), code);
      this.onStateChange('idle');
    }
  }

  async startLocalWhisperRecognition() {
    if (!this.localWhisper || this.geminiStarting || this.localWhisper.active) return;
    this.geminiStarting = true;
    this.recognitionActive = true;
    this.listening = true;
    this.onStateChange(this.speaking ? 'speaking' : 'listening');
    try {
      await this.localWhisper.start({
        monitoring: this.bargeInEnabled && (this.speaking || this.processing),
        onSpeechStart: () => {
          if (!this.shouldBeListening) return;
          const detectedAt = this.localWhisper.speechStartAt ?? nowMs();
          const firstSpeechAt = this.localWhisper.monitoringFirstSpeechAt;
          const gateMs = firstSpeechAt == null ? null : Math.round(detectedAt - firstSpeechAt);
          const stopStartedAt = nowMs();
          this.stopSpeaking({ preserveMonitorAudio: true });
          const stopMs = Math.round(nowMs() - stopStartedAt);
          this.lastBargeInMetric = {
            source: 'local-whisper-acoustic',
            gate_ms: gateMs,
            stop_ms: stopMs,
            total_ms: gateMs == null ? null : gateMs + stopMs,
            at: new Date().toISOString(),
          };
          this.onBargeIn('activity');
          this.onStateChange('listening');
        },
        onActivity: () => {
          if (!this.shouldBeListening) return;
          this.clearListenWatchdog();
          this.scheduleSilenceStop();
        },
        onFinal: text => this.completeGeminiTranscript(text),
        onError: code => this.completeGeminiError(code),
      });
      this.geminiStarting = false;
      if (!this.shouldBeListening) return this.localWhisper.cancel();
      if (!this.speaking && !this.processing) {
        this.localWhisper.endMonitoring();
        this.armListenWatchdog();
      }
    } catch (error) {
      this.geminiStarting = false;
      this.recognitionActive = false;
      this.listening = false;
      if (this.shouldBeListening && this.recognition && !this.localWhisperEnabled) return this.startRecognition();
      this.shouldBeListening = false;
      const code = String(error?.message || 'local_whisper_unavailable');
      this.onError(t('voice.recognitionError', this.languageCode, { error: code }), code);
      this.onStateChange('idle');
    }
  }

  completeGeminiTranscript(text) {
    const transcript = String(text || '').trim();
    this.geminiStarting = false;
    this.recognitionActive = false;
    this.recognitionStopping = false;
    this.listening = false;
    this.shouldBeListening = false;
    this.clearListenWatchdog();
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    this.onInterimTranscript('');
    if (transcript) this.onFinalTranscript(transcript);
    else this.onError(t('voice.noSpeech', this.languageCode), 'no-speech');
    // Fetch the next one-use token while n8n and TTS are working, so the next
    // microphone turn does not wait for token provisioning.
    this.prepareListening().catch(() => {});
    if (!this.speaking && !this.processing) this.onStateChange('idle');
  }

  completeGeminiError(code) {
    this.geminiStarting = false;
    this.recognitionActive = false;
    this.recognitionStopping = false;
    this.listening = false;
    this.shouldBeListening = false;
    this.discardTranscript = true;
    this.clearListenWatchdog();
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    this.onInterimTranscript('');
    const message = code === 'no-speech'
      ? t('voice.noSpeech', this.languageCode)
      : t('voice.recognitionError', this.languageCode, { error: code || 'gemini_live_error' });
    this.onError(message, code || 'gemini_live_error');
    if (!this.speaking && !this.processing) this.onStateChange('idle');
  }

  startListening(options = {}) {
    if (!this.recognitionSupported) return false;
    if ((this.speaking || this.processing) && !options.bargeIn && !this.bargeInEnabled) return false;
    if (this.shouldBeListening) return true;
    this.shouldBeListening = true;
    this.discardTranscript = false;
    this.accumulatedTranscript = '';
    this.interimText = '';
    if (this.localWhisperEnabled) {
      this.startLocalWhisperRecognition();
      return true;
    }
    if (this.geminiLiveEnabled) {
      this.startGeminiRecognition();
      return true;
    }
    // An earlier stop is still completing. onend will start the new session.
    if (this.recognitionStopping) return true;
    return this.startRecognition();
  }

  finishListening() {
    this.clearListenWatchdog();
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    if (this.localWhisper?.active) {
      this.shouldBeListening = false;
      this.recognitionStopping = true;
      this.listening = false;
      this.onInterimTranscript('');
      this.onStateChange('thinking');
      // Translation mode must detect the spoken language itself. Passing the
      // assistant's current English voice locale caused non-English speech to
      // be decoded as if it were English.
      const whisperLanguage = this.localWhisper.translate
        ? 'auto'
        : (this.languageCode === 'auto' ? 'auto' : this.languageCode);
      this.localWhisper.finish(whisperLanguage);
      return;
    }
    if (this.geminiLive?.active) {
      this.shouldBeListening = false;
      this.recognitionStopping = true;
      this.listening = false;
      this.onInterimTranscript('');
      this.onStateChange('thinking');
      this.geminiLive.finish();
      return;
    }
    if (this.geminiStarting) {
      this.shouldBeListening = false;
      this.localWhisper?.cancel();
      this.geminiLive?.cancel();
      this.geminiStarting = false;
      this.recognitionActive = false;
      this.listening = false;
      this.onStateChange('idle');
      return;
    }
    this.shouldBeListening = false;
    if (this.recognitionActive && !this.recognitionStopping) {
      this.recognitionStopping = true;
      try { this.recognition.stop(); return; } catch (_) { this.recognitionStopping = false; }
    }
    if (!this.recognitionActive) this.recognition.onend();
  }

  stopListening() {
    this.finishListening();
  }

  cancelListening() {
    this.clearListenWatchdog();
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    this.shouldBeListening = false;
    this.discardTranscript = true;
    this.accumulatedTranscript = '';
    this.interimText = '';
    this.onInterimTranscript('');
    if (this.localWhisperEnabled || this.geminiLive?.active || this.geminiStarting) {
      this.geminiLive?.cancel();
      this.localWhisper?.cancel();
      this.geminiStarting = false;
      this.recognitionActive = false;
      this.recognitionStopping = false;
      this.listening = false;
      this.onStateChange('idle');
      return;
    }
    if (this.recognitionActive && !this.recognitionStopping) {
      this.recognitionStopping = true;
      try { this.recognition.abort(); } catch (_) { this.recognitionActive = false; this.recognitionStopping = false; }
    }
    this.listening = false;
  }

  stopSpeaking({ preserveMonitorAudio = false } = {}) {
    this.runId += 1;
    this.queue.length = 0;
    this.processing = false;
    this.speaking = false;
    if (this.localWhisper?.monitoring) {
      this.localWhisper.endMonitoring({ preserve: preserveMonitorAudio });
      if (this.shouldBeListening) this.armListenWatchdog();
    }

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



  getDiagnostics() {
    return {
      recognition_mode: this.localWhisperEnabled
        ? 'local-whisper'
        : this.geminiLiveEnabled ? 'gemini-live' : this.recognition ? 'browser' : 'none',
      recognition_active: this.recognitionActive,
      listening: this.listening,
      speaking: this.speaking,
      processing: this.processing,
      should_be_listening: this.shouldBeListening,
      monitoring: this.localWhisper?.monitoring === true,
      last_barge_in: this.lastBargeInMetric,
      last_transcription_ms: this.localWhisper?.lastTranscriptionMs ?? null,
    };
  }

  resetDiagnostics() {
    this.lastBargeInMetric = null;
    if (this.localWhisper) this.localWhisper.lastTranscriptionMs = null;
  }

  destroy() {
    this.cancelListening();
    this.stopSpeaking();
  }
}

