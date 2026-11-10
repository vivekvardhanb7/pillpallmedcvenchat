import { localizeScreen, localizeSummary, t } from './i18n.js';

// Voice users receive the same complete question and warnings as touch users.
export function assessmentSpeech(screen, language = 'de', { summary = null } = {}) {
  if (!screen) return '';
  // Complaint categories are an internal routing detail, not a spoken menu.
  // The existing understanding layer maps the user's own words to a pathway.
  if (screen.question_id === 'symptom') return t('voiceOpening', language);
  const localized = localizeScreen(screen, language);
  const warnings = Array.isArray(localized.red_flags) ? localized.red_flags : [];
  const key = `voiceQuestion.${screen.question_id}`;
  const prompt = t(key, language);
  const question = prompt === key ? localized.title : prompt;
  const readback = screen.question_id === 'confirm' && summary
    ? localizeSummary(summary, language).map(item => `${item.label}: ${item.value}`).join('. ') : '';
  return [screen.question_id === 'confirm' && readback ? t('voiceReadbackIntro', language) : '',
    readback, question, ...warnings, warnings.length ? t('voiceWarningReply', language) : '']
    .filter(Boolean).map(part => /[.!?]$/.test(part.trim()) ? part.trim() : `${part.trim()}.`)
    .join(' ').replace(/\s+/g, ' ').trim();
}

// The local TTS endpoint accepts at most 800 characters. Queue every chunk;
// silently truncating a long warning can remove a safety-critical item.
export function splitSpeechText(text, limit = 760) {
  let remaining = String(text || '').replace(/\s+/g, ' ').trim();
  const chunks = [];
  while (remaining.length > limit) {
    const space = remaining.lastIndexOf(' ', limit);
    const end = space > 0 ? space : limit;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
