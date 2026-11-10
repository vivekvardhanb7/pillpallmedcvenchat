/**
 * PILLPAL MedAssist - anonymised outcome row.
 * n8n Code node: Run Once for All Items.
 *
 * This runs after the touchscreen already has its answer, so nothing here can
 * change what the customer sees. It reports the shape of a decision, never its
 * content: no allergy, medicine or condition text, no exact age.
 *
 * Every column is forced inside the checks migration 007 put on
 * kiosk_outcome_log. A rejected insert is invisible to the customer, so the row
 * is made valid here instead of hoping the caller sent clean values.
 */

const response = $input.first().json || {};
const state = response.state || {};

function text(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function oneOf(value, allowed, fallback) {
  const clean = text(value, 60);
  return allowed.has(clean) ? clean : fallback;
}

function wholeNumber(value, min, max, fallback) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function ageBand(ageYears) {
  const age = Number(ageYears);
  if (!Number.isInteger(age) || age < 0 || age > 120) return 'unknown';
  if (age < 18) return 'under_18';
  if (age <= 30) return '18_30';
  if (age <= 45) return '31_45';
  if (age <= 65) return '46_65';
  return 'over_65';
}

const OUTCOMES = new Set([
  'PRODUCT_ELIGIBLE',
  'NO_SUITABLE_PRODUCT',
  'CLINIC_REFERRAL',
  'IMMEDIATE_MEDICAL_CARE',
  'CATALOG_CHECK_REQUIRED',
  'MORE_INFORMATION',
]);

const DURATIONS = new Set(['today', '1_to_2_days', '3_to_7_days', 'more_than_7_days']);
const SEVERITIES = new Set(['mild', 'moderate', 'severe']);
const LANGUAGES = new Set(['en', 'de', 'hi']);
const PATHWAYS = new Set([
  'pain_fever', 'cold_cough', 'allergy', 'diarrhoea', 'heartburn', 'skin_minor_wound', 'other', 'none',
]);

const sessionKey = text(response.session_id, 120);

return [{
  json: {
    // The session key is already an opaque id minted by the touchscreen; it is
    // never a person. Anything unusable becomes a fixed marker rather than
    // being passed through, so a stray character can never break the insert.
    session_key: /^[A-Za-z0-9_-]{6,120}$/.test(sessionKey) ? sessionKey : 'session_invalid',
    country_code: /^[A-Z]{2}$/.test(text(state.country_code, 2)) ? text(state.country_code, 2) : 'DE',
    language_code: oneOf(state.language_code, LANGUAGES, 'en'),
    pathway_code: oneOf(state.pathway_code, PATHWAYS, 'none'),
    age_band: ageBand(state.age_years),
    duration_code: oneOf(state.duration_code, DURATIONS, 'unknown'),
    severity: oneOf(state.severity, SEVERITIES, 'unknown'),
    outcome: oneOf(response.outcome, OUTCOMES, 'NO_SUITABLE_PRODUCT'),
    reasons: (Array.isArray(response.reason_codes) ? response.reason_codes : [])
      .map(reason => text(reason, 60))
      .filter(Boolean)
      .join(',')
      .slice(0, 500),
    turns: wholeNumber(response.turns, 0, 40, 0),
    elapsed_ms: wholeNumber(response.elapsed_ms, 0, 86400000, 0),
  },
}];
