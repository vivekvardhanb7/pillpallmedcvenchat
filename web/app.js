import { VoiceAssistant } from './voice-assistant.js';
import { resolveVoiceAnswer } from './voice-input-mapper.js';
import { detectMedicineMention } from './medicine-mentions.js';
import {
  DEFAULT_LANGUAGE,
  detectLanguage,
  languageByCode,
  localizeResult,
  localizeScreen,
  localizeSummary,
  speechLocale,
  t,
} from './i18n.js';

const config = window.PILLPAL_CONFIG || {};
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
const transcript = document.querySelector('#transcript');
const interimTranscript = document.querySelector('#interimTranscript');
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

const LANGUAGE_STORAGE_KEY = 'pillpal-language';
let currentLanguage = readStoredLanguage();
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
let transcriptEntries = [];
let lastAnnouncedKey = '';
let pendingAnswer = null;
let pendingSubmission = null;
let pendingSubmissionTimer = null;
let lastActivityAt = Date.now();

let operatorBadgeMessage = null;
let operatorBadgePressTimer = null;
let bootConfigText = null;
let notifiedConfigText = null;
let pendingConfigNotice = false;
const dismissedOperatorKinds = new Set();

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
  document.documentElement.lang = language.code;
  if (languageSelect) languageSelect.value = language.code;
  voice.setLanguage(language.code);
  refreshVoiceAvailability();
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
    } catch (_) {
      /* storage can be unavailable in private kiosk modes */
    }
  }
  applyStaticTranslations();
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

function maybeSwitchLanguage(text) {
  const detected = detectLanguage(text);
  if (!detected || detected === currentLanguage) return false;
  setLanguage(detected, { persist: false });
  return true;
}

// Confirmations are reserved for the few answers where a misheard value is both
// plausible and consequential: red-flag answers, ages captured from spoken
// number words, and free-text history entries. Everything else maps to fixed
// controlled values and is reviewed again on the final summary screen.
function needsAnswerConfirmation(questionId, answer, text) {
  if (questionId === 'warning_signs') return true;
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
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 8000);
  let status = 0;
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: workflowHeaders(),
      body: JSON.stringify({
        session_id: `selfcheck_${Date.now()}`,
        country_code: config.countryCode || 'MA',
        language_code: 'en',
        reset: true,
      }),
      signal: controller.signal,
    });
    status = response.status;
  } catch (_) {
    status = 0;
  } finally {
    globalThis.clearTimeout(timer);
  }
  if (status >= 200 && status < 300) return;
  showOperatorBadge('setup', connectionHintKey(status));
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

function setInteractiveControls() {
  const canAnswer = started && !busy && Boolean(current?.screen) && current?.state?.completed !== true && !pendingAnswer;
  chatInput.disabled = !canAnswer;
  sendChatButton.disabled = !canAnswer;
  repeatQuestionButton.disabled = !started || busy || !current?.screen;
  restartButton.disabled = !started;
  endSessionButton.disabled = !started;
  microphoneButton.disabled = !canAnswer || !voice.recognitionSupported;
  if (canAnswer) {
    const screen = localizeScreen(current.screen, currentLanguage);
    chatInput.placeholder = screen.type === 'number'
      ? t('chat.typeAge', currentLanguage)
      : screen.type === 'text'
        ? screen.placeholder || t('chat.placeholderDefault', currentLanguage)
        : t('chat.placeholderOption', currentLanguage);
  } else {
    chatInput.placeholder = started ? t('chat.completeStep', currentLanguage) : t('chat.startToChat', currentLanguage);
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

function hideAnswerConfirmation() {
  pendingAnswer = null;
  answerConfirmation.hidden = true;
  answerConfirmationText.textContent = '';
  setInteractiveControls();
}

function showAnswerConfirmation(answer, source) {
  pendingAnswer = { ...answer, source };
  const verb = source === 'voice' ? t('chat.heard', currentLanguage) : t('chat.understood', currentLanguage);
  answerConfirmationText.textContent = `${verb}: “${answer.label}”. ${t('chat.isCorrect', currentLanguage)}`;
  answerConfirmation.hidden = false;
  setInteractiveControls();
  const prompt = `${verb} ${answer.label}. ${t('chat.isCorrect', currentLanguage)}`;
  appendTranscript('assistant', prompt, `confirm-input:${current?.screen?.question_id}:${answer.label}`);
  voice.speak(prompt, { interrupt: true });
}

function setVoiceMode(mode) {
  voiceMode = mode;
  const labels = {
    idle: started ? t('voice.readyForAnswer', currentLanguage) : t('voice.readyWhenYouAre', currentLanguage),
    listening: t('voice.listening', currentLanguage),
    speaking: t('voice.speaking', currentLanguage),
    thinking: t('voice.thinking', currentLanguage),
    unavailable: t('voice.inputUnavailable', currentLanguage),
    speechOff: t('voice.outputUnavailable', currentLanguage),
  };
  const completed = isCompleted();
  voiceStatus.textContent = !voice.recognitionSupported && started
    ? labels.unavailable
    : completed && mode === 'idle'
      ? t('voice.sessionComplete', currentLanguage)
      : mode === 'idle' && !voice.neuralAvailable
        ? labels.speechOff
        : labels[mode] || labels.idle;
  microphoneButton.classList.toggle('listening', mode === 'listening');
  microphoneLabel.textContent = !voice.recognitionSupported
    ? t('voice.unavailableLabel', currentLanguage)
    : completed
      ? t('voice.sessionComplete', currentLanguage)
      : mode === 'listening' ? t('voice.tapToStop', currentLanguage) : t('app.tapToSpeak', currentLanguage);
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
  transcript.innerHTML = `<p class="empty-transcript">${escapeHtml(t('transcript.empty', currentLanguage))}</p>`;
  interimTranscript.hidden = true;
  interimTranscript.textContent = '';
}

function appendTranscript(role, text, key = '') {
  const clean = cleanTranscriptText(text);
  if (!clean) return;
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
  transcript.append(entry);
  transcript.scrollTop = transcript.scrollHeight;
}

function questionSpeech(screen, { includeOptions = false } = {}) {
  if (!screen) return '';
  const title = /[.?!]$/.test(screen.title || '') ? screen.title : `${screen.title}.`;
  const importantSubtitle = screen.question_id === 'warning_signs' ? screen.subtitle : '';
  const choices = includeOptions && ['single_select', 'confirmation'].includes(screen.type)
    ? ` ${t('speech.optionsAre', currentLanguage, { options: (screen.options || []).map(option => option.label).join(', ') })}`
    : '';
  const interactionHint = includeOptions ? '' : ` ${t('speech.interactionHint', currentLanguage)}`;
  return `${title} ${importantSubtitle || ''}${choices}${interactionHint}`.replace(/\s+/g, ' ').trim();
}

function announceCurrent() {
  if (!current) return;
  const isResult = current.screen?.type === 'result' || current.screen?.type === 'product_result' || current.state?.completed;
  const key = isResult
    ? `result:${current.outcome}:${current.product?.id || ''}`
    : `question:${current.screen?.question_id}:${current.state?.turns || 0}:${current.screen?.error || ''}`;
  if (key === lastAnnouncedKey) return;
  lastAnnouncedKey = key;

  if (isResult) {
    const presentation = localizeResult(current, currentLanguage);
    const productText = current.product ? ` ${t('speech.product', currentLanguage, { name: current.product.name })}` : '';
    const text = `${presentation.message || presentation.title || t('speech.assessmentCompleted', currentLanguage)}${productText}`;
    appendTranscript('assistant', text, key);
    voice.speak(text);
  } else {
    const screen = localizeScreen(current.screen, currentLanguage);
    const text = screen.error
      ? `${screen.error} ${questionSpeech(screen)}`
      : questionSpeech(screen);
    appendTranscript('assistant', text, key);
    voice.speak(text);
  }
}

function setLoading(message = t('loading.checking', currentLanguage)) {
  app.innerHTML = `
    <div class="loading-card">
      <div class="spinner" aria-hidden="true"></div>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

async function callWorkflow({ answer = null, reset = false } = {}) {
  if (busy) return;
  busy = true;
  setVoiceMode('thinking');
  setLoading(t(reset ? 'loading.starting' : 'loading.checking', currentLanguage));
  clearPendingSubmission();
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: workflowHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        country_code: config.countryCode || 'MA',
        language_code: currentLanguage,
        reset,
        state: reset ? null : current?.state,
        answer,
      }),
    });
    if (!response.ok) {
      const error = new Error(`Workflow returned HTTP ${response.status}`);
      error.httpStatus = response.status;
      throw error;
    }
    current = await response.json();
    if (!current || typeof current !== 'object') throw new Error('Workflow returned an invalid response');
    voice.stopSpeaking();
    render();
    announceCurrent();
  } catch (error) {
    const errorText = t('error.workflow', currentLanguage, { message: error.message });
    appendTranscript('assistant', errorText, `error:${error.message}`);
    voice.speak(errorText, { interrupt: true });
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
    busy = false;
    setVoiceMode(voice.speaking ? 'speaking' : voice.listening ? 'listening' : 'idle');
    flushConfigNotice();
  }
}

function renderSummary(summary) {
  if (!summary || typeof summary !== 'object') return '';
  return `<dl class="summary-grid">${localizeSummary(summary, currentLanguage).map(item => `
    <div class="summary-item">
      <dt>${escapeHtml(item.label)}</dt>
      <dd>${escapeHtml(item.value)}</dd>
    </div>`).join('')}</dl>`;
}

function renderOptions(screen) {
  return `<div class="option-grid">${(screen.options || []).map(option => `
    <button class="option-button" type="button" data-value="${escapeHtml(option.value)}" data-label="${escapeHtml(option.label)}">
      ${escapeHtml(option.label)}
    </button>`).join('')}</div>`;
}

function renderResult() {
  const product = current.product;
  const presentation = localizeResult(current, currentLanguage);
  const instructions = product?.instructions?.display_text
    || product?.instructions?.adult_display_text
    || (product?.instructions ? JSON.stringify(product.instructions) : '');
  app.innerHTML = `
    <section class="result-card">
      <p class="step-label">${escapeHtml(presentation.label)}</p>
      <h2>${escapeHtml(presentation.title)}</h2>
      <p class="result-message">${escapeHtml(presentation.message)}</p>
      ${product ? `
        <div class="product-panel">
          <h3>${escapeHtml(product.name)}</h3>
          <p><strong>${escapeHtml(t('result.strength', currentLanguage))}:</strong> ${escapeHtml(product.strength || t('result.seeLabel', currentLanguage))}</p>
          <p><strong>${escapeHtml(t('result.form', currentLanguage))}:</strong> ${escapeHtml(product.dosage_form || t('result.seeLabel', currentLanguage))}</p>
          <p><strong>${escapeHtml(t('result.instructions', currentLanguage))}:</strong> ${escapeHtml(instructions || t('result.seeLocalLabel', currentLanguage))}</p>
          ${/^https?:\/\//i.test(product.label_url || '') ? `<p><a href="${escapeHtml(product.label_url)}" target="_blank" rel="noreferrer">${escapeHtml(t('result.openLabel', currentLanguage))}</a></p>` : ''}
        </div>` : ''}
      ${renderSummary(current.summary)}
      <button class="primary-button" id="resultRestart" type="button">${escapeHtml(t('result.restart', currentLanguage))}</button>
    </section>`;
  document.querySelector('#resultRestart')?.addEventListener('click', beginAssessment);
}

function renderQuestion() {
  const screen = localizeScreen(current.screen, currentLanguage);
  app.innerHTML = `
    <section class="question-card">
      <p class="step-label">${escapeHtml(t('speech.label', currentLanguage))}</p>
      <h2>${escapeHtml(screen.title)}</h2>
      ${screen.subtitle ? `<p class="subtitle">${escapeHtml(screen.subtitle)}</p>` : ''}
      ${screen.error ? `<div class="error-message">${escapeHtml(screen.error)}</div>` : ''}
      ${current.summary ? renderSummary(current.summary) : ''}
      ${['single_select', 'confirmation'].includes(screen.type)
        ? renderOptions(screen)
        : `<p class="input-guidance">${escapeHtml(t('speech.inputGuidance', currentLanguage))}</p>`}
    </section>`;

  document.querySelectorAll('[data-value]').forEach(button => {
    button.addEventListener('click', () => submitAnswer(button.dataset.value, button.dataset.label));
  });

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
  markActivity();
  voice.stopSpeaking();
  hideAnswerConfirmation();
  if (!alreadyTranscribed) appendTranscript('user', transcriptText ?? value);
  callWorkflow({ answer: { question_id: current.screen.question_id, value } });
}

function handleMedicineMention(text, screen) {
  const mention = detectMedicineMention(text);
  if (!mention) return false;
  const uses = t(`pharmacy.uses.${mention.key}`, currentLanguage);
  const purposeAnswer = resolveVoiceAnswer(text, screen);
  if (purposeAnswer) {
    const note = `${uses} ${t('pharmacy.purposeProceed', currentLanguage)}`;
    appendTranscript('assistant', note, `mention:${mention.key}:${purposeAnswer.value}`);
    if (voice.speak(uses)) {
      pendingSubmission = purposeAnswer;
      pendingSubmissionTimer = setTimeout(() => {
        if (pendingSubmission === purposeAnswer && !busy) {
          clearPendingSubmission();
          submitAnswer(purposeAnswer.value, purposeAnswer.label, true);
        } else {
          clearPendingSubmission();
        }
      }, 25000);
      return true;
    }
    submitAnswer(purposeAnswer.value, purposeAnswer.label, true);
    return true;
  }
  const prompt = `${uses} ${t('pharmacy.caution', currentLanguage)} ${t('pharmacy.purposeQuestion', currentLanguage)}`;
  appendTranscript('assistant', prompt, `mention:${mention.key}:ask`);
  voice.speak(prompt, { interrupt: true });
  return true;
}

function handleNaturalLanguageAnswer(text, source) {
  markActivity();
  appendTranscript('user', text);
  maybeSwitchLanguage(text);
  if (!current?.screen || current.state?.completed || busy) return;
  const screen = localizeScreen(current.screen, currentLanguage);
  if (screen.question_id === 'symptom' && handleMedicineMention(text, screen)) return;
  const answer = resolveVoiceAnswer(text, screen);
  const clarification = clarificationFor(text, screen);
  if (clarification) {
    appendTranscript('assistant', clarification, `clarification:${current.screen.question_id}:${text}`);
    voice.speak(clarification, { interrupt: true });
    return;
  }
  if (!answer) {
    const guidance = screen.type === 'number'
      ? t('speech.numberNotIdentified', currentLanguage)
      : t('speech.answerNotMatched', currentLanguage);
    appendTranscript('assistant', guidance, `input-no-match:${current.screen.question_id}:${text}`);
    voice.speak(guidance, { interrupt: true });
    return;
  }
  if (needsAnswerConfirmation(current.screen.question_id, answer, text)) {
    showAnswerConfirmation(answer, source);
    return;
  }
  submitAnswer(answer.value, answer.label, true);
}

function clarificationFor(text, screen) {
  const normalized = cleanTranscriptText(text)
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  if (!/\b(what|why|explain|mean|repeat|help|was|warum|erklaren|erklart|bedeutet|wiederholen|wiederhole|hilfe)\b/.test(normalized)) return null;
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
  return t('clarify.generic', currentLanguage);
}

function handleVoiceTranscript(text) {
  handleNaturalLanguageAnswer(text, 'voice');
}

function handleTypedChat(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || chatInput.disabled) return;
  chatInput.value = '';
  handleNaturalLanguageAnswer(text, 'chat');
}

function confirmPendingAnswer() {
  if (!pendingAnswer) return;
  const answer = pendingAnswer;
  appendTranscript('user', t('chat.correctAnswer', currentLanguage));
  hideAnswerConfirmation();
  submitAnswer(answer.value, answer.label, true);
}

function changePendingAnswer() {
  if (!pendingAnswer) return;
  appendTranscript('user', t('chat.changeAnswer', currentLanguage));
  hideAnswerConfirmation();
  const prompt = t('chat.againPrompt', currentLanguage);
  appendTranscript('assistant', prompt, `change-answer:${current?.screen?.question_id}:${Date.now()}`);
  voice.speak(prompt, { interrupt: true });
  chatInput.focus();
}

function repeatCurrentQuestion() {
  if (!current?.screen) return;
  markActivity();
  const text = questionSpeech(current.screen, { includeOptions: true });
  appendTranscript('assistant', text, `repeat:${current.screen.question_id}:${Date.now()}`);
  voice.speak(text, { interrupt: true });
}

function beginAssessment() {
  started = true;
  markActivity();
  sessionId = createSessionId();
  current = null;
  lastAnnouncedKey = '';
  clearPendingSubmission();
  hideAnswerConfirmation();
  clearTranscript();
  startButton.hidden = true;
  microphoneButton.hidden = false;
  restartButton.disabled = false;
  endSessionButton.disabled = false;

  const greeting = t('speech.greeting', currentLanguage);
  appendTranscript('assistant', greeting, 'greeting');
  voice.stopSpeaking();
  voice.speak(greeting);
  callWorkflow({ reset: true });
}

function endSession(message = t('session.clearMessage', currentLanguage)) {
  voice.stopListening();
  voice.stopSpeaking();
  started = false;
  busy = false;
  current = null;
  sessionId = createSessionId();
  lastAnnouncedKey = '';
  clearPendingSubmission();
  hideAnswerConfirmation();
  clearTranscript();
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
}

function startActivityWatchdog() {
  const limit = Number(config.inactivityMs) || 0;
  if (!limit) return;
  for (const eventName of ['pointerdown', 'keydown', 'touchstart']) {
    document.addEventListener(eventName, markActivity, { passive: true });
  }
  globalThis.setInterval(() => {
    if (!started || busy) return;
    if (Date.now() - lastActivityAt > limit) endSession(t('session.inactivity', currentLanguage));
  }, Math.min(15000, limit));
}

function configureVoice() {
  voice.onFinalTranscript = handleVoiceTranscript;
  voice.onInterimTranscript = text => {
    interimTranscript.textContent = text ? t('transcript.listening', currentLanguage, { text }) : '';
    interimTranscript.hidden = !text;
  };
  voice.onStateChange = mode => setVoiceMode(mode);
  voice.onError = message => {
    appendTranscript('assistant', message, `voice-error:${message}`);
    setVoiceMode('idle');
  };
  if (!voice.recognitionSupported) {
    microphoneButton.disabled = true;
    microphoneLabel.textContent = t('voice.unavailableLabel', currentLanguage);
  }
}

function toggleMicrophone() {
  if (!voice.recognitionSupported || busy) return;
  if (voice.listening) {
    voice.stopListening();
    return;
  }
  if (voice.speaking) voice.stopSpeaking();
  globalThis.setTimeout(() => {
    if (!voice.startListening()) setVoiceMode('idle');
  }, 80);
}

function toggleMute() {
  muted = !muted;
  voice.setMuted(muted);
  updateMuteLabel();
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
    const amplitude = voiceMode === 'listening' ? 34 : voiceMode === 'speaking' ? 26 : voiceMode === 'thinking' ? 18 : 9;
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
confirmAnswerButton.addEventListener('click', confirmPendingAnswer);
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

setLanguage(currentLanguage, { persist: false });
configureVoice();
startVisualizer();
startActivityWatchdog();
setVoiceMode('idle');
startStartupSelfCheck();
startConfigWatcher().catch(() => {});

