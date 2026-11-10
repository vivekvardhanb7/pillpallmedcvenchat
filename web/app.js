import { assessmentSpeech } from './assessment-speech.js';
import { VoiceAssistant } from './voice-assistant.js';
import { resolveVoiceAnswer, resolveConfirmationReply } from './voice-input-mapper.js';
import {
  looksLikeQuestion,
  isQuestionByWording,
  isEmergencyWording,
  isMedicineRequest,
  normalizeIntentText,
  extractVolunteeredContext,
  extractVolunteeredSafetyContext,
  detectDetailedSymptomContext,
  socialIntent,
} from './question-intent.js';
import {
  detectMedicineMention,
  detectConditionMention,
  hasKnownPrecaution,
} from './medicine-mentions.js';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  detectLanguage,
  languageByCode,
  localizeResult as rawLocalizeResult,
  localizeScreen as rawLocalizeScreen,
  localizeSummary as rawLocalizeSummary,
  optionSubtitle,
  speechLocale,
  summaryValue as rawSummaryValue,
  t as rawT,
} from './i18n.js';

const config = { ...(window.PILLPAL_CONFIG || {}), activeEndpoint: '/api/chat-turn',
  webhookSecret: '', understandUrl: '/api/understand', understandStatusUrl: '/api/understand' };
const app = document.querySelector('#app');
const restartButton = document.querySelector('#restartButton');
const endSessionButton = document.querySelector('#endSessionButton');
const startButton = document.querySelector('#startButton');
const microphoneButton = document.querySelector('#microphoneButton');
const microphoneLabel = document.querySelector('#microphoneLabel');
const muteButton = document.querySelector('#muteButton');
const themeToggle = document.querySelector('#themeToggle');
const themeIcon = document.querySelector('#themeIcon');
const themeLabel = document.querySelector('#themeLabel');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const themeMedia = globalThis.matchMedia?.('(prefers-color-scheme: light)');
const languageSelect = document.querySelector('#languageSelect');
const voiceStatus = document.querySelector('#voiceStatus');
const voiceCaption = document.querySelector('#voiceCaption');
const voiceCaptionRole = document.querySelector('#voiceCaptionRole');
const transcript = document.querySelector('#transcript');
const interimTranscript = document.querySelector('#interimTranscript');
const transcriptActivity = document.querySelector('#transcriptActivity');
const transcriptActivityText = document.querySelector('#transcriptActivityText');
const transcriptPanel = document.querySelector('.transcript-panel');
const interactionColumn = document.querySelector('.interaction-column');
const visualizer = document.querySelector('#visualizer');
const progressIndicator = document.querySelector('#progressIndicator');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const sendChatButton = document.querySelector('#sendChatButton');
const repeatQuestionButton = document.querySelector('#repeatQuestionButton');
const answerConfirmation = document.querySelector('#answerConfirmation');
const answerConfirmationText = document.querySelector('#answerConfirmationText');
const confirmAnswerButton = document.querySelector('#confirmAnswerButton');
const changeAnswerButton = document.querySelector('#changeAnswerButton');
const operatorBadge = document.querySelector('#operatorBadge');
const operatorBadgeText = document.querySelector('#operatorBadgeText');
const operatorBadgeDismiss = document.querySelector('#operatorBadgeDismiss');
const cameraButton = document.querySelector('#cameraButton');
const cameraInput = document.querySelector('#cameraInput');
const imagePreviewContainer = document.querySelector('#imagePreviewContainer');
const imagePreviewThumb = document.querySelector('#imagePreviewThumb');
const clearImageButton = document.querySelector('#clearImageButton');

// Build both page selectors from one catalogue so newly supported languages do
// not require duplicated HTML edits. German is the deployment default.
if (languageSelect) {
  const options = LANGUAGES.map(language => {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = language.code === 'auto'
      ? 'AUTO · Deutsch / English'
      : `${language.short} · ${language.label}${['de', 'en'].includes(language.code) ? '' : (language.code === 'hi' ? ' · Preview / English fallback' : ' · English fallback')}`;
    return option;
  });
  languageSelect.replaceChildren(...options);
}

let attachedImage = null;

// Voice-first keeps the microphone open after every spoken prompt and demotes the
// touch options to a fallback. Speech never reaches the decision engine: it is
// mapped onto the same fixed option values the buttons send.
const voiceOnlyPage = document.body.classList.contains('voice-only-page');
const voiceFirst = voiceOnlyPage || config.voiceFirst === true;

const LANGUAGE_STORAGE_KEY = 'pillpal-language';
let currentLanguage = readStoredLanguage();
let conversationLanguage = currentLanguage === 'auto' ? null : currentLanguage;
const voice = new VoiceAssistant({
  ...(config.voice || {}),
  languageCode: currentLanguage,
  language: speechLocale(currentLanguage),
});
let current = null;
let busy = false;
let started = false;
let muted = false;
let voiceMode = 'idle';
let interpretingAnswer = false;
let handsFreeArmed = false;
let handsFreeBlocked = false;
let interruptedWarning = false;
let interruptedConfirmation = false;
let transcriptEntries = [];
let lastAnnouncedKey = '';
let pendingAnswer = null;
let pendingSubmission = null;
let pendingSubmissionTimer = null;
let lastActivityAt = Date.now();
let sessionVolunteeredContext = {};
let acknowledgedVolunteeredQuestions = new Set();
let trustedVolunteeredQuestions = new Set();
const confirmedConversationFacts = new Map();
let sessionSymptomContext = null;
// Speech recognition can deliver the same final transcript twice, and a
// read-back confirmation is often followed by an echoed "Correct". Both would
// otherwise be appended as new customer turns or answers.
let lastVoiceTranscript = '';
let lastVoiceTranscriptAt = 0;
let lastSubmissionAt = 0;

// Hardware acceptance metrics. These never contain transcript text or patient
// facts: only question ids, timing and recognition mode.
const voiceMetrics = { responses: [], barge_ins: [], turn_requests: [], errors: [] };
let voiceTurnStartedAt = null;
let voiceTurnLabel = null;
let voicePlaybackRecorded = false;
let lastRecordedBargeInMetric = null;

function beginVoiceTurn(label) {
  voiceTurnStartedAt = globalThis.performance?.now?.() ?? Date.now();
  voiceTurnLabel = label;
  voicePlaybackRecorded = false;
}

function recordVoicePlaybackStart() {
  if (voiceTurnStartedAt == null || voicePlaybackRecorded) return;
  voicePlaybackRecorded = true;
  const elapsed = (globalThis.performance?.now?.() ?? Date.now()) - voiceTurnStartedAt;
  voiceMetrics.responses.push({
    label: voiceTurnLabel,
    ms: Math.round(elapsed),
    at: new Date().toISOString(),
  });
}

let operatorBadgeMessage = null;
let operatorBadgePressTimer = null;
let bootConfigText = null;
let notifiedConfigText = null;
let pendingConfigNotice = false;
const dismissedOperatorKinds = new Set();

// The answer helper is an optional extra path into the same fixed answers. When
// it is off, unreachable or unsure, the kiosk behaves exactly as before.
// config.understandUrl can point at the hosted n8n sidecar instead of the kiosk's
// own /api/understand bridge; both speak the same contract.
const understandingUrl = config.understandUrl || '/api/understand';
const understandingStatusUrl = config.understandStatusUrl || understandingUrl;
// The hosted sidecar waits up to 20 s for the provider, so the kiosk must not
// give up before that answer comes back.
const understandingTimeoutMs = 25000;
const understanding = { available: false, disabledUntil: 0 };

function understandingHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (config.webhookSecret) headers['X-PILLPAL-Auth'] = config.webhookSecret;
  return headers;
}

const THEME_STORAGE_KEY = 'pillpal-theme';
let storedTheme = readStoredTheme();

function readStoredLanguage() {
  try {
    const stored = languageByCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (stored) return stored.code;
  } catch (_) {
    /* storage can be unavailable in private kiosk modes */
  }
  const configured = languageByCode(config.languageCode);
  return configured ? configured.code : DEFAULT_LANGUAGE;
}

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (_) {
    return null;
  }
}

function applyTheme(theme) {
  const resolved = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = resolved;
  themeToggle?.setAttribute('aria-label', t(resolved === 'light' ? 'theme.switchToDark' : 'theme.switchToLight', currentLanguage));
  if (themeIcon) themeIcon.textContent = resolved === 'light' ? '☀' : '☾';
  if (themeLabel) themeLabel.textContent = t(resolved === 'light' ? 'theme.light' : 'theme.dark', currentLanguage);
  if (themeColorMeta) themeColorMeta.setAttribute('content', resolved === 'light' ? '#edf7f1' : '#04100a');
  document.dispatchEvent(new CustomEvent('pillpal-theme', { detail: { theme: resolved } }));
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  storedTheme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch (_) {
    /* storage can be unavailable in private kiosk modes */
  }
  applyTheme(next);
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n, currentLanguage);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder, currentLanguage);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel, currentLanguage));
  });
}

function updateMuteLabel() {
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', t(muted ? 'voice.enable' : 'voice.mute', currentLanguage));
  const label = muteButton.querySelector('.button-label');
  if (label) label.textContent = t(muted ? 'voice.off' : 'voice.on', currentLanguage);
}

function setLanguage(code, { persist = true, speakCurrent = false } = {}) {
  const language = languageByCode(code);
  if (!language) return;
  const changed = language.code !== currentLanguage;
  currentLanguage = language.code;
  conversationLanguage = language.code === 'auto' ? null : language.code;
  document.documentElement.lang = conversationLanguage || 'de';
  if (languageSelect) languageSelect.value = language.code;
  voice.setLanguage(conversationLanguage || 'de');
  refreshVoiceAvailability();
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
    } catch (_) {
      /* storage can be unavailable in private kiosk modes */
    }
  }
  applyStaticTranslations();
  let coverageNotice = document.querySelector('#languageCoverageNotice');
  if (!coverageNotice) {
    coverageNotice = document.createElement('p');
    coverageNotice.id = 'languageCoverageNotice';
    coverageNotice.setAttribute('role', 'status');
    document.querySelector('main')?.prepend(coverageNotice);
  }
  coverageNotice.hidden = ['de', 'en', 'auto'].includes(language.code);
  coverageNotice.textContent = language.code === 'hi'
    ? 'हिन्दी पूर्वावलोकन: कुछ प्रश्न अंग्रेज़ी में हैं। आवाज़ और चिकित्सा अनुवाद का सत्यापन बाकी है। Hindi preview: some content remains English; voice and clinical translations are not validated.'
    : 'English fallback: this language and its voice input have not been validated. Please use English, Deutsch, or ask for help.';
  applyTheme(document.documentElement.dataset.theme || (themeMedia?.matches ? 'light' : 'dark'));
  updateMuteLabel();
  renderOperatorBadge();
  if (started && current?.screen && !busy) render();
  updateProgress();
  setInteractiveControls();
  setVoiceMode(voiceMode);
  if (!changed) return;
  if (speakCurrent && started && current?.screen && !busy) {
    voice.stopSpeaking();
    lastAnnouncedKey = '';
    announceCurrent();
  }
}

function activeLanguage() {
  return (currentLanguage === 'auto' ? conversationLanguage : currentLanguage) || 'de';
}

function t(key, lang = activeLanguage(), vars) {
  const resolvedLang = (!lang || lang === 'auto') ? activeLanguage() : lang;
  return rawT(key, resolvedLang, vars);
}

function localizeScreen(screen, lang = activeLanguage()) {
  const resolvedLang = (!lang || lang === 'auto') ? activeLanguage() : lang;
  return rawLocalizeScreen(screen, resolvedLang);
}

function localizeResult(result, lang = activeLanguage()) {
  const resolvedLang = (!lang || lang === 'auto') ? activeLanguage() : lang;
  return rawLocalizeResult(result, resolvedLang);
}

function localizeSummary(summary, lang = activeLanguage()) {
  const resolvedLang = (!lang || lang === 'auto') ? activeLanguage() : lang;
  return rawLocalizeSummary(summary, resolvedLang);
}

function summaryValue(key, value, lang = activeLanguage()) {
  const resolvedLang = (!lang || lang === 'auto') ? activeLanguage() : lang;
  return rawSummaryValue(key, value, resolvedLang);
}

function maybeSwitchLanguage(text) {
  const detected = detectLanguage(text);
  if (!detected) return false;
  if (currentLanguage === 'auto') {
    if (detected !== conversationLanguage) {
      conversationLanguage = detected;
      document.documentElement.lang = detected;
      voice.setLanguage(detected);
      applyStaticTranslations();
      updateMuteLabel();
      if (started && current?.screen && !busy) render();
      return true;
    }
    return false;
  }
  if (detected === currentLanguage) return false;
  setLanguage(detected, { persist: false });
  return true;
}

const translatedTextCache = new Map();

async function translateAssistantText(text) {
  const clean = cleanTranscriptText(text);
  const target = activeLanguage();
  if (!clean || !target || target === 'en') return clean;
  if (detectLanguage(clean) === target) return clean;
  const key = `${target}\n${clean}`;
  if (translatedTextCache.has(key)) return translatedTextCache.get(key);
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, target_language: target }),
    });
    if (!response.ok) return clean;
    const translated = cleanTranscriptText((await response.json())?.translation);
    if (!translated) return clean;
    if (translatedTextCache.size > 300) translatedTextCache.clear();
    translatedTextCache.set(key, translated);
    return translated;
  } catch (_) {
    return clean;
  }
}

async function sayAssistant(text, key, options = {}) {
  // Approved assessment wording must not be silently rewritten by a cloud translator.
  const spoken = text;
  appendTranscript('assistant', spoken, key);
  voice.setLanguage(activeLanguage());
  return voice.speak(spoken, {
    allowBargeIn: started && !handsFreeBlocked && !current?.state?.completed,
    ...options,
  });
}

// Confirmations are reserved for the few answers where a misheard value is both
// plausible and consequential: red-flag answers, ages captured from spoken
// number words, and free-text history entries. Everything else maps to fixed
// controlled values and is reviewed again on the final summary screen.
function needsAnswerConfirmation(questionId, answer, text) {
  if (questionId === 'warning_signs') {
    // A positive or uncertain warning answer escalates immediately.
    if (['yes', 'not_sure'].includes(answer?.value)) return false;
    const clearNegative = answer?.value === 'no'
      && /\b(?:no|none|nothing|don'?t|do not|not have|without|nein|keine|nichts)\b/i.test(text);
    return !clearNegative;
  }
  if (questionId.endsWith('_terms')) return true;
  if (questionId === 'age') return !/\d/.test(text);
  return false;
}

function createSessionId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `kiosk_${uuid.replaceAll('-', '_')}` : `kiosk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

let sessionId = createSessionId();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanTranscriptText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
}

function markActivity() {
  lastActivityAt = Date.now();
}

function renderOperatorBadge() {
  if (!operatorBadge || !operatorBadgeMessage) return;
  const { kind } = operatorBadgeMessage;
  const text = kind === 'config'
    ? t('setup.configUpdated', currentLanguage)
    : `${t('setup.prefix', currentLanguage)} ${t(operatorBadgeMessage.key, currentLanguage)}`;
  const dismissed = dismissedOperatorKinds.has(kind);
  operatorBadge.dataset.kind = kind;
  operatorBadgeText.textContent = text;
  operatorBadge.hidden = dismissed;
  document.body.classList.toggle('operator-badge-active', !dismissed);
}

function showOperatorBadge(kind, key) {
  dismissedOperatorKinds.delete(kind);
  operatorBadgeMessage = { kind, key };
  renderOperatorBadge();
}

function dismissOperatorBadge() {
  if (!operatorBadgeMessage) return;
  dismissedOperatorKinds.add(operatorBadgeMessage.kind);
  renderOperatorBadge();
}

function startOperatorBadgePress() {
  globalThis.clearTimeout(operatorBadgePressTimer);
  operatorBadgePressTimer = globalThis.setTimeout(dismissOperatorBadge, 700);
}

function cancelOperatorBadgePress() {
  globalThis.clearTimeout(operatorBadgePressTimer);
  operatorBadgePressTimer = null;
}

function workflowHeaders() {
  const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
  if (config.webhookSecret) headers['X-PILLPAL-Auth'] = config.webhookSecret;
  return headers;
}

function connectionHintKey(status) {
  const code = Number(status) || 0;
  if (code === 401 || code === 403) return config.webhookSecret ? 'error.authHint' : 'error.secretMissingHint';
  if (code === 404 || code >= 500) return 'error.workflowHint';
  return code ? 'error.connectionHint' : 'error.networkHint';
}

// The probe is an operator-facing check only: it must never touch `current`,
// the transcript, or speech, so the customer state machine starts clean.
async function runStartupSelfCheck() {
  try {
    const response = await fetch('/api/sync/status', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Local service unavailable');
    const status = await response.json();
    config.countryCode = status.deployment_country;
    if (!status.medicine_recommendations_ready) showOperatorBadge('setup', 'setup.catalogPending');
  } catch (_) {
    showOperatorBadge('setup', 'error.connectionHint');
  }
}

function startStartupSelfCheck() {
  const run = () => { runStartupSelfCheck().catch(() => {}); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
    return;
  }
  globalThis.setTimeout(run, 0);
}

async function readConfigText() {
  try {
    const response = await fetch('/config.js', { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.text();
  } catch (_) {
    return null;
  }
}

function showConfigNotice() {
  if (busy) {
    pendingConfigNotice = true;
    return;
  }
  pendingConfigNotice = false;
  showOperatorBadge('config', 'setup.configUpdated');
}

function flushConfigNotice() {
  if (pendingConfigNotice) showConfigNotice();
}

async function startConfigWatcher() {
  bootConfigText = await readConfigText();
  if (bootConfigText === null) return;
  globalThis.setInterval(async () => {
    const text = await readConfigText();
    if (!text || text === bootConfigText || text === notifiedConfigText) return;
    notifiedConfigText = text;
    showConfigNotice();
  }, 60000);
}

async function refreshVoiceAvailability() {
  try {
    const response = await fetch(voice.ttsUrl, { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    const model = status?.models?.[currentLanguage];
    if (model && typeof model.available === 'boolean') voice.setNeuralAvailability(currentLanguage, model.available);
  } catch (_) {
    /* the browser voice remains the fallback when the probe cannot be read */
  }
}

function clearAttachedImage() {
  attachedImage = null;
  if (cameraInput) cameraInput.value = '';
  if (imagePreviewContainer) imagePreviewContainer.hidden = true;
  if (imagePreviewThumb) {
    imagePreviewThumb.hidden = true;
    imagePreviewThumb.src = '';
    imagePreviewThumb.removeAttribute('src');
  }
}

function readAndResizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const prefix = 'data:image/jpeg;base64,';
        const base64Data = dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : dataUrl.split(',')[1];
        resolve({ mimeType: 'image/jpeg', data: base64Data });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setInteractiveControls() {
  const productConversation = Boolean(current?.state?.completed && current?.product);
  const canAnswer = !busy && ((started && Boolean(current?.screen)
    && (current?.state?.completed !== true || productConversation)) || !started);
  chatInput.disabled = !canAnswer;
  sendChatButton.disabled = !canAnswer;
  repeatQuestionButton.disabled = !started || busy || !current?.screen;
  restartButton.disabled = !started;
  endSessionButton.disabled = !started;
  microphoneButton.disabled = !canAnswer || !voice.recognitionSupported;
  if (cameraButton) cameraButton.disabled = !canAnswer;
  if (canAnswer && started && current?.screen) {
    const screen = localizeScreen(current.screen, activeLanguage());
    chatInput.placeholder = pendingAnswer ? t('chat.isCorrect', activeLanguage()) : productConversation
      ? t('chat.productQuestion', activeLanguage())
      : screen.type === 'number'
      ? t('chat.typeAge', activeLanguage())
      : screen.type === 'text'
        ? screen.placeholder || t('chat.placeholderDefault', activeLanguage())
        : t('chat.placeholderOption', activeLanguage());
  } else {
    chatInput.placeholder = started ? t('chat.completeStep', activeLanguage()) : t('chat.startToChat', activeLanguage());
  }
}

function isCompleted() {
  return Boolean(current?.state?.completed)
    || current?.screen?.type === 'result'
    || current?.screen?.type === 'product_result';
}

function updateProgress() {
  const step = current?.state?.step || 'symptom';
  const stages = ['symptoms', 'safety', 'history', 'review'];
  const stageByStep = {
    symptom: 'symptoms',
    age: 'safety',
    duration: 'safety',
    severity: 'safety',
    warning_signs: 'safety',
    pregnancy_breastfeeding: 'history',
    allergy_status: 'history',
    allergy_terms: 'history',
    medication_status: 'history',
    medication_terms: 'history',
    condition_status: 'history',
    condition_terms: 'history',
    confirm: 'review',
    complete: 'review',
  };
  const activeStage = started ? stageByStep[step] || 'symptoms' : null;
  const activeIndex = stages.indexOf(activeStage);
  const completed = isCompleted();
  progressIndicator.querySelectorAll('[data-stage]').forEach(element => {
    const index = stages.indexOf(element.dataset.stage);
    element.classList.toggle('active', !completed && index === activeIndex);
    element.classList.toggle('complete', completed || (activeIndex >= 0 && index < activeIndex));
  });
}

let autoConfirmTimer = null;
let autoConfirmInterval = null;

function clearAutoConfirm() {
  if (autoConfirmTimer) {
    clearTimeout(autoConfirmTimer);
    autoConfirmTimer = null;
  }
  if (autoConfirmInterval) {
    clearInterval(autoConfirmInterval);
    autoConfirmInterval = null;
  }
}

function hideAnswerConfirmation() {
  clearAutoConfirm();
  pendingAnswer = null;
  answerConfirmation.hidden = true;
  answerConfirmationText.textContent = '';
  confirmAnswerButton.textContent = t('chat.correctAnswer', currentLanguage);
  setInteractiveControls();
}

function showAnswerConfirmation(answer, source, customPrompt = null) {
  clearAutoConfirm();
  pendingAnswer = { ...answer, source };
  const verb = source === 'voice' ? t('chat.heard', currentLanguage) : t('chat.understood', currentLanguage);
  const prompt = customPrompt || `${verb} ${answer.label}. ${t('chat.isCorrect', currentLanguage)}`;
  answerConfirmationText.textContent = prompt;
  answerConfirmation.hidden = false;
  setInteractiveControls();
  sayAssistant(prompt, `confirm-input:${current?.screen?.question_id}:${answer.label}`, { interrupt: true });

  // Volunteered information is convenient, but it is still safety data. Keep
  // the confirmation on screen until the customer explicitly confirms it;
  // silently advancing after a countdown looked like a skipped question and
  // could accept a recognition error.
  confirmAnswerButton.textContent = t('chat.correctAnswer', currentLanguage);
}

// One re-open per spoken prompt: the arming is consumed here, so a listener that
// hears nothing cannot restart itself in a loop - the customer taps the
// microphone again. A pending read-back is included on purpose, so "yes" and
// "no" can be answered out loud.
function openHandsFreeMicrophone() {
  handsFreeArmed = false;
  const generation = assessmentGeneration;
  if (!voiceFirst || !voice.recognitionSupported || muted || handsFreeBlocked) return;
  if (!started || busy || !current?.screen || (current.state?.completed && !current.product)) return;
  if (voice.listening) return;
  if (!voice.bargeInEnabled && (voice.speaking || voice.processing || voice.queue.length)) return;
  globalThis.setTimeout(() => {
    if (generation !== assessmentGeneration) return;
    if (!started || busy || !current?.screen || (current.state?.completed && !current.product)) return;
    if (muted || handsFreeBlocked || voice.listening) return;
    if (!voice.bargeInEnabled && (voice.speaking || voice.processing || voice.queue.length)) return;
    initMicAudioAnalyser()
      .catch(() => null)
      .finally(() => {
        if (generation === assessmentGeneration && started && !muted && !busy) voice.startListening({ bargeIn: true });
      });
  // Audio pre-roll is buffered while Gemini connects, so only a very short
  // echo-tail gap is needed after TTS playback ends.
  }, 60);
}

function setVoiceMode(mode) {
  if (mode === 'idle' && interpretingAnswer) mode = 'thinking';
  voiceMode = mode;
  document.body.dataset.voiceState = mode;
  if (voiceFirst) {
    if (mode === 'speaking') {
      handsFreeArmed = true;
    } else if (mode === 'idle' && handsFreeArmed) {
      openHandsFreeMicrophone();
    } else if (mode !== 'idle' && !voice.bargeInEnabled) {
      handsFreeArmed = false;
    }
  }
  const labels = {
    idle: started ? t('voice.readyForAnswer', currentLanguage) : t('voice.readyWhenYouAre', currentLanguage),
    listening: t('voice.listening', currentLanguage),
    speaking: t('voice.speaking', currentLanguage),
    thinking: t('voice.thinking', currentLanguage),
    unavailable: t('voice.inputUnavailable', currentLanguage),
    speechOff: t('voice.outputUnavailable', currentLanguage),
  };
  const completed = isCompleted();
  const productConversation = Boolean(completed && current?.product);
  voiceStatus.textContent = !voice.recognitionSupported && started
    ? labels.unavailable
    : completed && !productConversation && mode === 'idle'
      ? t('voice.sessionComplete', currentLanguage)
      : mode === 'idle' && !voice.neuralAvailable
        ? labels.speechOff
        : labels[mode] || labels.idle;
  microphoneButton.classList.toggle('listening', mode === 'listening');
  microphoneLabel.textContent = !voice.recognitionSupported
    ? t('voice.unavailableLabel', currentLanguage)
    : completed && !productConversation
      ? t('voice.sessionComplete', currentLanguage)
      : mode === 'listening' ? t('voice.tapToStop', currentLanguage) : t('app.tapToSpeak', currentLanguage);
  if (mode === 'thinking') {
    setTranscriptActivity(t('loading.finishingSpeech', currentLanguage), true);
  } else if (mode === 'listening' && transcriptActivity?.hidden) {
    setTranscriptActivity(t('voice.listening', currentLanguage), true);
  } else if (mode === 'idle' && !busy && !interpretingAnswer) {
    setTranscriptActivity('', false);
  }
  setInteractiveControls();
  if (mode === 'idle' && pendingSubmission && !busy) {
    const answer = pendingSubmission;
    clearPendingSubmission();
    submitAnswer(answer.value, answer.label, true);
  }
}

function clearPendingSubmission() {
  pendingSubmission = null;
  if (pendingSubmissionTimer) {
    clearTimeout(pendingSubmissionTimer);
    pendingSubmissionTimer = null;
  }
}

function clearTranscript() {
  transcriptEntries = [];
  transcript.querySelectorAll('.transcript-entry, .empty-transcript').forEach(node => node.remove());
  transcript.insertAdjacentHTML('afterbegin', `<p class="empty-transcript">${escapeHtml(t('transcript.empty', currentLanguage))}</p>`);
  setTranscriptActivity('', false);
  interimTranscript.hidden = true;
  interimTranscript.textContent = '';
  const liveFeed = document.querySelector('#voiceLiveFeed');
  if (liveFeed) {
    liveFeed.querySelectorAll('.live-bubble').forEach(node => node.remove());
    const box = document.querySelector('#voiceCaptionBox');
    if (box) box.style.display = '';
  }
}

function scrollTranscriptToLatest() {
  transcript.scrollTop = transcript.scrollHeight;
}

function setTranscriptActivity(text = '', visible = Boolean(text)) {
  if (!transcriptActivity || !transcriptActivityText) return;
  transcriptActivityText.textContent = text;
  transcriptActivity.hidden = !visible;
  if (visible) requestAnimationFrame(scrollTranscriptToLatest);
}

function appendTranscript(role, text, key = '') {
  const clean = role === 'assistant' ? String(text ?? '').replace(/\s+/g, ' ').trim() : cleanTranscriptText(text);
  if (!clean) return;
  if (voiceOnlyPage) {
    if (voiceCaption) voiceCaption.textContent = clean;
    if (voiceCaptionRole) voiceCaptionRole.textContent = role === 'assistant' ? 'MedAssist' : 'You';
    const liveFeed = document.querySelector('#voiceLiveFeed');
    if (liveFeed) {
      const box = document.querySelector('#voiceCaptionBox');
      if (box) box.style.display = 'none';
      liveFeed.innerHTML = '';
      const bubble = document.createElement('article');
      bubble.className = `live-bubble ${role}`;
      bubble.innerHTML = `
        <span class="live-bubble-role">${role === 'assistant' ? 'MedAssist' : 'You'}</span>
        <p class="live-bubble-text">${escapeHtml(clean)}</p>
      `;
      liveFeed.appendChild(bubble);
      liveFeed.scrollTop = liveFeed.scrollHeight;
    }
  }
  const previous = transcriptEntries.at(-1);
  if (previous && previous.role === role && previous.text === clean && (!key || previous.key === key)) return;

  transcriptEntries.push({ role, text: clean, key, at: Date.now() });
  transcript.querySelector('.empty-transcript')?.remove();
  const entry = document.createElement('article');
  entry.className = `transcript-entry ${role}`;
  const roleLabel = role === 'assistant' ? t('role.assistant', currentLanguage) : t('role.user', currentLanguage);
  const avatarLabel = role === 'assistant' ? t('avatar.assistant', currentLanguage) : t('avatar.user', currentLanguage);
  entry.innerHTML = `
    <div class="transcript-avatar" aria-hidden="true">${escapeHtml(avatarLabel)}</div>
    <div>
      <span class="transcript-role">${escapeHtml(roleLabel)}</span>
      <p class="transcript-text">${escapeHtml(clean)}</p>
    </div>`;
  transcript.insertBefore(entry, transcriptActivity || null);
  scrollTranscriptToLatest();
}

function spokenProductSummary(product, presentation) {
  const dose = product?.instructions && typeof product.instructions === 'object' ? product.instructions : {};
  const structured = [
    dose.per_dose ? t('result.dosePerDose', activeLanguage(), { value: dose.per_dose }) : '',
    dose.min_interval_hours ? t('result.doseInterval', activeLanguage(), { value: dose.min_interval_hours }) : '',
    dose.max_doses_per_24h ? t('result.doseMaxDoses', activeLanguage(), { value: dose.max_doses_per_24h }) : '',
  ].filter(Boolean);
  const howTo = structured.length ? structured.join(' ') : String(dose.display_text || '').trim();
  const shortName = [product.brand_name || product.name, product.strength].filter(Boolean).join(' ');
  const intro = t('speech.productConciseIntro', activeLanguage(), { name: shortName });
  const directions = howTo ? ` ${t('speech.productDirections', activeLanguage(), { directions: howTo })}` : '';
  const evidenceNotice = Array.isArray(product?.citations) && product.citations.length
    ? ` ${t('speech.evidenceVerified', activeLanguage())}`
    : '';
  return `${intro}${directions}${evidenceNotice} ${t('speech.productDuplicateWarning', activeLanguage())} ${t('speech.productAnythingElse', activeLanguage())}`.replace(/\s+/g, ' ').trim();
}

function contextualQuestionTitle(screen) {
  if (!screen) return '';
  const qId = screen.question_id;
  const ctx = sessionSymptomContext;
  if (!ctx) return screen.title || '';

  if (qId === 'duration') {
    const titles = {
      en: {
        toothache: 'How long have you had this toothache?',
        back_pain: 'How long have you had this back pain?',
        earache: 'How long have you had this earache?',
        headache: 'How long have you had this headache?',
        fever: 'How long have you had this fever?',
        sinus: 'How long have you had this sinus pressure?',
        period_pain: 'How long have you had this period pain?',
        abdominal_pain: 'How long have you had this stomach pain?',
      },
      de: {
        toothache: 'Wie lange haben Sie diese Zahnschmerzen schon?',
        back_pain: 'Wie lange haben Sie diese Rückenschmerzen schon?',
        earache: 'Wie lange haben Sie diese Ohrenschmerzen schon?',
        headache: 'Wie lange haben Sie diese Kopfschmerzen schon?',
        fever: 'Wie lange haben Sie dieses Fieber schon?',
        sinus: 'Wie lange haben Sie diesen Nebenhöhlendruck schon?',
        period_pain: 'Wie lange haben Sie diese Regelschmerzen schon?',
        abdominal_pain: 'Wie lange haben Sie diese Bauchschmerzen schon?',
      },
    };
    const lang = activeLanguage() === 'de' ? 'de' : 'en';
    return titles[lang]?.[ctx] || screen.title || '';
  }

  if (qId === 'severity') {
    const titles = {
      en: {
        toothache: 'How severe is the toothache right now?',
        back_pain: 'How severe is the back pain right now?',
        earache: 'How severe is the earache right now?',
        headache: 'How severe is the headache right now?',
        fever: 'How high or severe is the fever right now?',
        sinus: 'How severe is the congestion or pressure right now?',
        period_pain: 'How severe is the pain right now?',
        abdominal_pain: 'How severe is the stomach pain right now?',
      },
      de: {
        toothache: 'Wie stark sind die Zahnschmerzen im Moment?',
        back_pain: 'Wie stark sind die Rückenschmerzen im Moment?',
        earache: 'Wie stark sind die Ohrenschmerzen im Moment?',
        headache: 'Wie stark sind die Kopfschmerzen im Moment?',
        fever: 'Wie hoch oder stark ist das Fieber im Moment?',
        sinus: 'Wie stark ist der Druck oder die Verstopfung im Moment?',
        period_pain: 'Wie stark sind die Schmerzen im Moment?',
        abdominal_pain: 'Wie stark sind die Bauchschmerzen im Moment?',
      },
    };
    const lang = activeLanguage() === 'de' ? 'de' : 'en';
    return titles[lang]?.[ctx] || screen.title || '';
  }

  return screen.title || '';
}

function questionSpeech(screen, { includeOptions = false } = {}) {
  if (!screen) return '';
  if (voiceOnlyPage) return naturalVoiceQuestion(screen);
  if (screen.question_id === 'warning_signs') {
    return assessmentSpeech(screen, activeLanguage());
  }
  const titleText = contextualQuestionTitle(screen);
  const title = /[.?!]$/.test(titleText || '') ? titleText : `${titleText}.`;
  const importantSubtitle = '';
  const choices = includeOptions && ['single_select', 'confirmation'].includes(screen.type)
    ? ` ${t('speech.optionsAre', currentLanguage, { options: (screen.options || []).map(option => option.label).join(', ') })}`
    : '';
  // Said once, on the opening question. After every question it buries the
  // question itself, which is the part the customer has to answer.
  const interactionHint = !includeOptions && screen.question_id === 'symptom'
    ? ` ${t('speech.interactionHint', currentLanguage)}`
    : '';
  return `${title} ${importantSubtitle || ''}${choices}${interactionHint}`.replace(/\s+/g, ' ').trim();
}

function naturalVoiceQuestion(screen, { clarify = false } = {}) {
  if (clarify && screen?.question_id === 'symptom') return t('voiceSymptomClarification', activeLanguage());
  if (clarify && screen?.question_id === 'severity') return t('voiceSeverityClarification', activeLanguage());
  return assessmentSpeech(screen, activeLanguage(), { summary: current?.summary });
}

function safeAiVolunteeredContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  const age = Number(raw.age);
  if (Number.isInteger(age) && age >= 0 && age <= 120) clean.age = age;
  if (['today', '1_to_2_days', '3_to_7_days', 'more_than_7_days'].includes(raw.duration)) {
    clean.duration = raw.duration;
  }
  if (['mild', 'moderate', 'severe'].includes(raw.severity)) clean.severity = raw.severity;
  return clean;
}

async function announceCurrent() {
  if (!current) return;
  const isResult = current.screen?.type === 'result' || current.screen?.type === 'product_result' || current.state?.completed;
  const key = isResult
    ? `result:${current.outcome}:${current.product?.id || ''}`
    : `question:${current.screen?.question_id}:${current.state?.turns || 0}:${current.screen?.error || ''}`;
  if (key === lastAnnouncedKey) return;
  lastAnnouncedKey = key;

  if (isResult) {
    const presentation = localizeResult(current, activeLanguage());
    const text = current.product
      ? spokenProductSummary(current.product, presentation)
      : (presentation.message || presentation.title || t('speech.assessmentCompleted', currentLanguage));
    await sayAssistant(text, key);
  } else {
    const screen = localizeScreen(current.screen, activeLanguage());
    const qId = screen.question_id;
    const rememberedVal = sessionVolunteeredContext[qId];

    if (!screen.error && rememberedVal != null && confirmedConversationFacts.get(qId) === rememberedVal) {
      const generation = assessmentGeneration;
      setTimeout(() => {
        if (generation === assessmentGeneration && current?.screen?.question_id === qId) submitAnswer(rememberedVal, String(rememberedVal), true);
      }, 0);
      return;
    }

    if (rememberedVal != null && !screen.error && !acknowledgedVolunteeredQuestions.has(qId)) {
      acknowledgedVolunteeredQuestions.add(qId);
      let matchOption = (screen.options || []).find(o => o.value === rememberedVal || String(o.value) === String(rememberedVal));
      if (!matchOption && screen.type === 'number') {
        const num = Number(rememberedVal);
        if (Number.isInteger(num)) matchOption = { value: num, label: String(num) };
      }
      if (matchOption) {
        // Extraction confidence does not establish that a clinical fact is correct.
        // Read it back and require an explicit confirmation before using it.
        const facts = Object.fromEntries(['age', 'duration', 'severity']
          .filter(key => sessionVolunteeredContext[key] != null && confirmedConversationFacts.get(key) !== sessionVolunteeredContext[key])
          .map(key => [key, sessionVolunteeredContext[key]]));
        if (Object.hasOwn(facts, qId)) {
          const labels = Object.entries(facts).map(([key, value]) => key === 'age'
            ? `${activeLanguage() === 'de' ? 'Alter' : 'Age'}: ${value}`
            : `${t(`summary.${key}`, activeLanguage())}: ${t(`option.${key}.${value}`, activeLanguage())}`);
          showAnswerConfirmation({ ...matchOption, confirmedContext: facts }, 'inferred', `${t('chat.understood', activeLanguage())} ${labels.join('. ')}. ${t('chat.isCorrect', activeLanguage())}`);
        } else {
          showAnswerConfirmation(matchOption, 'inferred', `${screen.title} ${t('chat.understood', activeLanguage())} ${matchOption.label}. ${t('chat.isCorrect', activeLanguage())}`);
        }
        return;
      }
    }

    const text = screen.error
      ? `${screen.error} ${questionSpeech(screen)}`
      : questionSpeech(screen);
    await sayAssistant(text, key);
  }
}

function setLoading(message = t('loading.checking', currentLanguage)) {
  setTranscriptActivity(message, true);
  app.innerHTML = `
    <div class="loading-card">
      <div class="spinner" aria-hidden="true"></div>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

let assessmentGeneration = 0;

async function callWorkflow({ answer = null, reset = false } = {}) {
  if (busy) return;
  const generation = assessmentGeneration;
  const requestStartedAt = globalThis.performance?.now?.() ?? Date.now();
  busy = true;
  setVoiceMode('thinking');
  setLoading(t(reset ? 'loading.starting' : 'loading.checking', currentLanguage));
  clearPendingSubmission();
  const headers = { 'Content-Type': 'application/json' };
  const payload = {
    session_id: sessionId,
    revision: current?.revision,
    country_code: config.countryCode || 'DE',
    language_code: activeLanguage(),
    reset,
    mode: 'rag',
    answer,
    query: answer?.text || answer?.value || (typeof answer === 'string' ? answer : undefined),
  };

  try {
    const response = await fetch('/api/chat-turn', {
      method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const error = new Error(`Assessment returned HTTP ${response.status}`);
      error.httpStatus = response.status;
      throw error;
    }
    const result = await response.json();
    voiceMetrics.turn_requests.push({
      ms: Math.round((globalThis.performance?.now?.() ?? Date.now()) - requestStartedAt),
      status: response.status,
      reset,
      question_id: answer?.question_id || null,
      at: new Date().toISOString(),
    });
    if (generation !== assessmentGeneration) return;
    if (!result || typeof result !== 'object' || !result.screen || !result.session_id) throw new Error('Invalid assessment response');
    if (answer?.question_id === 'confirm' && answer.value === 'no' && result.screen.question_id === 'symptom') {
      confirmedConversationFacts.clear();
      sessionVolunteeredContext = {};
      acknowledgedVolunteeredQuestions.clear();
      trustedVolunteeredQuestions.clear();
      sessionSymptomContext = null;
    }
    current = result;
    sessionId = current.session_id;
    voice.stopSpeaking();
    render();
    setTranscriptActivity('', false);
    announceCurrent();
  } catch (error) {
    voiceMetrics.turn_requests.push({
      ms: Math.round((globalThis.performance?.now?.() ?? Date.now()) - requestStartedAt),
      status: error.httpStatus ?? 'network',
      reset,
      question_id: answer?.question_id || null,
      at: new Date().toISOString(),
    });
    if (generation !== assessmentGeneration) return;
    const errorText = t('error.workflow', currentLanguage, { message: error.message });
    sayAssistant(errorText, `error:${error.message}`, { interrupt: true });
    app.innerHTML = `
      <section class="result-card">
        <p class="step-label">${escapeHtml(t('error.connectionLabel', currentLanguage))}</p>
        <h2>${escapeHtml(t('error.connectionTitle', currentLanguage))}</h2>
        <p class="result-message">${escapeHtml(error.message)}</p>
        <p class="result-message">${escapeHtml(t(connectionHintKey(error.httpStatus), currentLanguage))}</p>
        <button class="primary-button" id="retryButton" type="button">${escapeHtml(t('speech.retry', currentLanguage))}</button>
      </section>`;
    document.querySelector('#retryButton')?.addEventListener('click', () => callWorkflow({ reset: true }));
  } finally {
    if (generation !== assessmentGeneration) return;
    busy = false;
    if (!voice.speaking && !voice.listening) setTranscriptActivity('', false);
    setVoiceMode(voice.speaking ? 'speaking' : voice.listening ? 'listening' : 'idle');
    flushConfigNotice();
  }
}

function renderSummary(summary) {
  if (!summary || typeof summary !== 'object') return '';
  const enriched = { ...summary };
  if ((enriched.age == null || enriched.age === 'Not asked') && sessionVolunteeredContext.age != null) enriched.age = sessionVolunteeredContext.age;
  if ((enriched.severity == null || enriched.severity === 'Not asked') && sessionVolunteeredContext.severity) enriched.severity = sessionVolunteeredContext.severity;
  if ((enriched.duration == null || enriched.duration === 'Not asked') && sessionVolunteeredContext.duration) enriched.duration = sessionVolunteeredContext.duration;
  return `<dl class="summary-grid">${localizeSummary(enriched, currentLanguage).map(item => `
    <div class="summary-item">
      <dt>${escapeHtml(item.label)}</dt>
      <dd>${escapeHtml(item.value)}</dd>
    </div>`).join('')}</dl>`;
}

const SYMPTOM_ICONS = {
  pain_fever: './icons/headache-fever.png',
  cold_cough: './icons/cold-cough.png',
  allergy: './icons/allergy.png',
  diarrhoea: './icons/diarrhea.png',
  heartburn: './icons/diarrhea.png',
  skin_minor_wound: './icons/minor-cuts.png',
};
const OTHER_SYMPTOM_ICON = '<svg class="option-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22E586" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

function getSymptomIconHtml(value) {
  if (SYMPTOM_ICONS[value]) {
    return `<img class="option-icon" src="${SYMPTOM_ICONS[value]}" alt="" aria-hidden="true" width="28" height="28">`;
  }
  return OTHER_SYMPTOM_ICON;
}

function renderOptions(screen) {
  const isSymptom = screen.question_id === 'symptom';
  const rememberedVal = sessionVolunteeredContext[screen.question_id];
  return `<div class="option-grid">${(screen.options || []).map(option => {
    const iconHtml = isSymptom ? getSymptomIconHtml(option.value) : '';
    const isSuggested = rememberedVal != null && (rememberedVal === option.value || String(rememberedVal) === String(option.value));
    const sub = optionSubtitle(screen.question_id, option.value, currentLanguage);
    const subHtml = sub ? `<span class="option-subtext">${escapeHtml(sub)}</span>` : '';
    return `
    <button class="option-button${isSuggested ? ' suggested' : ''}" type="button" data-value="${escapeHtml(option.value)}" data-label="${escapeHtml(option.label)}">
      ${iconHtml}
      <div class="option-content">
        <span class="option-text">${escapeHtml(option.label)}</span>
        ${subHtml}
      </div>
    </button>`;
  }).join('')}</div>`;
}

let productOrderQuantity = 1;

const USE_ICON_LIBRARY = [
  [/head| migraine/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/></svg>'],
  [/tooth/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2a3 3 0 0 0-3 3v4c0 3.87 2.13 7 5 7h6c2.87 0 5-3.13 5-7V5a3 3 0 0 0-3-3H7Z"/><path d="M9 16v5a1 1 0 0 0 1.5.87L12 21l1.5.87A1 1 0 0 0 15 21v-5"/></svg>'],
  [/fever| temperature/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4a2 2 0 0 0-4 0v8.5a4 4 0 1 0 4 0V4Z"/><circle cx="12" cy="16" r="1.5"/></svg>'],
  [/muscle| body| back| joint/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a3 3 0 0 0 0-6h-2a2 2 0 0 1 0-4h2a3 3 0 0 0 0-6Z"/><circle cx="9" cy="12" r="2"/></svg>'],
  [/throat/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 3 4 7 4 7s4-4 4-7a4 4 0 0 0-4-4Z"/><path d="M7 17a5 5 0 0 0 10 0"/></svg>'],
  [/cough/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/></svg>'],
  [/runny| nasal/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'],
  [/block| congest/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>'],
  [/sneez/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'],
  [/eye| itchy/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/></svg>'],
  [/rash| hive| urticaria| skin| wound| cut| graze| bite| burn/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="1.5"/><circle cx="17" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></svg>'],
  [/reflux| heartburn| acid/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 0 1-8 0c0-4 2-6 4-10z"/></svg>'],
  [/indigest| stomach| period/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="4"/><line x1="8" x2="16" y1="12" y2="12"/></svg>'],
  [/diarr| dehydr| rehydrat/, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>'],
];
const GENERIC_USE_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';

function titleCaseTerm(term) {
  const text = String(term || '').trim().replace(/\s+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function useTileFor(term) {
  const key = String(term).toLowerCase();
  const match = USE_ICON_LIBRARY.find(([pattern]) => pattern.test(key));
  return { label: titleCaseTerm(term), icon: match ? match[1] : GENERIC_USE_ICON };
}

// The product's own approved indications when the matcher forwarded them; the
// tapped group is only the fallback, and it is labelled as such by the copy.
function commonUsesFor(product, pathwayCode) {
  const terms = (Array.isArray(product.allowed_indications) ? product.allowed_indications : [])
    .map(term => String(term || '').trim())
    .filter(Boolean);
  if (terms.length) return [...new Set(terms)].slice(0, 4).map(useTileFor);
  return getCommonUsesForPathway(pathwayCode);
}

function listFrom(terms) {
  return (Array.isArray(terms) ? terms : []).map(term => String(term || '').trim()).filter(Boolean);
}

async function retryFromStep(targetStep) {
  const savedSymptom = sessionVolunteeredContext.symptom || current?.state?.pathway_code;
  const savedAge = sessionVolunteeredContext.age ?? current?.state?.age_years;

  started = true;
  markActivity();
  sessionId = createSessionId();
  current = null;
  lastAnnouncedKey = '';
  clearPendingSubmission();
  hideAnswerConfirmation();
  clearTranscript();
  clearAttachedImage();
  document.querySelector('#voiceWarningBadgeContainer')?.remove();
  const voiceResultContainer = document.querySelector('#voiceResultContainer');
  if (voiceResultContainer) {
    voiceResultContainer.hidden = true;
    voiceResultContainer.innerHTML = '';
  }

  if (targetStep === 'age' && savedSymptom) {
    setLoading(t('loading.starting', currentLanguage));
    try {
      const initResp = await fetch('/api/chat-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          country_code: config.countryCode || 'DE',
          language_code: activeLanguage(),
          reset: true,
        }),
      });
      if (!initResp.ok) { beginAssessment(); return; }
      current = await initResp.json();
      sessionId = current.session_id || sessionId;
      sessionVolunteeredContext.symptom = savedSymptom;
      await callWorkflow({ answer: { question_id: 'symptom', value: savedSymptom } });
      return;
    } catch (_) {
      beginAssessment();
      return;
    }
  }

  if (targetStep === 'duration' && savedSymptom && savedAge != null) {
    setLoading(t('loading.starting', currentLanguage));
    try {
      const initResp = await fetch('/api/chat-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          country_code: config.countryCode || 'DE',
          language_code: activeLanguage(),
          reset: true,
        }),
      });
      if (!initResp.ok) { beginAssessment(); return; }
      current = await initResp.json();
      sessionId = current.session_id || sessionId;
      sessionVolunteeredContext.symptom = savedSymptom;
      await callWorkflow({ answer: { question_id: 'symptom', value: savedSymptom } });
      sessionVolunteeredContext.age = savedAge;
      await callWorkflow({ answer: { question_id: 'age', value: savedAge } });
      return;
    } catch (_) {
      beginAssessment();
      return;
    }
  }

  beginAssessment();
}

function renderResult() {
  const product = current.product;
  const presentation = localizeResult(current, currentLanguage);

  if (!product) {
    const reasonCodes = Array.isArray(current.reason_codes) ? current.reason_codes : [];
    const isAgeIssue = reasonCodes.includes('under_18') || reasonCodes.includes('age_outside_supported_range');
    const isDurationIssue = reasonCodes.includes('duration_outside_pathway') || reasonCodes.includes('symptom_longer_than_product_allows');

    app.innerHTML = `
      <section class="result-card">
        <p class="step-label">${escapeHtml(presentation.label)}</p>
        <h2>${escapeHtml(presentation.title)}</h2>
        <p class="result-message">${escapeHtml(presentation.message)}</p>
        ${renderSummary(current.summary)}
        <div class="result-card-actions">
          <button class="option-button" id="resultDifferentSymptom" type="button">
            <span class="option-text">${escapeHtml(t('result.chooseDifferentSymptom', currentLanguage))}</span>
          </button>
          ${isAgeIssue ? `
          <button class="option-button" id="resultCorrectAge" type="button">
            <span class="option-text">${escapeHtml(t('result.correctAge', currentLanguage))}</span>
          </button>` : ''}
          ${isDurationIssue ? `
          <button class="option-button" id="resultReviewDuration" type="button">
            <span class="option-text">${escapeHtml(t('result.reviewDuration', currentLanguage))}</span>
          </button>` : ''}
          <button class="primary-button" id="resultRestart" type="button">
            ${escapeHtml(t('result.restart', currentLanguage))}
          </button>
        </div>
      </section>`;
    document.querySelector('#resultRestart')?.addEventListener('click', beginAssessment);
    document.querySelector('#resultDifferentSymptom')?.addEventListener('click', beginAssessment);
    document.querySelector('#resultCorrectAge')?.addEventListener('click', () => retryFromStep('age'));
    document.querySelector('#resultReviewDuration')?.addEventListener('click', () => retryFromStep('duration'));

    const voiceResultContainer = document.querySelector('#voiceResultContainer');
    if (voiceOnlyPage && voiceResultContainer) {
      voiceResultContainer.innerHTML = app.innerHTML;
      voiceResultContainer.hidden = false;
      voiceResultContainer.querySelector('#resultRestart')?.addEventListener('click', beginAssessment);
    wireSummaryActions(voiceResultContainer);
      voiceResultContainer.querySelector('#resultDifferentSymptom')?.addEventListener('click', beginAssessment);
      voiceResultContainer.querySelector('#resultCorrectAge')?.addEventListener('click', () => retryFromStep('age'));
      voiceResultContainer.querySelector('#resultReviewDuration')?.addEventListener('click', () => retryFromStep('duration'));
    }
    return;
  }

  // Product Showcase Layout (Matching user kiosk design). Every value below is
  // read from the matched catalogue row - no fixed product facts in here.
  productOrderQuantity = 1;
  const price = Number(product.price);
  const unitPrice = price;
  const currency = product.currency_code || (config.countryCode === 'DE' ? 'EUR' : 'MAD');
  const displayName = product.brand_name || product.name || '';
  const subtitle = [product.strength, product.pack_size, product.dosage_form]
    .map(value => String(value || '').trim()).filter(Boolean).join(' · ');
  const commonUses = commonUsesFor(product, current.state?.pathway_code);
  const categoryLabel = summaryValue('symptom_category', current.summary?.symptom_category, currentLanguage);
  const unmatchedLabels = [t('summary.notAsked', currentLanguage), t('summary.notProvided', currentLanguage)];
  const matchedGroup = unmatchedLabels.includes(categoryLabel) ? '' : categoryLabel;
  const activeIngredient = String(product.active_ingredients?.[0]?.name || '').toLowerCase();
  const dose = product.instructions && typeof product.instructions === 'object' ? product.instructions : {};
  const doseStructured = [
    dose.per_dose ? t('result.dosePerDose', currentLanguage, { value: dose.per_dose }) : '',
    dose.max_doses_per_24h ? t('result.doseMaxDoses', currentLanguage, { value: dose.max_doses_per_24h }) : '',
    dose.min_interval_hours ? t('result.doseInterval', currentLanguage, { value: dose.min_interval_hours }) : '',
  ].map(line => String(line || '').trim()).filter(Boolean);
  // The full labelling sentence repeats the three structured fields, so it is only
  // shown when a row carries prose but no machine-readable dose.
  const doseLines = [
    ...(doseStructured.length ? [] : [dose.display_text]),
    ...doseStructured,
    product.maximum_duration_days ? t('result.doseDuration', currentLanguage, { value: product.maximum_duration_days }) : '',
  ].map(line => String(line || '').trim()).filter(Boolean);
  const dosingHighlights = [
    dose.min_interval_hours ? t('result.doseInterval', currentLanguage, { value: dose.min_interval_hours }) : '',
    dose.max_doses_per_24h ? t('result.doseMaxDoses', currentLanguage, { value: dose.max_doses_per_24h }) : '',
  ].filter(Boolean);
  const warningLines = listFrom(product.warnings);
  const allergyTerms = listFrom(product.allergy_terms);
  const interactionTerms = listFrom(product.interaction_rules);
  const conditionTerms = listFrom(product.contraindications);
  const minAgeMonths = Number(product.minimum_age_months);
  const maxAgeYears = Number(product.maximum_age_years);
  const fromLabel = Number.isFinite(minAgeMonths) && minAgeMonths > 0
    ? minAgeMonths < 12
      ? t('result.ageFromMonths', currentLanguage, { value: minAgeMonths })
      : t('result.ageFromYears', currentLanguage, { value: Math.round(minAgeMonths / 12) })
    : '';
  const hasUpperAge = Number.isFinite(maxAgeYears) && maxAgeYears > 0 && maxAgeYears < 100;
  const ageLine = fromLabel
    ? hasUpperAge
      ? t('result.ageApprovedUntil', currentLanguage, { from: fromLabel, max: maxAgeYears })
      : t('result.ageApproved', currentLanguage, { from: fromLabel })
    : '';
  app.innerHTML = `
    <article class="product-showcase-card">
      <div class="product-showcase-header">
        <div class="product-approved-tag">
          <span class="stock-pill">● ${escapeHtml(t('result.safetyCleared', currentLanguage))}</span>
        </div>
        <h2>${escapeHtml(displayName)}</h2>
        <p class="product-showcase-subtitle">${escapeHtml(subtitle)}</p>
        ${matchedGroup ? `<p class="product-showcase-indication">${escapeHtml(t('result.matchedGroup', currentLanguage, { group: matchedGroup }))}</p>` : ''}
      </div>

      <div class="product-section">
        <p class="product-section-title">${escapeHtml(t('result.commonUses', currentLanguage))}</p>
        <div class="common-uses-grid">
          ${commonUses.map(use => `
            <div class="use-chip">
              <div class="use-chip-icon" aria-hidden="true">${use.icon}</div>
              <span class="use-chip-text">${escapeHtml(use.label)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${Number.isFinite(price) && price > 0 ? `
      <div class="commerce-row">
        <div class="quantity-controls-wrap">
          <div class="stepper-controls">
            <button class="stepper-btn" id="qtyMinus" type="button" aria-label="Decrease quantity">−</button>
            <span class="stepper-value" id="qtyValue">1</span>
            <button class="stepper-btn" id="qtyPlus" type="button" aria-label="Increase quantity">+</button>
          </div>
          <span class="quantity-badge">
            <span class="quantity-dot" aria-hidden="true"></span>
            ${escapeHtml(t('result.quantityInUnits', currentLanguage))}
          </span>
        </div>
        <div class="price-display" id="totalPrice">
          ${price} ${escapeHtml(currency)}
        </div>
      </div>` : ''}

      <div class="precautions-section">
        <div class="precautions-header">
          <h3>${escapeHtml(t('result.howToTake', currentLanguage))}</h3>
          ${ageLine ? `<p>${escapeHtml(ageLine)}</p>` : ''}
        </div>

        ${dosingHighlights.length ? `<div class="dosing-highlight-row">
          ${dosingHighlights.map((line, index) => `<div class="dosing-highlight-item">
            <span class="dosing-icon" aria-hidden="true">${index === 0 ? '⏱' : '📅'}</span>
            <span>${escapeHtml(line)}</span>
          </div>`).join('')}
        </div>` : ''}

        <div class="instructions-card">
          <ul>
            ${[...doseLines, ...warningLines].map(line => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>

        ${allergyTerms.length || activeIngredient || interactionTerms.length || conditionTerms.length ? `
        <div class="warning-cards-grid">
          ${/ibuprofen|aspirin|ketoprofen|naproxen/i.test(String(product.brand_name || product.name || '')) ? `
          <div class="warning-card food-warning">
            <div class="warning-card-icon" aria-hidden="true">🍽</div>
            <p class="warning-card-text"><strong>${escapeHtml(t('pharmacy.takeWithFoodBadge', currentLanguage))}</strong></p>
          </div>` : ''}

          ${/paracetamol|acetaminophen|doliprane/i.test(String(product.brand_name || product.name || '')) ? `
          <div class="warning-card duplicate">
            <div class="warning-card-icon" aria-hidden="true">⚠</div>
            <p class="warning-card-text"><strong>${escapeHtml(t('pharmacy.paracetamolLimitBadge', currentLanguage))}</strong></p>
          </div>` : ''}

          ${allergyTerms.length ? `
          <div class="warning-card allergy">
            <div class="warning-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <p class="warning-card-text">${escapeHtml(t('result.warningAllergyTerms', currentLanguage, { terms: allergyTerms.slice(0, 4).join(', ') }))}</p>
          </div>` : ''}

          ${activeIngredient ? `
          <div class="warning-card duplicate">
            <div class="warning-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <p class="warning-card-text">${escapeHtml(t('result.warningDuplicate', currentLanguage, { name: activeIngredient }))}</p>
          </div>` : ''}

          ${interactionTerms.length ? `
          <div class="warning-card interaction">
            <div class="warning-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4"/><path d="m18 9 3 3-3 3"/><line x1="21" y1="12" x2="12" y2="12"/></svg>
            </div>
            <p class="warning-card-text">${escapeHtml(t('result.warningInteractionTerms', currentLanguage, { terms: interactionTerms.slice(0, 4).join(', ') }))}</p>
          </div>` : ''}

          ${conditionTerms.length ? `
          <div class="warning-card consult">
            <div class="warning-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            </div>
            <p class="warning-card-text">${escapeHtml(t('result.warningConsultTerms', currentLanguage, { terms: conditionTerms.slice(0, 4).join(', ') }))}</p>
          </div>` : ''}
        </div>` : ''}
      </div>

      ${/^https?:\/\//i.test(product.label_url || '') ? `
      <div class="product-leaflet-row">
        <a href="${escapeHtml(product.label_url)}" target="_blank" rel="noreferrer" class="product-leaflet-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>${escapeHtml(t('result.openLabel', currentLanguage))}</span>
        </a>
      </div>` : ''}

      ${Array.isArray(product.citations) && product.citations.length ? `
      <div class="evidence-citations-panel">
        <div class="evidence-citations-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span class="evidence-citations-title">${escapeHtml(t('result.verifiedEvidence', currentLanguage))}</span>
        </div>
        <p class="evidence-citations-disclaimer">${escapeHtml(product.citation_disclaimer || t('result.evidenceDisclaimer', currentLanguage))}</p>
        <div class="evidence-citations-list">
          ${product.citations.map(c => `
            <div class="evidence-citation-item">
              <div class="citation-meta-row">
                <span class="citation-badge">${escapeHtml(c.collection === 'german_product_info' ? 'BfArM SmPC' : 'Gale Clinical')}</span>
                <strong class="citation-title">${escapeHtml(c.title)}</strong>
                <span class="citation-section">§ ${escapeHtml(c.section || '')} (p. ${escapeHtml(String(c.page || 1))})</span>
              </div>
              <p class="citation-text">“${escapeHtml(c.text)}”</p>
              ${c.url ? `
              <div class="citation-url-row">
                <a href="${escapeHtml(c.url)}" target="_blank" rel="noreferrer" class="citation-external-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span>${escapeHtml(t('result.viewOfficialSource', currentLanguage))}</span>
                </a>
              </div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="product-actions-row">
        <button class="primary-button" id="resultRestart" type="button">${escapeHtml(t('result.restart', currentLanguage))}</button>
      </div>

      <div class="clinical-summary-panel">
        <div class="clinical-summary-header">
          <div class="clinical-summary-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>${escapeHtml(t('result.clinicalRecord', currentLanguage))}</span>
          </div>
          <p class="clinical-summary-timestamp">${new Date().toLocaleDateString(currentLanguage === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })} · #${escapeHtml(String(sessionId || '').slice(0, 8).toUpperCase())}</p>
        </div>
        <div class="clinical-summary-grid">
          <div class="clinical-summary-metric">
            <span class="metric-label">${escapeHtml(t('result.metricSymptom', currentLanguage))}</span>
            <span class="metric-value">${escapeHtml(matchedGroup || categoryLabel || t('summary.notProvided', currentLanguage))}</span>
          </div>
          <div class="clinical-summary-metric">
            <span class="metric-label">${escapeHtml(t('result.metricAgeBand', currentLanguage))}</span>
            <span class="metric-value">${escapeHtml(String(current.summary?.age || '18+'))}</span>
          </div>
          <div class="clinical-summary-metric">
            <span class="metric-label">${escapeHtml(t('result.metricDuration', currentLanguage))}</span>
            <span class="metric-value">${escapeHtml(summaryValue('duration', current.summary?.duration, currentLanguage))}</span>
          </div>
          <div class="clinical-summary-metric">
            <span class="metric-label">${escapeHtml(t('result.metricSafetyStatus', currentLanguage))}</span>
            <span class="metric-value status-cleared">✓ ${escapeHtml(t('result.safetyCleared', currentLanguage))}</span>
          </div>
        </div>
        <details class="summary-details">
          <summary class="summary-details-title">${escapeHtml(t('result.safetySummary', currentLanguage))}</summary>
          ${renderSummary(current.summary)}
        </details>
        <div class="clinical-summary-actions">
          <button class="text-button print-summary-btn" id="printSummaryBtn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>${escapeHtml(t('result.printSummary', currentLanguage))}</span>
          </button>
          <button class="text-button copy-summary-btn" id="copySummaryBtn" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span class="copy-label">${escapeHtml(t('result.copySummary', currentLanguage))}</span>
          </button>
        </div>
      </div>
    </article>
  `;

  function wireSummaryActions(container = document) {
    container.querySelector('#printSummaryBtn')?.addEventListener('click', () => {
      window.print();
    });
    container.querySelector('#copySummaryBtn')?.addEventListener('click', async (e) => {
      const copyBtn = e.currentTarget;
      const labelEl = copyBtn.querySelector('.copy-label') || copyBtn;
      const originalText = labelEl.textContent;
      const sessionCode = String(sessionId || '').slice(0, 8).toUpperCase();
      const dateStr = new Date().toLocaleDateString(currentLanguage === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
      const summaryText = [
        `PILLPAL MedAssist — ${t('result.clinicalRecord', currentLanguage)}`,
        `Date: ${dateStr} | Session: #${sessionCode}`,
        `Indication: ${matchedGroup || categoryLabel || 'N/A'}`,
        `Recommended: ${displayName} (${subtitle})`,
        doseLines.length ? `Directions: ${doseLines.join(' ')}` : '',
        `Safety Clearance: ${t('result.safetyCleared', currentLanguage)}`,
        warningLines.length ? `Precautions: ${warningLines.slice(0, 2).join(' ')}` : '',
        'Notice: This consultation summary is for informational guidance and does not replace professional medical diagnosis.'
      ].filter(Boolean).join('\n');

      try {
        await navigator.clipboard.writeText(summaryText);
        labelEl.textContent = t('result.summaryCopied', currentLanguage);
        setTimeout(() => { labelEl.textContent = originalText; }, 2200);
      } catch (_) {
        // Fallback if clipboard API is restricted
      }
    });
  }

  wireSummaryActions(document);

  const qtyValueEl = document.querySelector('#qtyValue');
  const totalPriceEl = document.querySelector('#totalPrice');
  const minusBtn = document.querySelector('#qtyMinus');
  const plusBtn = document.querySelector('#qtyPlus');

  minusBtn?.addEventListener('click', () => {
    if (productOrderQuantity > 1) {
      productOrderQuantity -= 1;
      if (qtyValueEl) qtyValueEl.textContent = String(productOrderQuantity);
      if (totalPriceEl) totalPriceEl.textContent = `${productOrderQuantity * unitPrice} ${currency}`;
    }
  });

  plusBtn?.addEventListener('click', () => {
    if (productOrderQuantity < 3) {
      productOrderQuantity += 1;
      if (qtyValueEl) qtyValueEl.textContent = String(productOrderQuantity);
      if (totalPriceEl) totalPriceEl.textContent = `${productOrderQuantity * unitPrice} ${currency}`;
    }
  });

  document.querySelector('#resultRestart')?.addEventListener('click', beginAssessment);

  const voiceResultContainer = document.querySelector('#voiceResultContainer');
  if (voiceOnlyPage && voiceResultContainer) {
    voiceResultContainer.innerHTML = app.innerHTML;
    voiceResultContainer.hidden = false;
    voiceResultContainer.querySelector('#resultRestart')?.addEventListener('click', beginAssessment);
    wireSummaryActions(voiceResultContainer);
  }
}

function showCustomSymptomPrompt() {
  voice.stopSpeaking();
  hideAnswerConfirmation();

  const title = t('custom_symptom.title', currentLanguage);
  const subtitle = t('custom_symptom.subtitle', currentLanguage);
  const stepLabel = t('custom_symptom.stepLabel', currentLanguage);
  const speakHint = t('custom_symptom.speakHint', currentLanguage);
  const backLabel = t('custom_symptom.backToMain', currentLanguage);

  const customOptions = [
    { value: 'pain_fever', context: 'toothache', icon: '🦷', key: 'toothache' },
    { value: 'pain_fever', context: 'back_pain', icon: '🦴', key: 'backPain' },
    { value: 'pain_fever', context: 'earache', icon: '👂', key: 'earache' },
    { value: 'cold_cough', context: 'sinus', icon: '👃', key: 'sinus' },
    { value: 'heartburn', context: 'heartburn', icon: '🔥', key: 'heartburn' },
    { value: 'allergy', context: 'allergy', icon: '🌿', key: 'allergy' },
    { value: 'skin_minor_wound', context: 'wound', icon: '🩹', key: 'wound' },
    { value: 'other', context: 'other', icon: '📋', key: 'otherPathway' },
  ];

  app.innerHTML = `
    <section class="question-card custom-symptom-card">
      <p class="step-label">${escapeHtml(stepLabel)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <div class="custom-symptom-speak-hint">
        <p>🎙 ${escapeHtml(speakHint)}</p>
      </div>
      <div class="option-grid">
        ${customOptions.map(opt => {
          const optLabel = t(`custom_symptom.${opt.key}`, currentLanguage);
          const optSub = t(`custom_symptom.${opt.key}Sub`, currentLanguage);
          return `
          <button class="option-button" type="button" data-custom-pathway="${escapeHtml(opt.value)}" data-custom-context="${escapeHtml(opt.context)}" data-label="${escapeHtml(optLabel)}">
            <span class="custom-symptom-icon" aria-hidden="true">${opt.icon}</span>
            <div class="option-content">
              <span class="option-text">${escapeHtml(optLabel)}</span>
              ${optSub ? `<span class="option-subtext">${escapeHtml(optSub)}</span>` : ''}
            </div>
          </button>`;
        }).join('')}
      </div>
      <div style="margin-top: 18px;">
        <button class="option-button" id="customSymptomBack" type="button" style="min-height: 48px; padding: 12px 18px;">
          <span class="option-text">${escapeHtml(backLabel)}</span>
        </button>
      </div>
    </section>
  `;

  document.querySelector('#customSymptomBack')?.addEventListener('click', () => {
    render();
  });

  document.querySelectorAll('[data-custom-pathway]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pathway = btn.dataset.customPathway;
      const context = btn.dataset.customContext;
      const label = btn.dataset.label;
      if (context && context !== 'other') {
        sessionSymptomContext = context;
        sessionVolunteeredContext.customSymptom = label;
      }
      submitAnswer(pathway, label);
    });
  });

  sayAssistant(subtitle, 'custom-symptom-prompt');
}

function renderQuestion() {
  const screen = localizeScreen(current.screen, currentLanguage);
  const qId = screen.question_id;
  const rememberedVal = sessionVolunteeredContext[qId];
  let rememberedNoticeHtml = '';

  if (rememberedVal != null && !acknowledgedVolunteeredQuestions.has(qId)) {
    let labelVal = rememberedVal;
    if (screen.options) {
      const matchOpt = screen.options.find(o => o.value === rememberedVal || String(o.value) === String(rememberedVal));
      if (matchOpt) labelVal = matchOpt.label;
    }
    rememberedNoticeHtml = `
      <div class="volunteered-context-notice">
        <span aria-hidden="true">💡</span>
        <span>${escapeHtml(t('chat.rememberedContext', currentLanguage, { value: labelVal }))}</span>
      </div>`;
  }

  const questionTitle = contextualQuestionTitle(screen);

  app.innerHTML = `
    <section class="question-card">
      <p class="step-label">${escapeHtml(t('speech.label', currentLanguage))}</p>
      <h2>${escapeHtml(questionTitle)}</h2>
      ${screen.question_id === 'warning_signs' && Array.isArray(screen.red_flags) && screen.red_flags.length
        ? `<p class="subtitle">${escapeHtml(t('pharmacy.warningSignsCheckHeader', currentLanguage))}</p>
           <ul class="warning-signs-list">
             ${screen.red_flags.map(f => `<li><span class="warning-dot" aria-hidden="true">⚠</span> <span>${escapeHtml(f)}</span></li>`).join('')}
           </ul>`
        : (screen.subtitle ? `<p class="subtitle">${escapeHtml(screen.subtitle)}</p>` : '')}
      ${screen.error ? `<div class="error-message">${escapeHtml(screen.error)}</div>` : ''}
      ${rememberedNoticeHtml}
      ${current.summary ? renderSummary(current.summary) : ''}
      ${['single_select', 'confirmation', 'free_text'].includes(screen.type)
        ? renderOptions(screen)
        : `<p class="input-guidance">${escapeHtml(t('speech.inputGuidance', currentLanguage))}</p>`}
    </section>`;

  document.querySelectorAll('[data-value]').forEach(button => {
    button.addEventListener('click', () => {
      const val = button.dataset.value;
      const label = button.dataset.label;
      if (current?.screen?.question_id === 'symptom' && val === 'other') {
        showCustomSymptomPrompt();
        return;
      }
      submitAnswer(val, label);
    });
  });

  if (voiceOnlyPage) {
    const liveFeed = document.querySelector('#voiceLiveFeed');
    const existing = document.querySelector('#voiceWarningBadgeContainer');
    if (screen.question_id === 'warning_signs' && Array.isArray(screen.red_flags) && screen.red_flags.length) {
      if (!existing && liveFeed) {
        const warningCard = document.createElement('div');
        warningCard.id = 'voiceWarningBadgeContainer';
        warningCard.className = 'voice-warning-card';
        warningCard.innerHTML = `
          <div class="voice-warning-header">
            <span class="warning-dot" aria-hidden="true">⚠</span>
            <strong>${escapeHtml(t('pharmacy.warningSignsCheckHeader', currentLanguage))}</strong>
          </div>
          <ul class="voice-warning-list">
            ${screen.red_flags.map(f => `<li><span class="warning-bullet">●</span> <span>${escapeHtml(f)}</span></li>`).join('')}
          </ul>
        `;
        liveFeed.appendChild(warningCard);
        liveFeed.scrollTop = liveFeed.scrollHeight;
      }
    } else if (existing) {
      existing.remove();
    }
  }
}

function render() {
  if (current.screen?.type === 'result' || current.screen?.type === 'product_result' || current.state?.completed) renderResult();
  else if (current.screen) renderQuestion();
  else throw new Error('The workflow response did not contain a screen');
  updateProgress();
  setInteractiveControls();
  setVoiceMode(voice.speaking ? 'speaking' : 'idle');
}

function submitAnswer(value, transcriptText = null, alreadyTranscribed = false) {
  if (!current?.screen?.question_id || busy) return;
  beginVoiceTurn('tap-answer');
  markActivity();
  sessionVolunteeredContext[current.screen.question_id] = value;
  lastSubmissionAt = Date.now();
  voice.stopSpeaking();
  hideAnswerConfirmation();
  if (!alreadyTranscribed) appendTranscript('user', transcriptText ?? value);
  callWorkflow({ answer: { question_id: current.screen.question_id, value } });
}

async function handleMedicineMention(text, screen) {
  const mention = detectMedicineMention(text);
  if (!mention) return false;
  const uses = t(`pharmacy.uses.${mention.key}`, currentLanguage);
  const condition = detectConditionMention(text);
  let notePrefix = uses;
  if (condition && hasKnownPrecaution(mention.key, condition.key)) {
    const medName = mention.alias.charAt(0).toUpperCase() + mention.alias.slice(1);
    const condName = condition.alias;
    notePrefix = t('pharmacy.conditionCaution', currentLanguage, { medicine: medName, condition: condName });
  }

  const purposeAnswer = resolveVoiceAnswer(text, screen);
  if (purposeAnswer) {
    const note = `${notePrefix} ${t('pharmacy.purposeProceed', currentLanguage)}`;
    // Read the full explanation before moving to screening. Hearing only the
    // generic use made a medicine request sound like an immediate approval.
    if (await sayAssistant(note, `mention:${mention.key}:${purposeAnswer.value}`)) {
      submitAnswer(purposeAnswer.value, purposeAnswer.label, true);
      return true;
    }
    submitAnswer(purposeAnswer.value, purposeAnswer.label, true);
    return true;
  }
  const prompt = `${notePrefix} ${t('pharmacy.caution', currentLanguage)} ${t('pharmacy.purposeQuestion', currentLanguage)}`;
  sayAssistant(prompt, `mention:${mention.key}:ask`, { interrupt: true });
  return true;
}

function triggerEmergencyNotice() {
  // End the current question before showing the referral so neither voice nor
  // a pending read-back can continue the assessment behind the notice.
  current = null;
  clearPendingSubmission();
  hideAnswerConfirmation();
  const noticeTitle = t('pharmacy.emergencyTitle', currentLanguage);
  const noticeText = t('pharmacy.emergencyNotice', currentLanguage);
  sayAssistant(`${noticeTitle}: ${noticeText}`, 'emergency-referral', { interrupt: true });
  app.innerHTML = `
    <section class="result-card emergency-card">
      <p class="step-label">${escapeHtml(noticeTitle)}</p>
      <h2>${escapeHtml(noticeTitle)}</h2>
      <p class="result-message emergency-alert">${escapeHtml(noticeText)}</p>
      <button class="primary-button" id="emergencyRestart" type="button">${escapeHtml(t('result.restart', currentLanguage))}</button>
    </section>`;
  document.querySelector('#emergencyRestart')?.addEventListener('click', beginAssessment);

  const voiceResultContainer = document.querySelector('#voiceResultContainer');
  if (voiceOnlyPage && voiceResultContainer) {
    voiceResultContainer.innerHTML = app.innerHTML;
    voiceResultContainer.hidden = false;
    voiceResultContainer.querySelector('#emergencyRestart')?.addEventListener('click', beginAssessment);
  }
  setVoiceMode('idle');
}

function acceptAiAnswer(data, screen) {
  if (!data?.matched) return null;
  if (screen.type === 'number') {
    const number = Number(data.value);
    if (!Number.isInteger(number) || number < 0 || number > 120) return null;
    return { value: number, label: String(number), detected_language: data.detected_language || null };
  }
  if (screen.type === 'text') {
    const text = cleanTranscriptText(data.value);
    return text ? { value: text, label: text, detected_language: data.detected_language || null } : null;
  }
  const option = (screen.options || []).find(item => item.value === data.value);
  return option ? {
    value: option.value,
    label: option.label,
    recognized_medicine: data.recognized_medicine || null,
    follow_up_question: data.follow_up_question || null,
    possible_categories: data.possible_categories || [],
    volunteered_context: data.volunteered_context || null,
    custom_symptom: data.custom_symptom || null,
    detected_language: data.detected_language || null,
  } : null;
}

async function understandWithAi(text, screen, image = null) {
  if (!understanding.available || Date.now() < understanding.disabledUntil) return null;
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), understandingTimeoutMs);
  try {
    const payload = {
      transcript: text,
      language: conversationLanguage || 'auto',
      question_id: screen.question_id,
      type: screen.type,
      title: screen.title,
      minimum: screen.minimum,
      maximum: screen.maximum,
      options: (screen.options || []).map(option => ({ value: option.value, label: option.label })),
    };
    if (image?.data) {
      payload.image = image;
    }
    const response = await fetch(understandingUrl, {
      method: 'POST',
      headers: understandingHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      understanding.disabledUntil = Date.now() + 60000;
      return null;
    }
    const data = await response.json();
    if (data?.emergency || data?.reason === 'emergency_triage') {
      return data;
    }
    return acceptAiAnswer(data, screen);
  } catch (_) {
    understanding.disabledUntil = Date.now() + 60000;
    return null;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

// Only a provider that was configured but cannot be used is worth telling the
// operator about; a kiosk that deliberately runs without one stays quiet.
async function refreshUnderstandingStatus() {
  try {
    const response = await fetch(understandingStatusUrl, {
      headers: understandingHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) {
      understanding.available = false;
      return;
    }
    const status = await response.json();
    understanding.available = Boolean(status?.available);
    if (status?.note) showOperatorBadge('ai', 'setup.aiNotUsable');
  } catch (_) {
    understanding.available = false;
  }
}

async function handleNaturalLanguageAnswer(text, source, image = null) {
  text = cleanTranscriptText(text);
  if (!text && !image) return;
  if (source === 'voice') {
    // A turn is already in flight. Browsers can deliver a second final
    // transcript while the answer is being checked; drop it instead of adding
    // a duplicate customer bubble.
    if (busy) return;
    const normalized = `${current?.revision}:${current?.screen?.question_id}:${Boolean(pendingAnswer)}:${text.toLowerCase()}`;
    if (normalized === lastVoiceTranscript && Date.now() - lastVoiceTranscriptAt < 4000) return;
    lastVoiceTranscript = normalized;
    lastVoiceTranscriptAt = Date.now();
    // A read-back was just confirmed and the recognizer echoed "correct" or
    // "yes" again. Without a pending read-back this is not a new answer.
  }
  markActivity();
  appendTranscript('user', text || (image ? t('chat.imageAttached', currentLanguage) : ''));
  // In automatic mode, detect English/German locally before the deterministic
  // mapper can complete the turn. Other languages are detected by the AI
  // understanding sidecar below.
  if (text) {
    const basicLanguage = detectLanguage(text);
    if (basicLanguage && basicLanguage !== conversationLanguage) {
      conversationLanguage = basicLanguage;
      document.documentElement.lang = basicLanguage;
      voice.setLanguage(basicLanguage);
    }
  }
  if (text) maybeSwitchLanguage(text);
  if (text) {
    const langSwitch = detectLanguage(text);
    if (langSwitch && /\b(?:talk|speak|matladu|matladandi|bolo|in|me|lo|sprechen|deutsch|bitte|please)\b/i.test(text) && langSwitch !== conversationLanguage) {
      conversationLanguage = langSwitch;
      document.documentElement.lang = langSwitch;
      voice.setLanguage(langSwitch);
      applyStaticTranslations();
      updateMuteLabel();
      if (started && current?.screen && !busy) render();
      const hasClinicalContent = /\b(headache|pain|fever|cold|cough|age|yesterday|severe|mild|moderate|kopf|schmerz|fieber|dast|dard|bukhar|noppi|నొప్పి|తలనెప్పి|జ్వరం|సర్దర్ద్)\b/i.test(text);
      if (!hasClinicalContent) {
        const greeting = langSwitch === 'te'
          ? 'నమస్కారం! నేను తెలుగులో మాట్లాడగలను. మీకు ఎలా సహాయపడగలను?'
          : langSwitch === 'hi'
          ? 'नमस्ते! मैं हिन्दी में बात कर सकता हूँ। आपकी क्या समस्या है?'
          : langSwitch === 'de'
          ? 'Guten Tag! Ich antworte Ihnen gerne auf Deutsch. Welche Beschwerden haben Sie?'
          : `Language changed to ${langSwitch}.`;
        sayAssistant(greeting, `lang-switch:${langSwitch}`);
        return;
      }
    }
  }
  if (text && isEmergencyWording(text)) {
    triggerEmergencyNotice();
    return;
  }
  if (!current?.screen || busy) return;
  if (current.state?.completed) {
    if (current.product) handleProductConversation(text);
    return;
  }
  const volunteeredThisTurn = {};
  if (text) {
    const localGeneralContext = extractVolunteeredContext(text);
    const localSafetyContext = extractVolunteeredSafetyContext(text);
    Object.assign(volunteeredThisTurn, localGeneralContext, localSafetyContext);
    for (const key of Object.keys(localGeneralContext)) trustedVolunteeredQuestions.add(key);
    if (current.screen.question_id === 'symptom') {
      sessionSymptomContext = detectDetailedSymptomContext(text) || sessionSymptomContext;
    }
    if (Object.keys(volunteeredThisTurn).length > 0) {
      Object.assign(sessionVolunteeredContext, volunteeredThisTurn);
    }
  }
  // In voice-first mode a read-back can be answered out loud. Only a bare
  // affirmation counts as agreement; anything else falls through as new input.
  if (pendingAnswer && ['voice', 'chat'].includes(source)) {
    const reply = resolveConfirmationReply(text);
    if (reply === 'yes') {
      if (interruptedConfirmation) {
        interruptedConfirmation = false;
        sayAssistant(answerConfirmationText.textContent, `confirmation-replay:${Date.now()}`, { interrupt: true });
        return;
      }
      confirmPendingAnswer({ spoken: true });
      return;
    }
    if (reply === 'no') {
      changePendingAnswer();
      return;
    }
    hideAnswerConfirmation();
  }
  if (current?.screen?.question_id === 'rag_consultation' || current?.mode === 'rag_direct' || current?.screen?.type === 'free_text') {
    callWorkflow({ answer: { question_id: 'rag_consultation', value: text, text } });
    return;
  }
  const screen = localizeScreen(current.screen, currentLanguage);
  const conversationalReply = conversationalReplyFor(text, screen);
  if (!image && conversationalReply) {
    sayAssistant(conversationalReply, `conversation:${screen.question_id}:${normalizeIntentText(text)}`, { interrupt: true });
    return;
  }
  if (!image && screen.question_id === 'symptom' && await handleMixedSymptomRequest(text, screen)) return;
  if (!image && screen.question_id === 'symptom' && await handleMedicineMention(text, screen)) return;
  let answer = null;
  let interpreted = false;
  let aiRecognized = null;
  if (understanding.available) {
    setVoiceMode('thinking');
    const aiAnswer = await understandWithAi(text, screen, image);
    if (aiAnswer?.emergency || aiAnswer?.reason === 'emergency_triage') {
      triggerEmergencyNotice();
      return;
    }
    if (aiAnswer) {
      if (aiAnswer.detected_language && aiAnswer.detected_language !== conversationLanguage) {
        conversationLanguage = aiAnswer.detected_language;
        document.documentElement.lang = conversationLanguage;
        voice.setLanguage(conversationLanguage);
      }
      answer = aiAnswer;
      interpreted = true;
      aiRecognized = aiAnswer.recognized_medicine || null;
      if (screen.question_id === 'symptom' && aiAnswer.custom_symptom) {
        sessionSymptomContext = detectDetailedSymptomContext(aiAnswer.custom_symptom) || sessionSymptomContext;
      }
      if (aiAnswer.volunteered_context && typeof aiAnswer.volunteered_context === 'object') {
        const safeContext = safeAiVolunteeredContext(aiAnswer.volunteered_context);
        Object.assign(volunteeredThisTurn, safeContext);
        Object.assign(sessionVolunteeredContext, safeContext);
        if (Number(aiAnswer.confidence) >= 0.85) {
          for (const key of Object.keys(safeContext)) trustedVolunteeredQuestions.add(key);
        }
      }
      if (screen.question_id === 'symptom' && aiAnswer.follow_up_question && aiAnswer.possible_categories?.length > 1) {
        sayAssistant(aiAnswer.follow_up_question, `symptom-follow-up:${aiAnswer.value}`, { interrupt: true });
        return;
      }
    }
    if (busy || current?.screen?.question_id !== screen.question_id) {
      setVoiceMode('idle');
      return;
    }
  }
  if (!answer && !image) {
    answer = resolveVoiceAnswer(text, screen);
  }
  if (!answer && Object.keys(volunteeredThisTurn).length > 0) {
    const acknowledgement = volunteeredContextAcknowledgement(volunteeredThisTurn);
    const prompt = `${acknowledgement} ${t('premium.missingAnswer', activeLanguage())} ${naturalVoiceQuestion(screen)}`;
    sayAssistant(prompt, `volunteered-but-missing:${screen.question_id}:${normalizeIntentText(text)}`, { interrupt: true });
    return;
  }
  // Run multilingual understanding before the help fallback. A non-Latin
  // symptom request can end in a question mark while its normalized Latin text
  // is empty; handling punctuation first caused Telugu to receive the generic
  // English clarification instead of being interpreted as a symptom answer.
  if (!image && !interpreted && (!answer || isQuestionByWording(text))) {
    const clarification = clarificationFor(text, screen);
    if (clarification) {
      sayAssistant(clarification, `clarification:${current.screen.question_id}:${text}`, { interrupt: true });
      return;
    }
  }
  if (!answer) {
    const guidance = unmatchedAnswerGuidance(text, screen)
      || (voiceOnlyPage
        ? `${t('premium.noMatch', activeLanguage())} ${naturalVoiceQuestion(screen, { clarify: true })}`
        : null)
      || (screen.type === 'number'
        ? t('speech.numberNotIdentified', currentLanguage)
        : t('speech.answerNotMatched', currentLanguage));
    sayAssistant(guidance, `input-no-match:${current.screen.question_id}:${text}`, { interrupt: true });
    return;
  }
  if (screen.question_id === 'warning_signs' && answer.value === 'no' && interruptedWarning) {
    interruptedWarning = false;
    const intro = activeLanguage() === 'de'
      ? 'Bitte hören Sie zuerst alle Warnzeichen an.'
      : 'Please hear all the warning signs before answering.';
    sayAssistant(`${intro} ${questionSpeech(screen)}`, `warning-replay:${Date.now()}`, { interrupt: true });
    return;
  }
  if (screen.question_id === 'symptom' && (isMedicineRequest(text) || image || aiRecognized) && !interpreted && !pendingAnswer) {
    const medName = aiRecognized || '';
    const intro = medName
      ? `${medName}: ${t('pharmacy.symptomIntentProceed', currentLanguage, { symptom: answer.label })}`
      : t('pharmacy.symptomIntentProceed', currentLanguage, { symptom: answer.label });
    if (await sayAssistant(intro, `symptom-intent:${answer.value}`)) {
      submitAnswer(answer.value, answer.label, true);
      return;
    }
  }
  if (screen.question_id === 'symptom' && answer?.value === 'other') {
    if (voiceOnlyPage) {
      sayAssistant(t('voiceSymptomClarification', activeLanguage()), `symptom-clarify:${text}`, { interrupt: true });
      return;
    }
    showCustomSymptomPrompt();
    return;
  }
  // Natural human conversation: directly submit understood answers and proceed!
  // Only confirm if specifically flagged by clinical safety checks (e.g. uncertain warning signs).
  if (needsAnswerConfirmation(current.screen.question_id, answer, text)) {
    showAnswerConfirmation(answer, source);
    return;
  }
  submitAnswer(answer.value, answer.label, true);
}

function volunteeredContextAcknowledgement(context) {
  const facts = [];
  if (context.age != null) facts.push(`you are ${context.age}`);
  if (context.duration) facts.push('you told me when the symptom started');
  if (context.allergy_status === 'no') facts.push('you reported no medicine allergies');
  if (context.medication_status === 'no') facts.push('you are not currently taking medicines');
  if (context.condition_status === 'no') facts.push('you reported no ongoing medical conditions');
  if (context.pregnancy_breastfeeding === 'not_applicable') facts.push('pregnancy or breastfeeding does not apply');
  if (context.severity) facts.push(`the symptom is ${context.severity}`);
  if (!facts.length) return 'Thank you. I noted that information.';
  const joined = facts.length === 1
    ? facts[0]
    : `${facts.slice(0, -1).join(', ')}, and ${facts.at(-1)}`;
  return `Thank you. I understood that ${joined}.`;
}

function unmatchedAnswerGuidance(text, screen) {
  const normalized = normalizeIntentText(text);
  // "I have no other symptoms" is useful information, but it does not answer
  // the duration screen. Say exactly what we still need rather than implying
  // that the browser failed to hear the customer.
  if (screen.question_id === 'duration'
    && /\b(?:no|not|without)\b.*\b(?:other\s+)?symptoms?\b/.test(normalized)) {
    return t('speech.durationStillNeeded', currentLanguage);
  }
  if (screen.question_id === 'warning_signs') {
    return t('speech.warningSignsAnswerNeeded', currentLanguage);
  }
  return null;
}

async function handleMixedSymptomRequest(text, screen) {
  const normalized = normalizeIntentText(text);
  const hasFeverOrPain = /\b(fever|temperature|headache|pain|fieber|schmerz)\b/.test(normalized);
  const hasColdOrCough = /\b(cold|cough|runny nose|blocked nose|congestion|sore throat|flu|erkaltung|husten)\b/.test(normalized);
  if (!hasFeverOrPain || !hasColdOrCough) return false;
  const answer = (screen.options || []).find(option => option.value === 'pain_fever');
  if (!answer) return false;
  const notice = t('pharmacy.mixedColdFever', currentLanguage);
  if (await sayAssistant(notice, `mixed-symptom:${normalizeIntentText(text)}`, { interrupt: true })) {
    pendingSubmission = answer;
    pendingSubmissionTimer = setTimeout(() => {
      if (pendingSubmission === answer && !busy) {
        clearPendingSubmission();
        submitAnswer(answer.value, answer.label, true);
      } else clearPendingSubmission();
    }, 25000);
  } else {
    submitAnswer(answer.value, answer.label, true);
  }
  return true;
}

function productDirections(product) {
  const dose = product?.instructions && typeof product.instructions === 'object' ? product.instructions : {};
  const structured = [
    dose.per_dose ? t('result.dosePerDose', currentLanguage, { value: dose.per_dose }) : '',
    dose.min_interval_hours ? t('result.doseInterval', currentLanguage, { value: dose.min_interval_hours }) : '',
    dose.max_doses_per_24h ? t('result.doseMaxDoses', currentLanguage, { value: dose.max_doses_per_24h }) : '',
  ].filter(Boolean);
  return structured.length ? structured.join(' ') : String(dose.display_text || '').trim();
}

function handleProductConversation(text) {
  const product = current?.product;
  if (!product) return;
  const normalized = normalizeIntentText(text);
  const directions = productDirections(product);
  const indications = (Array.isArray(product.allowed_indications) ? product.allowed_indications : [])
    .map(value => String(value || '').trim()).filter(Boolean).slice(0, 4);
  const warnings = (Array.isArray(product.warnings) ? product.warnings : [])
    .map(value => String(value || '').trim()).filter(Boolean).slice(0, 3);
  let reply;
  if (/\b(how|dose|dosage|take|tablet|tablets|often|many|repeat|directions|instructions)\b/.test(normalized)) {
    reply = directions || t('productChat.openLabel', activeLanguage());
  } else if (/\b(food|eat|meal|stomach|milk|drink|empty stomach)\b/.test(normalized)) {
    const isNsaid = /ibuprofen|aspirin|diclofenac|naproxen/i.test(product.name || product.brand_name || '');
    reply = isNsaid
      ? (activeLanguage() === 'de'
          ? 'Es wird empfohlen, dieses Medikament mit oder nach einer Mahlzeit oder einem Glas Milch einzunehmen, um den Magen zu schonen.'
          : 'It is recommended to take this medication with or after food, or with a glass of water/milk, to protect your stomach.')
      : (activeLanguage() === 'de'
          ? 'Sie können dieses Medikament mit oder ohne Nahrung einnehmen. Trinken Sie dazu ein volles Glas Wasser.'
          : 'You can take this medication with or without food. Drink a full glass of water with it.');
  } else if (/\b(drive|driving|sleepy|drowsy|drowsiness|alert|operate machinery)\b/.test(normalized)) {
    reply = activeLanguage() === 'de'
      ? 'Dieses Schmerzmittel verursacht normalerweise keine Müdigkeit. Wenn Sie sich jedoch schwindelig fühlen, sollten Sie kein Fahrzeug führen.'
      : 'This pain medication typically does not cause drowsiness. However, if you feel dizzy or unwell, avoid driving or operating machinery.';
  } else if (/\b(not better|persist|worse|fever continues|still hurt|doesn't go away|does not go away)\b/.test(normalized)) {
    reply = activeLanguage() === 'de'
      ? 'Wenn Ihre Beschwerden länger als 3 Tage anhalten oder sich verschlimmern, brechen Sie die Selbstbehandlung ab und suchen Sie einen Arzt auf.'
      : 'If your symptoms persist for more than 3 days, or worsen at any time, please stop self-treatment and consult a doctor or healthcare provider.';
  } else if (/\b(use|used|for|treat|help with|purpose)\b/.test(normalized) && indications.length) {
    reply = t('productChat.uses', activeLanguage(), { uses: indications.join(', ') });
  } else if (/\b(warning|precaution|allergy|allergic|medicine|medication|safe|interaction|side effect)\b/.test(normalized)) {
    reply = warnings.length
      ? t('productChat.precautions', activeLanguage(), { warnings: warnings.join(' ') })
      : t('productChat.openLabel', activeLanguage());
  } else if (/\b(thank|thanks|bye|goodbye|nothing|no more|that is all|thats all)\b/.test(normalized)) {
    reply = t('productChat.goodbye', activeLanguage());
  } else {
    reply = t('productChat.help', activeLanguage());
  }
  sayAssistant(reply, `product-chat:${normalized}:${Date.now()}`, { interrupt: true });
}

function conversationalReplyFor(text, screen) {
  const intent = socialIntent(text);
  if (!intent || !screen) return null;
  const question = questionSpeech(screen);
  if (intent === 'greeting') {
    return screen.question_id === 'symptom'
      ? t('friendly.greetingStart', currentLanguage)
      : t('friendly.greetingContinue', currentLanguage, { question });
  }
  if (intent === 'thanks') {
    return t('friendly.thanks', currentLanguage, { question });
  }
  if (intent === 'help') {
    return t('friendly.help', currentLanguage, { question });
  }
  return null;
}

function clarificationFor(text, screen) {
  if (!looksLikeQuestion(text)) return null;
  const normalized = normalizeIntentText(text);
  if (screen.question_id === 'warning_signs'
    && /\b(other symptoms?|which symptoms?|what signs?|warning signs?|anything else)\b/.test(normalized)) {
    return t('clarify.warningSigns', currentLanguage);
  }
  if (/\b(mild|moderate|severe|leicht|mittel|schwer)\b/.test(normalized)) {
    return t('clarify.severity', currentLanguage);
  }
  if (/\b(age|old|alter|alt)\b/.test(normalized)) {
    return t('clarify.age', currentLanguage);
  }
  if (/\b(allergy|allergies|allergie|allergien)\b/.test(normalized)) {
    return t('clarify.allergy', currentLanguage);
  }
  if (/\b(medicine|medication|medications|medikament|medikamente|arznei)\b/.test(normalized)) {
    return t('clarify.medicine', currentLanguage);
  }
  if (/\b(condition|conditions|health|erkrankung|erkrankungen|gesundheit)\b/.test(normalized)) {
    return t('clarify.condition', currentLanguage);
  }
  if (/\b(repeat|question|wiederholen|frage)\b/.test(normalized)) return questionSpeech(screen, { includeOptions: true });
  return voiceOnlyPage
    ? `${t('premium.missingAnswer', activeLanguage())} ${naturalVoiceQuestion(screen)}`
    : t('clarify.generic', currentLanguage);
}

function handleVoiceTranscript(text) {
  // A transcription that finishes after End must not append a customer bubble
  // to the cleared transcript or touch the next session.
  if (!started || !current) return;
  beginVoiceTurn('voice-answer');
  interpretingAnswer = true;
  setTranscriptActivity(t('loading.checking', currentLanguage), true);
  handleNaturalLanguageAnswer(text, 'voice')
    .catch(() => setVoiceMode('idle'))
    .finally(() => {
      interpretingAnswer = false;
      if (!busy && !voice.speaking && !voice.processing) setVoiceMode('idle');
    });
}

async function handleTypedChat(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  const image = attachedImage;
  if (!text && !image) return;
  chatInput.value = '';
  clearAttachedImage();
  if (!started) {
    beginAssessment();
    while (busy || !current?.screen) {
      await new Promise(r => setTimeout(r, 80));
    }
  }
  beginVoiceTurn('typed-answer');
  interpretingAnswer = true;
  setTranscriptActivity(t('loading.checking', activeLanguage()), true);
  handleNaturalLanguageAnswer(text, 'chat', image)
    .catch(() => setVoiceMode('idle'))
    .finally(() => {
      interpretingAnswer = false;
      if (!busy && !voice.speaking && !voice.processing) {
        setTranscriptActivity('', false);
        setVoiceMode('idle');
      }
    });
}

function confirmPendingAnswer({ spoken = false } = {}) {
  if (!pendingAnswer) return;
  const answer = pendingAnswer;
  for (const [key, value] of Object.entries(answer.confirmedContext || {})) confirmedConversationFacts.set(key, value);
  // The spoken "yes" that reached this method is already in the transcript.
  // Adding a synthetic "Correct" made it look as if the customer had supplied
  // two replies and confused the next safety question.
  if (!spoken) appendTranscript('user', t('chat.correctAnswer', currentLanguage));
  hideAnswerConfirmation();
  submitAnswer(answer.value, answer.label, true);
}

function changePendingAnswer() {
  if (!pendingAnswer) return;
  appendTranscript('user', t('chat.changeAnswer', currentLanguage));
  hideAnswerConfirmation();
  const prompt = t('chat.againPrompt', currentLanguage);
  sayAssistant(prompt, `change-answer:${current?.screen?.question_id}:${Date.now()}`, { interrupt: true });
  chatInput.focus();
}

function repeatCurrentQuestion() {
  if (!current?.screen) return;
  markActivity();
  const presentation = localizeResult(current, currentLanguage);
  const text = current.product && current.state?.completed
    ? spokenProductSummary(current.product, presentation)
    : questionSpeech(current.screen, { includeOptions: true });
  sayAssistant(text, `repeat:${current.screen.question_id}:${Date.now()}`, { interrupt: true });
}

function beginAssessment() {
  beginVoiceTurn('start');
  interruptedWarning = false;
  interruptedConfirmation = false;
  confirmedConversationFacts.clear();
  assessmentGeneration += 1;
  busy = false;
  voice.cancelListening();
  started = true;
  markActivity();
  sessionId = createSessionId();
  sessionVolunteeredContext = {};
  acknowledgedVolunteeredQuestions = new Set();
  trustedVolunteeredQuestions = new Set();
  sessionSymptomContext = null;
  current = null;
  lastAnnouncedKey = '';
  clearPendingSubmission();
  hideAnswerConfirmation();
  clearTranscript();
  clearAttachedImage();
  const voiceResultContainer = document.querySelector('#voiceResultContainer');
  if (voiceResultContainer) {
    voiceResultContainer.hidden = true;
    voiceResultContainer.innerHTML = '';
  }
  // Gemini Live needs the MediaStream itself. Requesting it on the customer's
  // Start tap keeps the browser permission prompt in a user gesture.
  if (voice.geminiLiveEnabled) initMicAudioAnalyser().catch(() => {});
  if (voice.geminiLiveEnabled) voice.prepareListening().catch(() => {});
  refreshUnderstandingStatus().catch(() => { understanding.available = false; });
  startButton.hidden = true;
  microphoneButton.hidden = false;
  restartButton.disabled = false;
  endSessionButton.disabled = false;

  const greeting = t('speech.greeting', currentLanguage);
  voice.stopSpeaking();
  if (!voiceOnlyPage) sayAssistant(greeting, 'greeting');
  callWorkflow({ reset: true });
}

function endSession(message = t('session.clearMessage', currentLanguage)) {
  confirmedConversationFacts.clear();
  assessmentGeneration += 1;
  voice.cancelListening();
  voice.stopSpeaking();
  clearAutoConfirm();
  document.querySelector('#voiceWarningBadgeContainer')?.remove();
  sessionVolunteeredContext = {};
  acknowledgedVolunteeredQuestions.clear();
  trustedVolunteeredQuestions.clear();
  sessionSymptomContext = null;
  started = false;
  busy = false;
  current = null;
  sessionId = createSessionId();
  lastAnnouncedKey = '';
  clearPendingSubmission();
  hideAnswerConfirmation();
  clearTranscript();
  clearAttachedImage();
  const voiceResultContainer = document.querySelector('#voiceResultContainer');
  if (voiceResultContainer) {
    voiceResultContainer.hidden = true;
    voiceResultContainer.innerHTML = '';
  }
  releaseMicAudioAnalyser();
  startButton.hidden = false;
  microphoneButton.hidden = true;
  restartButton.disabled = true;
  endSessionButton.disabled = true;
  app.innerHTML = `
    <div class="welcome-card">
      <p class="step-label">${escapeHtml(t('welcome.eyebrow', currentLanguage))}</p>
      <h2>${escapeHtml(t('session.readyTitle', currentLanguage))}</h2>
      <p>${escapeHtml(message)}</p>
    </div>`;
  updateProgress();
  setInteractiveControls();
  setVoiceMode('idle');
  if (voiceOnlyPage) {
    document.body.dataset.voiceState = 'ended';
    voiceStatus.textContent = t('voice.sessionComplete', currentLanguage);
  }
}

function startActivityWatchdog() {
  const limit = Number(config.inactivityMs) || 30000;
  for (const eventName of ['pointerdown', 'keydown', 'touchstart']) {
    document.addEventListener(eventName, markActivity, { passive: true });
  }
  globalThis.setInterval(() => {
    if (!started || busy) return;
    // Long spoken warning lists and a customer's spoken answer are activity,
    // even though they generate no pointer or keyboard events.
    if (voice.speaking || voice.processing || voice.listening || voice.recognitionStopping) {
      markActivity();
      return;
    }
    if (Date.now() - lastActivityAt > limit) endSession(t('session.inactivity', currentLanguage));
  }, Math.min(15000, limit));
}

// Single barge-in handler. A previous duplicate assignment silently dropped
// the interrupted-warning and interrupted-confirmation flags, so a customer
// could answer "no" before hearing the full safety list.
function handleVoiceBargeIn(interruption) {
  markActivity();
  if (current?.screen?.question_id === 'warning_signs') interruptedWarning = true;
  if (pendingAnswer) interruptedConfirmation = true;
  handsFreeArmed = true;
  if (voiceOnlyPage && voiceCaption && voiceCaptionRole) {
    voiceCaptionRole.textContent = 'You · speaking';
  }
  const metric = voice.lastBargeInMetric;
  if (metric && metric !== lastRecordedBargeInMetric) {
    lastRecordedBargeInMetric = metric;
    voiceMetrics.barge_ins.push(metric);
  }
}

function configureVoice() {
  voice.onBargeIn = handleVoiceBargeIn;
  voice.onPlaybackStart = recordVoicePlaybackStart;
  voice.onFinalTranscript = handleVoiceTranscript;
  voice.onInterimTranscript = text => {
    const activity = text
      ? t('transcript.listening', currentLanguage, { text })
      : (voice.listening ? t('voice.listening', currentLanguage) : '');
    setTranscriptActivity(activity, Boolean(activity));
    if (voiceOnlyPage && text && voiceCaption) {
      voiceCaption.textContent = cleanTranscriptText(text);
      if (voiceCaptionRole) voiceCaptionRole.textContent = 'You · listening';
    }
    interimTranscript.textContent = '';
    interimTranscript.hidden = true;
  };
  voice.onStateChange = mode => setVoiceMode(mode);
  voice.onError = (message, code) => {
    voiceMetrics.errors.push({ code: String(code || 'unknown'), at: new Date().toISOString() });
    // A refused or absent microphone must not be re-opened after every spoken
    // prompt - that would interrupt the whole assessment with the same error.
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'not-supported'].includes(code)) {
      handsFreeBlocked = true;
    }
    sayAssistant(message, `voice-error:${message}`);
    document.body.dataset.voiceState = 'error';
    voiceStatus.textContent = message;
  };
  if (!voice.recognitionSupported) {
    microphoneButton.disabled = true;
    microphoneLabel.textContent = t('voice.unavailableLabel', currentLanguage);
  }
}

function toggleMicrophone() {
  if (!voice.recognitionSupported || busy) return;
  const generation = assessmentGeneration;
  if (voice.listening) {
    voice.stopListening();
    return;
  }
  handsFreeBlocked = false;
  if (voice.speaking || voice.processing) voice.stopSpeaking();
  globalThis.setTimeout(() => {
    if (generation !== assessmentGeneration) return;
    initMicAudioAnalyser()
      .catch(() => null)
      .finally(() => {
        if (generation !== assessmentGeneration) return;
        if (!voice.startListening()) setVoiceMode('idle');
      });
  }, 80);
}

function toggleMute() {
  muted = !muted;
  voice.setMuted(muted);
  updateMuteLabel();
}

let micAnalyser = null;
let micAudioContext = null;
let micDataArray = null;
let micStream = null;
let micGeneration = 0;

function releaseMicAudioAnalyser() {
  micGeneration += 1;
  micStream?.getTracks().forEach(track => track.stop());
  micStream = null;
  voice.setMicrophoneStream(null);
  micAudioContext?.close?.().catch(() => {});
  micAudioContext = null;
  micAnalyser = null;
  micDataArray = null;
}

globalThis.addEventListener('pagehide', () => {
  assessmentGeneration += 1;
  voice.cancelListening();
  voice.stopSpeaking();
  releaseMicAudioAnalyser();
});

async function initMicAudioAnalyser() {
  if (micStream) return micStream;
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const generation = ++micGeneration;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    } });
    if (generation !== micGeneration) {
      stream.getTracks().forEach(track => track.stop());
      return null;
    }
    micStream = stream;
    voice.setMicrophoneStream(stream);
    micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = micAudioContext.createMediaStreamSource(stream);
    micAnalyser = micAudioContext.createAnalyser();
    micAnalyser.fftSize = 64;
    micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
    source.connect(micAnalyser);
    return stream;
  } catch (_) {
    return null;
  }
}

function startVisualizer() {
  const context = visualizer.getContext('2d');
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let dpr = 1;

  function readPalette() {
    const styles = getComputedStyle(document.documentElement);
    return {
      edge: styles.getPropertyValue('--viz-edge').trim() || 'rgba(71, 217, 155, 0)',
      mid: styles.getPropertyValue('--viz-mid').trim() || 'rgba(71, 217, 155, 0.35)',
      core: styles.getPropertyValue('--viz-core').trim() || 'rgba(122, 240, 190, 0.95)',
    };
  }

  let palette = readPalette();
  document.addEventListener('pillpal-theme', () => { palette = readPalette(); });

  function resize() {
    const rect = visualizer.getBoundingClientRect();
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    visualizer.width = Math.round(width * dpr);
    visualizer.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    let liveVolume = 0;
    if (micAnalyser && micDataArray && voiceMode === 'listening') {
      micAnalyser.getByteFrequencyData(micDataArray);
      let sum = 0;
      for (let i = 0; i < micDataArray.length; i += 1) sum += micDataArray[i];
      liveVolume = Math.min(1, sum / (micDataArray.length * 120));
    }
    const amplitude = voiceMode === 'listening' ? 20 + liveVolume * 45 : voiceMode === 'speaking' ? 26 : voiceMode === 'thinking' ? 18 : 9;
    const speed = reducedMotion ? 0 : time * (voiceMode === 'listening' ? 0.004 : 0.0022);
    const center = height / 2;
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, palette.edge);
    gradient.addColorStop(0.28, palette.mid);
    gradient.addColorStop(0.5, palette.core);
    gradient.addColorStop(0.72, palette.mid);
    gradient.addColorStop(1, palette.edge);

    for (let layer = 0; layer < 3; layer += 1) {
      context.beginPath();
      context.strokeStyle = gradient;
      context.globalAlpha = 0.95 - layer * 0.23;
      context.lineWidth = layer === 0 ? 1.8 : 1;
      for (let x = 0; x <= width; x += 4) {
        const envelope = Math.sin(Math.PI * x / width) ** 2;
        const wave = Math.sin(x * (0.018 + layer * 0.004) + speed + layer * 1.7)
          + 0.46 * Math.sin(x * 0.047 - speed * 1.4 + layer);
        const y = center + wave * amplitude * envelope * (1 - layer * 0.16);
        if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
    globalThis.requestAnimationFrame(draw);
  }

  resize();
  new ResizeObserver(resize).observe(visualizer);
  globalThis.requestAnimationFrame(draw);
}

startButton.addEventListener('click', beginAssessment);
restartButton.addEventListener('click', beginAssessment);
microphoneButton.addEventListener('click', toggleMicrophone);
muteButton.addEventListener('click', toggleMute);
chatForm.addEventListener('submit', handleTypedChat);
repeatQuestionButton.addEventListener('click', repeatCurrentQuestion);
cameraButton?.addEventListener('click', () => cameraInput?.click());
cameraInput?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const resized = await readAndResizeImage(file);
    attachedImage = resized;
    if (imagePreviewThumb) {
      imagePreviewThumb.src = `data:${resized.mimeType};base64,${resized.data}`;
      imagePreviewThumb.hidden = false;
    }
    if (imagePreviewContainer) imagePreviewContainer.hidden = false;
    chatInput.focus();
  } catch (_) {
    clearAttachedImage();
  }
});
clearImageButton?.addEventListener('click', clearAttachedImage);
confirmAnswerButton.addEventListener('click', () => confirmPendingAnswer({ spoken: false }));

transcriptPanel?.addEventListener('wheel', event => {
  if (transcript.scrollHeight <= transcript.clientHeight) return;
  const before = transcript.scrollTop;
  transcript.scrollTop += event.deltaY;
  if (transcript.scrollTop !== before) event.preventDefault();
}, { passive: false });

interactionColumn?.addEventListener('wheel', event => {
  if (app.scrollHeight <= app.clientHeight) return;
  const before = app.scrollTop;
  app.scrollTop += event.deltaY;
  if (app.scrollTop !== before) event.preventDefault();
}, { passive: false });
changeAnswerButton.addEventListener('click', changePendingAnswer);
endSessionButton.addEventListener('click', () => endSession());
themeToggle?.addEventListener('click', toggleTheme);
operatorBadge?.addEventListener('pointerdown', startOperatorBadgePress);
for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  operatorBadge?.addEventListener(eventName, cancelOperatorBadgePress);
}
operatorBadge?.addEventListener('contextmenu', event => event.preventDefault());
operatorBadgeDismiss?.addEventListener('click', dismissOperatorBadge);
languageSelect?.addEventListener('change', event => setLanguage(event.target.value, { speakCurrent: true }));
themeMedia?.addEventListener?.('change', event => {
  if (!storedTheme) applyTheme(event.matches ? 'light' : 'dark');
});
globalThis.addEventListener('beforeunload', () => voice.destroy());

// Operator-facing export used by the hardware acceptance checklist. It contains
// timings and recognition modes only, never transcripts or patient answers.
globalThis.PILLPAL_VOICE_METRICS = {
  snapshot() {
    let microphoneTracks = [];
    try {
      microphoneTracks = micStream
        ? micStream.getTracks().map(track => ({
            kind: track.kind,
            readyState: track.readyState,
            enabled: track.enabled,
            label: track.label,
          }))
        : [];
    } catch (_) { /* a released stream is already the desired state */ }
    return {
      generated_at: new Date().toISOString(),
      capture_mode: navigator.webdriver ? 'automated-browser' : 'real-browser',
      run_label: new URLSearchParams(location.search).get('run') || null,
      user_agent: navigator.userAgent,
      online: navigator.onLine,
      secure_context: globalThis.isSecureContext === true,
      session: {
        started,
        question_id: current?.screen?.question_id || null,
        completed: Boolean(current?.state?.completed),
      },
      responses: voiceMetrics.responses.slice(-50),
      barge_ins: voiceMetrics.barge_ins.slice(-50),
      turn_requests: voiceMetrics.turn_requests.slice(-50),
      errors: voiceMetrics.errors.slice(-50),
      microphone_tracks: microphoneTracks,
      voice: voice.getDiagnostics(),
    };
  },
  reset() {
    voiceMetrics.responses.length = 0;
    voiceMetrics.barge_ins.length = 0;
    voiceMetrics.turn_requests.length = 0;
    voiceMetrics.errors.length = 0;
    lastRecordedBargeInMetric = null;
    voice.resetDiagnostics();
  },
};

setLanguage(currentLanguage, { persist: false });
document.body.classList.toggle('voice-first', voiceFirst);
configureVoice();
startVisualizer();
startActivityWatchdog();
setVoiceMode('idle');
startStartupSelfCheck();
startConfigWatcher().catch(() => {});
refreshUnderstandingStatus().catch(() => { understanding.available = false; });
// The sidecar can be restarted or briefly unreachable at boot. Re-check the
// helper instead of keeping voice input degraded for the rest of the day.
globalThis.setInterval(() => {
  refreshUnderstandingStatus().catch(() => { understanding.available = false; });
}, 60000);
