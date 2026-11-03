// Maps a spoken or typed transcript onto the fixed answer values of the screen the
// kiosk is showing. Runs on the kiosk's own Node server, never inside the n8n
// decision path: the workflow still receives ordinary option values, and this
// module only ever returns a value the current screen already offers.

export const UNDERSTAND_QUESTIONS = new Set([
  'symptom',
  'age',
  'duration',
  'severity',
  'warning_signs',
  'pregnancy_breastfeeding',
  'allergy_status',
  'allergy_terms',
  'medication_status',
  'medication_terms',
  'condition_status',
  'condition_terms',
  'confirm',
]);

const LIMITS = {
  transcriptChars: 500,
  titleChars: 200,
  optionCount: 12,
  optionValueChars: 40,
  optionLabelChars: 120,
  terms: 12,
  termChars: 60,
  answerChars: 300,
};

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeText(value, limit) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

export function readProviderConfig(env = {}) {
  const requested = String(env.PILLPAL_AI_PROVIDER || 'off').trim().toLowerCase();
  const timeoutMs = positiveNumber(env.PILLPAL_AI_TIMEOUT_MS) || 10000;
  const configuredConfidence = Number(env.PILLPAL_AI_MIN_CONFIDENCE);
  const minConfidence = Number.isFinite(configuredConfidence)
    ? Math.min(Math.max(configuredConfidence, 0), 1)
    : 0.6;

  if (requested === 'ollama') {
    return {
      provider: 'ollama',
      usable: true,
      timeoutMs,
      minConfidence,
      model: normalizeText(env.OLLAMA_MODEL || 'gemma3:1b', 80),
      baseUrl: String(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/+$/, ''),
    };
  }

  if (requested === 'gemini') {
    const apiKey = String(env.GEMINI_API_KEY || '').trim();
    return {
      provider: apiKey ? 'gemini' : 'off',
      usable: Boolean(apiKey),
      note: apiKey ? null : 'missing_api_key',
      timeoutMs,
      minConfidence,
      model: normalizeText(env.GEMINI_MODEL || 'gemini-2.5-flash-lite', 80),
      baseUrl: String(env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta')
        .trim()
        .replace(/\/+$/, ''),
      apiKey,
    };
  }

  return {
    provider: 'off',
    usable: false,
    note: requested === 'off' ? null : 'unknown_provider',
    timeoutMs,
    minConfidence,
    model: null,
    baseUrl: null,
  };
}

export function statusPayload(config) {
  return {
    available: Boolean(config.usable),
    provider: config.provider,
    model: config.provider === 'off' ? null : config.model,
    min_confidence: config.minConfidence,
    timeout_ms: config.timeoutMs,
    note: config.note || null,
  };
}

export function sanitizeRequest(payload, config) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const questionId = normalizeText(source.question_id, 40);
  if (!UNDERSTAND_QUESTIONS.has(questionId)) return { ok: false, error: 'Unsupported question.' };

  const transcript = normalizeText(source.transcript, LIMITS.transcriptChars);
  if (transcript.length < 2) return { ok: false, error: 'A non-empty transcript is required.' };

  const type = normalizeText(source.type, 30);
  if (!['single_select', 'confirmation', 'number', 'text'].includes(type)) {
    return { ok: false, error: 'Unsupported answer type.' };
  }

  const options = Array.isArray(source.options)
    ? source.options
      .slice(0, LIMITS.optionCount)
      .map(option => ({
        value: normalizeText(option?.value, LIMITS.optionValueChars),
        label: normalizeText(option?.label, LIMITS.optionLabelChars),
      }))
      .filter(option => option.value)
    : [];
  if ((type === 'single_select' || type === 'confirmation') && !options.length) {
    return { ok: false, error: 'The screen options are missing.' };
  }

  const minimum = Number.isFinite(Number(source.minimum)) ? Number(source.minimum) : 0;
  const maximum = Number.isFinite(Number(source.maximum)) ? Number(source.maximum) : 120;

  return {
    ok: true,
    context: {
      questionId,
      type,
      options,
      transcript,
      language: normalizeText(source.language, 12) || 'en',
      title: normalizeText(source.title, LIMITS.titleChars),
      minimum: type === 'number' ? minimum : 0,
      maximum: type === 'number' ? maximum : 120,
      minConfidence: config.minConfidence,
    },
  };
}

const SYSTEM_PROMPT = [
  'You read an answer spoken out loud to a pharmacy self-service kiosk and map it to the fixed answer values of the question currently on screen.',
  'Rules:',
  '- Reply with a single JSON object and nothing else.',
  '- "value" must be copied exactly from the allowed values for this question. Never invent a value and never invent a medicine.',
  '- The customer may answer in any language, in dialect, or mixing languages. Map the meaning, not the literal words.',
  '- If the answer is unclear, silent, off-topic, a question back to the kiosk, or fits more than one allowed value, reply {"value":"unknown","confidence":0}.',
  '- If the customer asks the kiosk for medical advice or for a medicine, reply {"value":"unknown","confidence":0}.',
  '- Never guess on their behalf. An honest "unknown" lets the kiosk ask the question again.',
  '- "confidence" is a number between 0 and 1 for how sure you are that "value" is what this customer meant.',
  'Examples:',
  '- "no none of that" on a yes/no safety question -> {"value":"no","confidence":0.97}',
  '- "wa bash n-3ref m3a kolchi, men nhar l-bareh" (fever since yesterday) on a duration question -> {"value":"1_to_2_days","confidence":0.8}',
  '- "ich habe heute Morgen angefangen" on a duration question -> {"value":"today","confidence":0.9}',
  '- "welche Tablette ist besser fuer mich?" -> {"value":"unknown","confidence":0}',
].join('\n');

function describeAllowed(context) {
  if (context.type === 'number') {
    return `Allowed answer: a whole number between ${context.minimum} and ${context.maximum}. Put the number in "value" as digits, for example {"value":"34","confidence":0.9}.`;
  }
  if (context.type === 'text') {
    return [
      'Allowed answer: the names the customer listed, separated by commas, written the way they are normally spelled.',
      'Keep only the names of medicines, ingredients or health conditions. Do not add anything the customer did not say.',
      'Example: "sui tablet b paracetamol w ibuprofen" -> {"value":"paracetamol, ibuprofen","confidence":0.85}.',
    ].join(' ');
  }
  const lines = context.options.map(option => `- "${option.value}" means "${option.label || option.value}"`);
  return ['Allowed values (copy one exactly into "value"):'].concat(lines).join('\n');
}

export function buildMessages(context) {
  const user = [
    `Question on screen: ${context.title || context.questionId}`,
    describeAllowed(context),
    `The customer said this (language hint: ${context.language}):`,
    `"${context.transcript}"`,
    'Reply with the JSON object now.',
  ].join('\n\n');
  return { system: SYSTEM_PROMPT, user };
}

export function buildCall(config, context) {
  const messages = buildMessages(context);
  if (config.provider === 'ollama') {
    return {
      provider: 'ollama',
      url: `${config.baseUrl}/api/chat`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: config.model,
        stream: false,
        format: 'json',
        options: { temperature: 0, top_p: 0, num_predict: 60, seed: 7 },
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user },
        ],
      },
    };
  }
  return {
    provider: 'gemini',
    url: `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    body: {
      systemInstruction: { parts: [{ text: messages.system }] },
      contents: [{ role: 'user', parts: [{ text: messages.user }] }],
      generationConfig: {
        temperature: 0,
        topP: 0,
        maxOutputTokens: 64,
        responseMimeType: 'application/json',
      },
    },
  };
}

export function extractModelText(provider, json) {
  if (provider === 'ollama') return String(json?.message?.content ?? '');
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(part => (typeof part?.text === 'string' ? part.text : '')).join('');
}

function parseJsonObject(text) {
  const cleaned = String(text ?? '')
    .replace(/```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function reject(reason, confidence = 0) {
  return { matched: false, value: null, label: null, confidence, reason };
}

const NEGATION_ONLY = /^(no|none|nothing|not any|nein|keine|nichts|la|walo|rien)(\s+(at all|really|all of them|of them|medicines?|allerg(y|ies)|dinge))?$/i;

function extractTerms(value) {
  const seen = [];
  for (const raw of String(value ?? '').split(/[,;\n]/)) {
    const term = normalizeText(raw.replace(/^(and|au|und|wa|u|et)\s+/i, ''), LIMITS.termChars);
    if (!term || NEGATION_ONLY.test(term)) continue;
    if (!seen.some(existing => existing.toLowerCase() === term.toLowerCase())) seen.push(term);
    if (seen.length >= LIMITS.terms) break;
  }
  return seen;
}

export function validateModelAnswer(modelText, context) {
  const parsed = parseJsonObject(modelText);
  if (!parsed) return reject('unparseable');

  const rawConfidence = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 1) : 0;
  if (confidence < context.minConfidence) return reject('low_confidence', confidence);

  const answer = normalizeText(parsed.value, LIMITS.answerChars);
  if (!answer || answer.toLowerCase() === 'unknown' || answer.toLowerCase() === 'none') {
    return reject('not_answered', confidence);
  }

  if (context.type === 'number') {
    const digits = answer.match(/\d{1,3}/);
    if (!digits) return reject('no_number', confidence);
    const number = Number(digits[0]);
    if (!Number.isInteger(number) || number < context.minimum || number > context.maximum) {
      return reject('out_of_range', confidence);
    }
    return { matched: true, value: number, label: String(number), confidence, reason: null };
  }

  if (context.type === 'text') {
    if (/[<>&]/.test(answer)) return reject('value_not_allowed', confidence);
    const terms = extractTerms(answer);
    if (!terms.length) return reject('no_terms', confidence);
    const value = terms.join(', ').slice(0, LIMITS.answerChars);
    return { matched: true, value, label: value, confidence, reason: null };
  }

  const wanted = answer.toLowerCase();
  const option = context.options.find(candidate => candidate.value.toLowerCase() === wanted)
    || context.options.find(candidate => (candidate.label || '').toLowerCase() === wanted)
    || context.options.find(candidate => candidate.value.toLowerCase() === wanted.replace(/\s+/g, '_'));

  if (!option) return reject('value_not_allowed', confidence);
  return { matched: true, value: option.value, label: option.label || option.value, confidence, reason: null };
}
