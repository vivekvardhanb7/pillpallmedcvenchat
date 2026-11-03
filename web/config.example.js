// Copy this file to web/config.js and fill in the two values below.
// web/config.js is deliberately git-ignored: it holds the kiosk key, which is
// served to the browser and must stay out of version control.
window.PILLPAL_CONFIG = {
  // Use /webhook-test/pillpal-chat-turn only while listening in n8n test mode.
  // Use /webhook/pillpal-chat-turn after the workflow is activated.
  webhookUrl: 'https://YOUR_N8N_HOST/webhook/pillpal-chat-turn',
  // Must match the Value of the Header Auth credential selected in the
  // Chat Turn Webhook node. Leave empty until that credential is set up.
  webhookSecret: '',
  countryCode: 'MA',
  languageCode: 'en',
  inactivityMs: 120000,
  voice: {
    provider: 'piper',
    ttsUrl: '/api/tts',
    fallbackToBrowser: true,
    language: 'en-US',
    rate: 1.08,
    pitch: 1.02,
    preferredNames: [
      'Microsoft Aria',
      'Microsoft Jenny',
      'Microsoft Zira',
      'Samantha',
      'Google US English',
      'Microsoft Katja',
      'Microsoft Hedda',
      'Google Deutsch',
    ],
  },
};
