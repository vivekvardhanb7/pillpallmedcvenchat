import { t } from './i18n.js';
const body = document.body;
const orb = document.querySelector('#voiceOrbButton');
const start = document.querySelector('#startButton');
const microphone = document.querySelector('#microphoneButton');
const centralMic = document.querySelector('#centralMicControl');
const transcriptToggle = document.querySelector('#transcriptToggle');
const transcriptDrawer = document.querySelector('#transcriptDrawer');
const transcriptClose = document.querySelector('#transcriptClose');
const textToggle = document.querySelector('#textToggle');
const textDrawer = document.querySelector('#textDrawer');
const textClose = document.querySelector('#textClose');
const textInput = document.querySelector('#chatInput');
const endButton = document.querySelector('#endSessionButton');
const endedPanel = document.querySelector('#endedPanel');
const newConversation = document.querySelector('#newConversationButton');
const connectionBadge = document.querySelector('#connectionBadge');
const hint = document.querySelector('#voiceStateHint');
const eyebrow = document.querySelector('#voiceStateEyebrow');
const diagnostics = document.querySelector('#voiceDiagnostics');
const diagnosticsList = document.querySelector('#diagnosticsList');
const diagnosticsClose = document.querySelector('#diagnosticsClose');
const diagnosticsExport = document.querySelector('#diagnosticsExport');
const diagnosticsReset = document.querySelector('#diagnosticsReset');
let diagnosticsVisible = new URLSearchParams(location.search).has('diag');

const stateHints = {
  idle: 'Tap the orb and speak naturally in your preferred language.',
  listening: 'Speak naturally. I will stop when your turn is complete.',
  thinking: 'Checking your answer with the medical safety workflow.',
  speaking: 'Start speaking to interrupt. You can also tap the orb.',
  error: 'Check microphone permission or connection, then tap the orb to retry.',
  ended: 'The conversation and local transcript have been cleared.',
};

const stateLabels = {
  idle: 'Ready',
  listening: 'Listening to you',
  thinking: 'Checking your answer',
  speaking: 'MedAssist is speaking',
  error: 'Needs attention',
  ended: 'Session complete',
};

function setDrawer(drawer, toggle, open) {
  drawer.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    const otherDrawer = drawer === transcriptDrawer ? textDrawer : transcriptDrawer;
    const otherToggle = drawer === transcriptDrawer ? textToggle : transcriptToggle;
    otherDrawer.hidden = true;
    otherToggle.setAttribute('aria-expanded', 'false');
  }
}

function activateMicrophone() {
  if (!start.hidden) start.click();
  else if (!microphone.disabled) microphone.click();
}

function updateState() {
  const state = body.dataset.voiceState || 'idle';
  hint.textContent = t(`premium.hint_${state in stateHints ? state : 'idle'}`, document.documentElement.lang);
  eyebrow.textContent = t(`premium.label_${state in stateLabels ? state : 'idle'}`, document.documentElement.lang);
  orb.setAttribute('aria-label', t(state === 'speaking' ? 'premium.interrupt' : state === 'listening' ? 'premium.stopListening' : 'premium.startTalking', document.documentElement.lang));
  endedPanel.hidden = state !== 'ended';
}

function updateConnection() {
  const online = navigator.onLine;
  connectionBadge.classList.toggle('offline', !online);
  connectionBadge.querySelector('span').textContent = t(online ? 'premium.connected' : 'premium.offline', document.documentElement.lang);

}

orb.addEventListener('click', activateMicrophone);
centralMic.addEventListener('click', activateMicrophone);
transcriptToggle.addEventListener('click', () => setDrawer(transcriptDrawer, transcriptToggle, transcriptDrawer.hidden));
transcriptClose.addEventListener('click', () => setDrawer(transcriptDrawer, transcriptToggle, false));
textToggle.addEventListener('click', () => {
  const opening = textDrawer.hidden;
  setDrawer(textDrawer, textToggle, opening);
  if (opening) setTimeout(() => textInput.focus(), 80);
});
textClose.addEventListener('click', () => setDrawer(textDrawer, textToggle, false));
endButton.addEventListener('click', () => setTimeout(() => {
  body.dataset.voiceState = 'ended';
  setDrawer(transcriptDrawer, transcriptToggle, false);
  setDrawer(textDrawer, textToggle, false);
  updateState();
}, 0));
newConversation.addEventListener('click', () => {
  endedPanel.hidden = true;
  body.dataset.voiceState = 'idle';
  start.click();
});
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    event.preventDefault();
    activateMicrophone();
  }
});
function metricValue(value, suffix = '') {
  return value == null || value === '' ? '—' : `${value}${suffix}`;
}

function escapeMetric(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function last(items) {
  return Array.isArray(items) && items.length ? items[items.length - 1] : null;
}

function renderDiagnostics() {
  if (!diagnosticsVisible) return;
  const snapshot = globalThis.PILLPAL_VOICE_METRICS?.snapshot?.();
  if (!snapshot) {
    diagnosticsList.innerHTML = '<div><dt>Status</dt><dd>Metrics not ready</dd></div>';
    return;
  }
  const response = last(snapshot.responses);
  const bargeIn = last(snapshot.barge_ins);
  const turn = last(snapshot.turn_requests);
  const error = last(snapshot.errors);
  const tracks = snapshot.microphone_tracks || [];
  const rows = [
    ['Session', snapshot.session?.started ? `${snapshot.session.question_id || '—'}${snapshot.session.completed ? ' · completed' : ''}` : 'not started'],
    ['Recognition', snapshot.voice?.recognition_mode || '—'],
    ['Response latency', metricValue(response?.ms, ' ms')],
    ['Barge-in gate', bargeIn ? metricValue(bargeIn.gate_ms, ' ms') : '—'],
    ['Barge-in stop', bargeIn ? metricValue(bargeIn.stop_ms, ' ms') : '—'],
    ['Barge-in total', bargeIn ? metricValue(bargeIn.total_ms, ' ms') : '—'],
    ['Transcription', metricValue(snapshot.voice?.last_transcription_ms, ' ms')],
    ['Assessment turn', turn ? `${metricValue(turn.ms, ' ms')} · ${turn.status}` : '—'],
    ['Microphone', tracks.length ? `${tracks.length} track · ${tracks[0].readyState} · ${tracks[0].label || 'unlabelled'}` : 'released'],
    ['Last error', error ? error.code : 'none'],
    ['Capture', `${snapshot.capture_mode} · ${snapshot.online ? 'online' : 'offline'}`],
  ];
  diagnosticsList.innerHTML = rows.map(([term, value]) => `<div><dt>${escapeMetric(term)}</dt><dd>${escapeMetric(value)}</dd></div>`).join('');
}

function exportDiagnostics() {
  const snapshot = globalThis.PILLPAL_VOICE_METRICS?.snapshot?.();
  if (!snapshot) return;
  const payload = { ...snapshot, exported_for: 'hardware-acceptance' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pillpal-voice-${snapshot.run_label || 'hardware'}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if (diagnosticsVisible) {
  diagnostics.hidden = false;
  diagnosticsClose.addEventListener('click', () => {
    diagnostics.hidden = true;
    diagnosticsVisible = false;
  });
  diagnosticsExport.addEventListener('click', exportDiagnostics);
  diagnosticsReset.addEventListener('click', () => {
    globalThis.PILLPAL_VOICE_METRICS?.reset?.();
    renderDiagnostics();
  });
  setInterval(renderDiagnostics, 500);
  renderDiagnostics();
}

new MutationObserver(updateState).observe(body, { attributes: true, attributeFilter: ['data-voice-state'] });
updateConnection();
updateState();

new MutationObserver(() => { updateConnection(); updateState(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
