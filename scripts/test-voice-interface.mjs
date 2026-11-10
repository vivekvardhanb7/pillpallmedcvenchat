import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/voice.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../web/voice-experience.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const voiceAssistant = readFileSync(new URL('../web/voice-assistant.js', import.meta.url), 'utf8');
const localWhisper = readFileSync(new URL('../web/local-whisper-transcriber.js', import.meta.url), 'utf8');

const requiredIds = [
  'languageSelect', 'voiceStatus', 'visualizer', 'startButton', 'microphoneButton',
  'microphoneLabel', 'muteButton', 'endSessionButton', 'restartButton', 'themeToggle',
  'themeIcon', 'themeLabel', 'progressIndicator', 'app', 'answerConfirmation',
  'answerConfirmationText', 'confirmAnswerButton', 'changeAnswerButton', 'chatForm',
  'chatInput', 'sendChatButton', 'repeatQuestionButton', 'cameraButton', 'cameraInput',
  'imagePreviewContainer', 'imagePreviewThumb', 'clearImageButton', 'transcript',
  'transcriptActivity', 'transcriptActivityText', 'interimTranscript', 'operatorBadge',
  'operatorBadgeText', 'operatorBadgeDismiss', 'voiceCaption', 'voiceCaptionRole',
  'voiceDiagnostics', 'diagnosticsList', 'diagnosticsClose', 'diagnosticsExport', 'diagnosticsReset',
];

for (const id of requiredIds) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
  assert.equal(matches.length, 1, `voice.html must contain exactly one #${id}`);
}

for (const state of ['listening', 'thinking', 'speaking', 'error', 'ended']) {
  assert.match(css, new RegExp(`data-voice-state=["']${state}["']`), `missing ${state} visual state`);
}

assert.match(html, /voice-experience\.js/);
assert.match(controller, /navigator\.onLine/);
assert.match(controller, /MutationObserver/);
assert.match(controller, /microphone\.click\(\)/);
assert.match(controller, /transcriptDrawer/);
assert.match(controller, /textDrawer/);
assert.match(app, /function naturalVoiceQuestion/);
assert.match(voiceAssistant, /LocalWhisperTranscriber/);
assert.match(voiceAssistant, /localWhisperEnabled/);
assert.match(localWhisper, /audio\/wav/);
assert.match(localWhisper, /translate/);
assert.match(app, /return assessmentSpeech\(screen, activeLanguage\(\), \{ summary: current\?\.summary \}\)/);
assert.match(app, /Number\(aiAnswer\.confidence\) >= 0\.85/);
assert.match(app, /function safeAiVolunteeredContext/);
assert.equal((app.match(/voice\.onBargeIn\s*=/g) || []).length, 1, 'barge-in must have one handler; a second assignment drops safety flags');
assert.match(app, /function handleVoiceBargeIn/);
assert.match(app, /interruptedWarning = true/);
assert.match(app, /interruptedConfirmation = true/);
assert.match(app, /PILLPAL_VOICE_METRICS/);
assert.match(voiceAssistant, /preserveMonitorAudio/);
assert.match(voiceAssistant, /lastBargeInMetric/);
assert.match(localWhisper, /preserve = false/);
assert.match(localWhisper, /monitoringFirstSpeechAt/);
assert.doesNotMatch(app.match(/function naturalVoiceQuestion[\s\S]*?\n}/)?.[0] || '', /\btype\b|touch (?:an|the|one|option)|displayed choices/i);

console.log('Premium voice interface contract tests passed.');
