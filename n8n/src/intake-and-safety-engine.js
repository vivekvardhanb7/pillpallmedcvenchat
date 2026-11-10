/**
 * PILLPAL MedAssist - deterministic intake and safety engine.
 * n8n Code node: Run Once for All Items.
 *
 * The browser sends the state returned by the previous response. This code
 * validates every field again and never trusts arbitrary client state.
 */

const rawItem = $input.first().json || {};

function parsePayload(value) {
  let body = value && Object.prototype.hasOwnProperty.call(value, 'body') ? value.body : value;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function cleanText(value, maxLength = 240) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalize(value) {
  return cleanText(value, 300)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function cleanList(value, limit = 12) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,;\n]/);
  return [...new Set(list.map(v => cleanText(v, 90)).filter(Boolean))].slice(0, limit);
}

function uncertainHistoryAnswer(value) {
  const text = normalize(Array.isArray(value) ? value.join(' ') : value)
    .replace(/ß/g, 'ss').replace(/[’']/g, '');
  return /\b(not sure|unsure|dont know|do not know|unknown|cannot remember|cant remember|nicht sicher|unsicher|weiss(?: ich)? nicht|kenne(?: ich)? nicht)\b/.test(text)
    || /\b(?:kenne|weiss)(?:\s+\w+){0,4}\s+nicht\b/.test(text);
}

function sessionKey(value) {
  const candidate = cleanText(value, 80);
  if (/^[A-Za-z0-9_-]{8,80}$/.test(candidate)) return candidate;
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const PATHWAYS = [
  { value: 'pain_fever', label: 'Headache, pain or fever', icon: 'thermometer' },
  { value: 'cold_cough', label: 'Cold or cough', icon: 'lungs' },
  { value: 'allergy', label: 'Allergy', icon: 'allergy' },
  { value: 'diarrhoea', label: 'Diarrhoea', icon: 'stomach' },
  { value: 'heartburn', label: 'Heartburn or stomach discomfort', icon: 'digestive' },
  { value: 'skin_minor_wound', label: 'Skin or minor wound', icon: 'bandage' },
  { value: 'other', label: 'Other symptom', icon: 'chat' },
];

const PATHWAY_CODES = new Set(PATHWAYS.map(p => p.value));

// Declared clinical scope of this machine. Every category stays on the menu so a
// customer can state their problem and the outcome log records what was asked
// for, but anything outside this set is refused on the first tap instead of
// running a full interview that cannot end in a recommendation. Widen this only
// together with clinical and legal sign-off on approved products for the
// pathway, and never because a product row was flipped to enabled.
const SUPPORTED_PATHWAYS = new Set(['pain_fever']);

// The reserved demo country exercises every declared pathway against synthetic
// products, so a demonstration can show the whole flow. A real country never
// gets this: its scope stays exactly what has been signed off.
const DEMO_COUNTRY_CODE = 'ZZ';
const DEMO_PATHWAYS = new Set(PATHWAYS.map(p => p.value).filter(code => code !== 'other'));

function pathwaysInScopeFor(countryCode) {
  return countryCode === DEMO_COUNTRY_CODE ? DEMO_PATHWAYS : SUPPORTED_PATHWAYS;
}

const GENERIC_RED_FLAGS = [
  'trouble breathing, chest pressure, fainting, confusion, significant bleeding, a sudden extreme symptom, or being unable to keep fluids down',
];

// Alarm features a pharmacist screens before recommending any analgesic or
// antipyretic. Fever and headache have a different danger profile from the
// generic list, and missing meningitis or sepsis features is the failure that
// matters here.
const RED_FLAGS_BY_PATHWAY = {
  pain_fever: [
    'stiff neck with sensitivity to light, or a rash that does not fade when you press a glass on it',
    'confusion, fainting, or difficulty staying awake',
    'trouble breathing, chest pain or pressure',
    'a sudden severe headache unlike any you have had before',
    'fever above 39.5 C, or fever that does not come down after medicine',
    'you are immunosuppressed (chemotherapy, transplant, long-term steroids) or pregnant',
  ],
};

const DURATION_CODES = new Set(['today', '1_to_2_days', '3_to_7_days', 'more_than_7_days']);
const SEVERITY_CODES = new Set(['mild', 'moderate', 'severe']);
const PREGNANCY_CODES = new Set(['pregnant', 'breastfeeding', 'both', 'no', 'not_applicable', 'prefer_not_to_say']);
const YES_NO_UNSURE = new Set(['yes', 'no', 'not_sure']);
const BACKGROUND_CODES = new Set(['none', 'pregnancy', 'history', 'both', 'not_sure']);

function newState(countryCode, languageCode) {
  return {
    version: 1,
    country_code: countryCode,
    language_code: languageCode,
    step: 'symptom',
    pathway_code: null,
    age_years: null,
    duration_code: null,
    severity: null,
    warning_signs: null,
    warning_signs_answer: null,
    pregnancy_breastfeeding: null,
    safety_background_status: null,
    allergy_status: null,
    allergy_terms: [],
    medication_status: null,
    medication_terms: [],
    condition_status: null,
    condition_terms: [],
    confirmed: false,
    completed: false,
    turns: 0,
    started_at_ms: Date.now(),
  };
}

function sanitizeState(raw, countryCode, languageCode) {
  const state = newState(countryCode, languageCode);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;

  if (PATHWAY_CODES.has(raw.pathway_code)) state.pathway_code = raw.pathway_code;
  if (Number.isInteger(raw.age_years) && raw.age_years >= 0 && raw.age_years <= 120) state.age_years = raw.age_years;
  if (DURATION_CODES.has(raw.duration_code)) state.duration_code = raw.duration_code;
  if (SEVERITY_CODES.has(raw.severity)) state.severity = raw.severity;
  if (typeof raw.warning_signs === 'boolean') state.warning_signs = raw.warning_signs;
  if (YES_NO_UNSURE.has(raw.warning_signs_answer)) state.warning_signs_answer = raw.warning_signs_answer;
  if (PREGNANCY_CODES.has(raw.pregnancy_breastfeeding)) state.pregnancy_breastfeeding = raw.pregnancy_breastfeeding;
  if (BACKGROUND_CODES.has(raw.safety_background_status)) state.safety_background_status = raw.safety_background_status;
  if (YES_NO_UNSURE.has(raw.allergy_status)) state.allergy_status = raw.allergy_status;
  if (YES_NO_UNSURE.has(raw.medication_status)) state.medication_status = raw.medication_status;
  if (YES_NO_UNSURE.has(raw.condition_status)) state.condition_status = raw.condition_status;
  state.allergy_terms = cleanList(raw.allergy_terms);
  state.medication_terms = cleanList(raw.medication_terms);
  state.condition_terms = cleanList(raw.condition_terms);
  state.confirmed = raw.confirmed === true;
  state.completed = raw.completed === true;
  if (Number.isInteger(raw.turns) && raw.turns >= 0 && raw.turns <= 40) state.turns = raw.turns;
  if (Number.isInteger(raw.started_at_ms) && raw.started_at_ms > 0 && raw.started_at_ms <= state.started_at_ms) {
    state.started_at_ms = raw.started_at_ms;
  }

  const allowedSteps = new Set([
    'symptom', 'age', 'duration', 'severity', 'warning_signs',
    'safety_background_status', 'pregnancy_breastfeeding', 'medical_history_status', 'allergy_status', 'allergy_terms',
    'medication_status', 'medication_terms', 'condition_status',
    'condition_terms', 'confirm', 'complete',
  ]);
  if (allowedSteps.has(raw.step)) state.step = raw.step;
  return state;
}

function option(value, label, extra = {}) {
  return { value, label, ...extra };
}

function screenFor(step, error = null, pathwayCode = null) {
  const common = { question_id: step, required: true, error };
  switch (step) {
    case 'symptom':
      return {
        ...common,
        type: 'single_select',
        title: 'What would you like help with?',
        subtitle: 'Choose the closest option. This is not a diagnosis.',
        options: PATHWAYS,
      };
    case 'age':
      return {
        ...common,
        type: 'number',
        title: 'What is your age?',
        subtitle: 'Enter age in completed years.',
        minimum: 0,
        maximum: 120,
      };
    case 'duration':
      return {
        ...common,
        type: 'single_select',
        title: 'How long have you had this symptom?',
        options: [
          option('today', 'Started today'),
          option('1_to_2_days', '1–2 days'),
          option('3_to_7_days', '3–7 days'),
          option('more_than_7_days', 'More than 7 days'),
        ],
      };
    case 'severity':
      return {
        ...common,
        type: 'single_select',
        title: 'How severe is it right now?',
        options: [
          option('mild', 'Mild'),
          option('moderate', 'Moderate'),
          option('severe', 'Severe'),
        ],
      };
    case 'warning_signs': {
      const flags = RED_FLAGS_BY_PATHWAY[pathwayCode] || GENERIC_RED_FLAGS;
      return {
        ...common,
        type: 'single_select',
        title: 'Do any serious warning signs apply?',
        pathway_code: pathwayCode || null,
        red_flags: flags,
        subtitle: `Check whether any of these apply to you right now: ${flags.join('; ')}. If you are unsure, choose "I am not sure".`,
        options: [
          option('no', 'No, none of these'),
          option('yes', 'Yes, one or more'),
          option('not_sure', 'I am not sure'),
        ],
      };
    }
    case 'pregnancy_breastfeeding':
      return {
        ...common,
        type: 'single_select',
        title: 'Could pregnancy or breastfeeding apply to you?',
        options: [
          option('pregnant', 'Pregnant'),
          option('breastfeeding', 'Breastfeeding'),
          option('both', 'Both'),
          option('no', 'No'),
          option('not_applicable', 'Not applicable'),
          option('prefer_not_to_say', 'Prefer not to say'),
        ],
      };
    case 'safety_background_status':
      return {
        ...common,
        type: 'single_select',
        title: 'Do any of these apply to you: pregnancy or breastfeeding, a medicine allergy, current medicines, or an ongoing medical condition?',
        subtitle: 'Choose none only if none of these apply. Include prescription and non-prescription medicines.',
        options: [
          option('none', 'No, none of these'),
          option('pregnancy', 'Pregnancy or breastfeeding'),
          option('history', 'Allergy, medicines, or medical condition'),
          option('both', 'Both groups apply'),
          option('not_sure', 'I am not sure'),
        ],
      };
    case 'medical_history_status':
      return {
        ...common,
        type: 'single_select',
        title: 'Do you have a medicine allergy, take any medicines, or have an ongoing medical condition?',
        subtitle: 'Choose no only if none of these apply. Include prescription and non-prescription medicines.',
        options: [option('no', 'No, none of these'), option('yes', 'Yes, one or more'), option('not_sure', 'I am not sure')],
      };
    case 'allergy_status':
      return {
        ...common,
        type: 'single_select',
        title: 'Do you have any medicine allergies?',
        options: [option('no', 'No'), option('yes', 'Yes'), option('not_sure', 'Not sure')],
      };
    case 'allergy_terms':
      return {
        ...common,
        type: 'text',
        title: 'Which medicines or ingredients are you allergic to?',
        subtitle: 'Separate multiple entries with commas.',
        placeholder: 'Example: ibuprofen, aspirin',
      };
    case 'medication_status':
      return {
        ...common,
        type: 'single_select',
        title: 'Are you currently taking any medicines?',
        subtitle: 'Include prescription and non-prescription medicines.',
        options: [option('no', 'No'), option('yes', 'Yes'), option('not_sure', 'Not sure')],
      };
    case 'medication_terms':
      return {
        ...common,
        type: 'text',
        title: 'Which medicines are you taking?',
        subtitle: 'Separate multiple entries with commas.',
        placeholder: 'Enter medicine names',
      };
    case 'condition_status':
      return {
        ...common,
        type: 'single_select',
        title: 'Do you have any ongoing medical conditions?',
        options: [option('no', 'No'), option('yes', 'Yes'), option('not_sure', 'Not sure')],
      };
    case 'condition_terms':
      return {
        ...common,
        type: 'text',
        title: 'Which medical conditions do you have?',
        subtitle: 'Separate multiple entries with commas.',
        placeholder: 'Enter conditions',
      };
    case 'confirm':
      return {
        ...common,
        type: 'confirmation',
        title: 'Please confirm your answers',
        options: [option('yes', 'Confirm and check products'), option('no', 'Start again')],
      };
    default:
      return screenFor('symptom', error);
  }
}

const NOT_ASKED = 'Not asked';
const WARNING_ANSWER_LABEL = { yes: 'Reported', no: 'None reported', not_sure: 'Not sure' };

function summaryFor(state) {
  const pathway = PATHWAYS.find(p => p.value === state.pathway_code);
  const label = (value, values) => (value == null ? NOT_ASKED : values[value] || value);
  const history = (status, terms) => {
    if (status == null) return NOT_ASKED;
    return status === 'no' ? 'None reported' : terms.length ? terms : 'Not provided';
  };
  const warningSigns = WARNING_ANSWER_LABEL[state.warning_signs_answer]
    || (state.warning_signs === false ? 'None reported' : state.warning_signs === true ? 'Reported' : NOT_ASKED);
  return {
    symptom_category: pathway?.label || NOT_ASKED,
    age: state.age_years ?? NOT_ASKED,
    duration: label(state.duration_code, {
      today: 'Started today',
      '1_to_2_days': '1–2 days',
      '3_to_7_days': '3–7 days',
      more_than_7_days: 'More than 7 days',
    }),
    severity: state.severity ?? NOT_ASKED,
    warning_signs: warningSigns,
    pregnancy_or_breastfeeding: state.pregnancy_breastfeeding ?? NOT_ASKED,
    allergies: history(state.allergy_status, state.allergy_terms),
    medicines: history(state.medication_status, state.medication_terms),
    conditions: history(state.condition_status, state.condition_terms),
  };
}

function responseBase(sessionId, state) {
  return {
    api_version: '1.0',
    session_id: sessionId,
    research_mode: true,
    dispense_authorized: false,
    needs_catalog: false,
    turns: state.turns,
    elapsed_ms: Math.max(0, Date.now() - (state.started_at_ms || Date.now())),
    state,
  };
}

function questionResponse(sessionId, state, error = null) {
  return [{
    json: {
      ...responseBase(sessionId, state),
      outcome: 'MORE_INFORMATION',
      message: error || 'Please answer the next question.',
      screen: screenFor(state.step, error, state.pathway_code),
      summary: state.step === 'confirm' ? summaryFor(state) : null,
    },
  }];
}

function finalResponse(sessionId, state, outcome, message, reasonCodes) {
  state.completed = true;
  state.step = 'complete';
  return [{
    json: {
      ...responseBase(sessionId, state),
      outcome,
      message,
      reason_codes: reasonCodes,
      screen: {
        question_id: 'complete',
        type: 'result',
        title: outcome === 'IMMEDIATE_MEDICAL_CARE' ? 'Medical care is needed' : 'No automatic recommendation',
        options: [option('restart', 'Start a new assessment')],
      },
      summary: summaryFor(state),
    },
  }];
}

function nextAfterHistory(state) {
  state.step = 'confirm';
}

function referralUncertainHistory(sessionId, state) {
  return finalResponse(
    sessionId,
    state,
    'CLINIC_REFERRAL',
    'More certain allergy, medicine and health-condition information is required. Please visit a nearby clinic, doctor or pharmacy for advice.',
    ['medical_history_uncertain'],
  );
}

function evaluateBeforeCatalog(sessionId, state) {
  if (state.pathway_code === 'other') {
    return finalResponse(
      sessionId,
      state,
      'NO_SUITABLE_PRODUCT',
      'This symptom is outside the currently supported pathways. Please visit a nearby clinic, doctor or pharmacy for advice.',
      ['unsupported_pathway'],
    );
  }
  // Re-checked here as well, because a client that forges a later step must not
  // be able to reach the catalogue with a pathway this machine never assessed.
  if (!pathwaysInScopeFor(state.country_code).has(state.pathway_code)) {
    return finalResponse(
      sessionId,
      state,
      'NO_SUITABLE_PRODUCT',
      'This machine does not yet offer a supported self-care pathway for that symptom, so a pharmacist or doctor should assess it. Please visit a nearby clinic, doctor or pharmacy.',
      ['pathway_not_serviced'],
    );
  }
  if (state.warning_signs !== false) {
    return finalResponse(
      sessionId,
      state,
      'IMMEDIATE_MEDICAL_CARE',
      'This may require immediate medical attention. Please seek care at the nearest emergency department or clinic.',
      ['warning_sign_reported_or_uncertain'],
    );
  }
  if (state.severity === 'severe') {
    return finalResponse(
      sessionId,
      state,
      'CLINIC_REFERRAL',
      'This machine cannot recommend a medicine for a severe symptom. Please visit a nearby clinic or doctor.',
      ['severe_symptom'],
    );
  }
  if (state.age_years < 18) {
    return finalResponse(
      sessionId,
      state,
      'CLINIC_REFERRAL',
      'The current automated assessment is limited to adults aged 18 or older. Please visit a nearby clinic, doctor or pharmacy for advice.',
      ['under_18'],
    );
  }
  if (state.duration_code === 'more_than_7_days') {
    return finalResponse(
      sessionId,
      state,
      'CLINIC_REFERRAL',
      'The symptom has lasted longer than the current self-care pathway supports. Please visit a nearby clinic or doctor.',
      ['duration_outside_pathway'],
    );
  }
  if (!['no', 'not_applicable'].includes(state.pregnancy_breastfeeding)) {
    return finalResponse(
      sessionId,
      state,
      'CLINIC_REFERRAL',
      'This machine cannot automatically recommend a medicine during pregnancy or breastfeeding, or when this information is uncertain. Please visit a nearby clinic, doctor or pharmacy for advice.',
      ['pregnancy_breastfeeding_or_uncertain'],
    );
  }
  if ([state.allergy_status, state.medication_status, state.condition_status].includes('not_sure')) {
    return referralUncertainHistory(sessionId, state);
  }

  state.completed = true;
  state.step = 'complete';
  return [{
    json: {
      ...responseBase(sessionId, state),
      outcome: 'CATALOG_CHECK_REQUIRED',
      message: 'Safety intake completed. Checking the approved product catalogue.',
      reason_codes: [],
      needs_catalog: true,
      pathway_code: state.pathway_code,
      screen: null,
      summary: summaryFor(state),
    },
  }];
}

const payload = parsePayload(rawItem);
const countryCode = /^[A-Z]{2}$/.test(payload.country_code) ? payload.country_code : 'DE';
const languageCode = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(payload.language_code) ? payload.language_code : 'de';
const id = sessionKey(payload.session_id);
const reset = payload.reset === true || payload.answer?.value === 'restart';
const state = reset ? newState(countryCode, languageCode) : sanitizeState(payload.state, countryCode, languageCode);
const answer = payload.answer && typeof payload.answer === 'object' ? payload.answer : {};
const questionId = cleanText(answer.question_id, 60);
const value = answer.value;

if (reset || !payload.state) return questionResponse(id, state);
if (state.completed) return questionResponse(id, newState(countryCode, languageCode));
if (state.turns >= 30) {
  return finalResponse(id, state, 'CLINIC_REFERRAL', 'The assessment session limit was reached. Please visit a nearby clinic, doctor or pharmacy for advice.', ['session_limit']);
}

if (questionId !== state.step) {
  return questionResponse(id, state, 'That answer does not match the current question. Please try again.');
}

state.turns += 1;

switch (state.step) {
  case 'symptom': {
    const selected = cleanText(value, 60);
    if (!PATHWAY_CODES.has(selected)) return questionResponse(id, state, 'Please choose one of the available symptom categories.');
    state.pathway_code = selected;
    if (selected === 'other') {
      return finalResponse(
        id,
        state,
        'NO_SUITABLE_PRODUCT',
        'This symptom is outside the currently supported pathways. Please visit a nearby clinic, doctor or pharmacy for advice.',
        ['unsupported_pathway'],
      );
    }
    if (!pathwaysInScopeFor(countryCode).has(selected)) {
      return finalResponse(
        id,
        state,
        'NO_SUITABLE_PRODUCT',
        'This machine does not yet offer a supported self-care pathway for that symptom, so a pharmacist or doctor should assess it. Please visit a nearby clinic, doctor or pharmacy.',
        ['pathway_not_serviced'],
      );
    }
    state.step = 'age';
    return questionResponse(id, state);
  }
  case 'age': {
    const age = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(age) || age < 0 || age > 120) return questionResponse(id, state, 'Enter an age from 0 to 120.');
    state.age_years = age;
    if (age < 18) {
      return finalResponse(
        id,
        state,
        'CLINIC_REFERRAL',
        'The current automated assessment is limited to adults aged 18 or older. Please visit a nearby clinic, doctor or pharmacy for advice.',
        ['under_18'],
      );
    }
    state.step = 'duration';
    return questionResponse(id, state);
  }
  case 'duration': {
    const selected = cleanText(value, 40);
    if (!DURATION_CODES.has(selected)) return questionResponse(id, state, 'Please choose a duration.');
    state.duration_code = selected;
    if (selected === 'more_than_7_days') {
      return finalResponse(
        id,
        state,
        'CLINIC_REFERRAL',
        'The symptom has lasted longer than the current self-care pathway supports. Please visit a nearby clinic or doctor.',
        ['duration_outside_pathway'],
      );
    }
    state.step = 'severity';
    return questionResponse(id, state);
  }
  case 'severity': {
    const selected = cleanText(value, 30);
    if (!SEVERITY_CODES.has(selected)) return questionResponse(id, state, 'Please choose mild, moderate or severe.');
    state.severity = selected;
    if (selected === 'severe') {
      return finalResponse(
        id,
        state,
        'CLINIC_REFERRAL',
        'This machine cannot recommend a medicine for a severe symptom. Please visit a nearby clinic or doctor.',
        ['severe_symptom'],
      );
    }
    state.step = 'warning_signs';
    return questionResponse(id, state);
  }
  case 'warning_signs': {
    const selected = cleanText(value, 30);
    if (!['yes', 'no', 'not_sure'].includes(selected)) return questionResponse(id, state, 'Please choose yes, no or not sure.');
    state.warning_signs_answer = selected;
    if (selected !== 'no') {
      state.warning_signs = selected === 'yes';
      return finalResponse(
        id,
        state,
        'IMMEDIATE_MEDICAL_CARE',
        'This may require immediate medical attention. Please seek care at the nearest emergency department or clinic.',
        [selected === 'yes' ? 'warning_sign_reported' : 'warning_sign_uncertain'],
      );
    }
    state.warning_signs = false;
    state.step = 'safety_background_status';
    return questionResponse(id, state);
  }
  case 'safety_background_status': {
    const selected = cleanText(value, 30);
    if (!BACKGROUND_CODES.has(selected)) return questionResponse(id, state, 'Please choose one of the available options.');
    state.safety_background_status = selected;
    if (selected === 'pregnancy' || selected === 'both') {
      state.pregnancy_breastfeeding = 'prefer_not_to_say';
      return finalResponse(
        id,
        state,
        'CLINIC_REFERRAL',
        'This machine cannot automatically recommend a medicine during pregnancy or breastfeeding. Please visit a nearby clinic, doctor or pharmacy for advice.',
        ['pregnancy_breastfeeding_or_uncertain'],
      );
    }
    if (selected === 'not_sure') {
      state.pregnancy_breastfeeding = 'prefer_not_to_say';
      return finalResponse(
        id,
        state,
        'CLINIC_REFERRAL',
        'More certain pregnancy, breastfeeding, allergy, medicine and health-condition information is required. Please visit a nearby clinic, doctor or pharmacy for advice.',
        ['pregnancy_breastfeeding_or_uncertain', 'medical_history_uncertain'],
      );
    }
    state.pregnancy_breastfeeding = 'not_applicable';
    if (selected === 'none') {
      state.allergy_status = 'no';
      state.medication_status = 'no';
      state.condition_status = 'no';
      nextAfterHistory(state);
      return questionResponse(id, state);
    }
    state.step = 'allergy_status';
    return questionResponse(id, state);
  }
  case 'pregnancy_breastfeeding': {
    const selected = cleanText(value, 40);
    if (!PREGNANCY_CODES.has(selected)) return questionResponse(id, state, 'Please choose one of the available options.');
    state.pregnancy_breastfeeding = selected;
    if (!['no', 'not_applicable'].includes(selected)) {
      return finalResponse(
        id,
        state,
        'CLINIC_REFERRAL',
        'This machine cannot automatically recommend a medicine during pregnancy or breastfeeding, or when this information is uncertain. Please visit a nearby clinic, doctor or pharmacy for advice.',
        ['pregnancy_breastfeeding_or_uncertain'],
      );
    }
    state.step = 'medical_history_status';
    return questionResponse(id, state);
  }
  case 'medical_history_status': {
    const selected = cleanText(value, 20);
    if (!YES_NO_UNSURE.has(selected)) return questionResponse(id, state, 'Please choose yes, no or not sure.');
    if (selected === 'not_sure') return referralUncertainHistory(id, state);
    if (selected === 'no') {
      state.allergy_status = 'no';
      state.medication_status = 'no';
      state.condition_status = 'no';
      nextAfterHistory(state);
      return questionResponse(id, state);
    }
    state.step = 'allergy_status';
    return questionResponse(id, state);
  }
  case 'allergy_status': {
    const selected = cleanText(value, 20);
    if (!YES_NO_UNSURE.has(selected)) return questionResponse(id, state, 'Please choose yes, no or not sure.');
    state.allergy_status = selected;
    if (selected === 'not_sure') return referralUncertainHistory(id, state);
    state.step = selected === 'yes' ? 'allergy_terms' : 'medication_status';
    return questionResponse(id, state);
  }
  case 'allergy_terms': {
    if (uncertainHistoryAnswer(value)) {
      state.allergy_status = 'not_sure';
      return referralUncertainHistory(id, state);
    }
    const terms = cleanList(value);
    if (!terms.length) return questionResponse(id, state, 'Enter at least one medicine or ingredient allergy.');
    state.allergy_terms = terms;
    state.step = 'medication_status';
    return questionResponse(id, state);
  }
  case 'medication_status': {
    const selected = cleanText(value, 20);
    if (!YES_NO_UNSURE.has(selected)) return questionResponse(id, state, 'Please choose yes, no or not sure.');
    state.medication_status = selected;
    if (selected === 'not_sure') return referralUncertainHistory(id, state);
    state.step = selected === 'yes' ? 'medication_terms' : 'condition_status';
    return questionResponse(id, state);
  }
  case 'medication_terms': {
    if (uncertainHistoryAnswer(value)) {
      state.medication_status = 'not_sure';
      return referralUncertainHistory(id, state);
    }
    const terms = cleanList(value);
    if (!terms.length) return questionResponse(id, state, 'Enter at least one current medicine.');
    state.medication_terms = terms;
    state.step = 'condition_status';
    return questionResponse(id, state);
  }
  case 'condition_status': {
    const selected = cleanText(value, 20);
    if (!YES_NO_UNSURE.has(selected)) return questionResponse(id, state, 'Please choose yes, no or not sure.');
    state.condition_status = selected;
    if (selected === 'not_sure') return referralUncertainHistory(id, state);
    if (selected === 'yes') state.step = 'condition_terms';
    else nextAfterHistory(state);
    return questionResponse(id, state);
  }
  case 'condition_terms': {
    if (uncertainHistoryAnswer(value)) {
      state.condition_status = 'not_sure';
      return referralUncertainHistory(id, state);
    }
    const terms = cleanList(value);
    if (!terms.length) return questionResponse(id, state, 'Enter at least one medical condition.');
    state.condition_terms = terms;
    nextAfterHistory(state);
    return questionResponse(id, state);
  }
  case 'confirm': {
    const selected = normalize(value);
    if (selected === 'no') return questionResponse(id, newState(countryCode, languageCode));
    if (selected !== 'yes') return questionResponse(id, state, 'Please confirm your answers or start again.');
    state.confirmed = true;
    return evaluateBeforeCatalog(id, state);
  }
  default:
    return questionResponse(id, newState(countryCode, languageCode));
}

