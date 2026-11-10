// Copy to web/config.js. Country enforcement lives on the server (PILLPAL_COUNTRY_CODE).
// Browser configuration is public. Do not put backend credentials here.
window.PILLPAL_CONFIG = {
  // The browser always uses the local assessment service.
  webhookUrl: '/api/chat-turn',
  countryCode: 'DE',
  // "auto" detects the customer's spoken language. Explicit languages remain
  // available as a fallback. The deterministic workflow values stay unchanged.
  languageCode: 'de',
  catalogLanguageCode: 'de',
  inactivityMs: 120000,

  // Voice-first layout: the microphone reopens after each spoken prompt, the
  // read-back can be answered with "yes" or "no", and the touch options shrink to
  // a fallback. Speech only maps onto the same fixed option values a tap sends;
  // it never reaches the decision engine any differently.
  voiceFirst: true,

  // Understanding uses the same-origin /api/understand bridge. Configure optional
  // providers only in .env. Do not put n8n or provider credentials in this file.

  voice: {
    provider: 'piper',
    ttsUrl: '/api/tts',
    fallbackToBrowser: true,
    // Set true after GEMINI_LIVE_TRANSCRIBE=1 and GEMINI_API_KEY are configured
    // in .env. The kiosk server issues a one-use short-lived token; the API key
    // is never sent to the browser.
    geminiLive: false,
    // Fully local speech recognition through whisper.cpp.
    localWhisper: true,
    bargeIn: true,
    localWhisperUrl: '/api/transcribe',
    localWhisperTranslate: false,
    voiceActivityThreshold: 0.004,
    geminiTokenUrl: '/api/gemini-live-token',
    // End a turn after a natural short pause. Increase to 1400-1600 for users
    // who speak slowly; values below 800 can cut sentences off.
    silenceTimeoutMs: 1800,
    language: 'de-DE',
    rate: 0.96,
    pitch: 1.03,
    femaleOnly: true,
    preferredNames: [
      'Microsoft Aria',
      'Microsoft Jenny',
      'Microsoft Zira',
      'Samantha',
      'Microsoft Katja',
      'Microsoft Hedda',
    ],
  },
};
