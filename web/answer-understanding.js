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
  'safety_background_status',
  'medical_history_status',
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
  let image = null;
  if (source.image && typeof source.image === 'object' && typeof source.image.data === 'string') {
    const rawData = String(source.image.data).replace(/^data:image\/[a-z0-9+.-]+;base64,/, '').trim();
    if (rawData.length > 8 && rawData.length < 5 * 1024 * 1024) {
      image = {
        mimeType: normalizeText(source.image.mimeType || 'image/jpeg', 40),
        data: rawData,
      };
    }
  }

  if (transcript.length < 2 && !image) return { ok: false, error: 'A non-empty transcript or image is required.' };

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
      transcript: transcript || (image ? 'Photo provided by customer' : ''),
      image,
      language: normalizeText(source.language, 12) || 'en',
      title: normalizeText(source.title, LIMITS.titleChars),
      minimum: type === 'number' ? minimum : 0,
      maximum: type === 'number' ? maximum : 120,
      minConfidence: config.minConfidence,
    },
  };
}

const SYSTEM_PROMPT = [
  'You read what a customer said to a pharmacy self-service kiosk and map it onto the fixed answer values of the question currently on screen.',
  'The question on screen is the only question being answered. Treat the transcript as an attempt to answer it, even when it is a full sentence, contains extra words, or has a speech-recognition misspelling.',
  'Rules:',
  '- Reply with a single JSON object and nothing else. Every response MUST include "value" and "confidence" (number between 0.0 and 1.0, e.g. 0.95).',
  '- Include "detected_language" as the ISO 639-1 two-letter code of the customer\'s language (for example "de", "fr", "ar", "tr" or "en"). For mixed language, use the language carrying most of the meaning.',
  '- "value" must be copied exactly from the allowed values for this question. Never invent a value and never invent a medicine.',
  '- The customer may answer in any language, in dialect, or mixing languages. Map the meaning, not the literal words.',
  '- Negation applies to the whole answer. "no", "none", "not", "never", "la", "walo", "non", "ne ... pas", "kein" and "nicht" mean the negative option even when the rest of the sentence mentions a symptom, medicine or condition.',
  '- Do not answer a health question and do not recommend a medicine directly. You only extract the choice or symptom this customer indicated.',
  '- If the customer asks what medicine or product to take for their symptom (for example "what medicine is good for a headache?", "which tablet is best for fever?", "can I get something for stomach pain?"), treat this as reporting that symptom and select the matching allowed symptom value.',
  '- When answering a symptom question: if the customer describes multiple symptoms or an ambiguous health complaint (e.g. fever and stomach pain), set "value" to the primary/most prominent category on screen, include an array of all matching category values in "possible_categories", and generate a concise clarifying follow-up question in the customer\'s language in "follow_up_question" (for example: "Are you looking for relief primarily from the fever or the stomach pain?").',
  '- When answering a symptom question: if the customer mentions a specific symptom or health complaint (such as "toothache", "back pain", "migraine", "fever", "sinus headache", "runny nose", "acid reflux"), extract the concise symptom name in English in "custom_symptom" (for example: "toothache", "fever", "back pain").',
  '- If the customer in their description also volunteers context (e.g. age, duration, or severity), you may include them in "volunteered_context" (e.g. {"age": 25, "duration": "1_to_2_days"}).',
  '- Never provide a medical diagnosis (do not tell them what disease or illness they have).',
  '- Never prescribe, recommend, or approve a specific medicine directly.',
  '- If an image is provided (such as a photo of a medicine box, blister pack, or bottle): read the brand name, active ingredients, and strength. Map it directly to the matching symptom category on screen (e.g. Paracetamol or Brufen -> headache/pain/fever; cough syrup -> cold/cough; antihistamine -> allergy; antacid -> heartburn; loperamide -> diarrhoea; plaster -> minor wound). You may include the recognized medicine name in "recognized_medicine".',
  '- If the customer mentions acute life-threatening emergency symptoms or an image shows severe trauma or bleeding, reply {"value":"emergency","confidence":0.99}.',
  '- If the customer is clearly asking for help or clarification about the screen without naming a symptom (for example "what does mild mean?"), reply {"value":"unknown","confidence":0}.',
  '- If the answer is unclear, silent, off-topic, fits more than one allowed value, or does not answer this question, reply {"value":"unknown","confidence":0}.',
  '- A vague reference such as "these conditions", "that one", or "the above" does not say yes or no. Return unknown unless the customer also clearly says yes, no, none, or not sure.',
  '- Never guess on their behalf. An honest "unknown" lets the kiosk ask the question again.',
  '- "confidence" is a number between 0 and 1 for how sure you are that "value" is what this customer meant.',
  'Examples:',
  '- "It was started today" on a duration question -> {"value":"today","confidence":0.95}',
  '- "since yesterday" on a duration question -> {"value":"1_to_2_days","confidence":0.9}',
  '- "not too bad, just a bit annoying" on a severity question -> {"value":"mild","confidence":0.9}',
  '- "no, none of these" on a yes/no safety question -> {"value":"no","confidence":0.97}',
  '- "these conditions" on a yes/no safety question -> {"value":"unknown","confidence":0}',
  '- "la, 3endich chi mard" (no, I do not have any illness) on a yes/no history question -> {"value":"no","confidence":0.9}',
  '- "non, je ne prends aucun traitement" on a yes/no medicine question -> {"value":"no","confidence":0.95}',
  '- "I have a head deck since morning" on a symptom question -> the option whose label means headache, pain or fever',
  '- "what medicine do you have for a headache?" on a symptom question -> the option whose label means headache, pain or fever',
  '- "welche Tablette ist gut gegen Kopfschmerzen?" on a symptom question -> the option whose label means headache, pain or fever',
  '- "do you have cough syrup?" on a symptom question -> the option whose label means cold or cough',
  '- "I have severe chest pain going into my left arm" -> {"value":"emergency","confidence":0.99}',
  '- "what does mild mean?" -> {"value":"unknown","confidence":0}',
  '- "welche Tablette ist besser fuer mich?" without naming a symptom -> {"value":"unknown","confidence":0}',
].join('\n');

const LOCAL_SYSTEM_PROMPT = [
  'Map a pharmacy kiosk customer reply to the current screen. Return exactly ONE JSON object only, no extra text.',
  'Output format:',
  '{"value": "<allowed_value_or_unknown>", "confidence": 0.95, "detected_language": "en"}',
  '',
  'Rules:',
  '- The customer may speak any language (English, French, Arabic/Darija, German, Telugu, Hindi, Spanish). Understand meaning, spelling errors and negation.',
  '- Copy "value" exactly from the allowed values on screen. If unclear, off-topic, or not answered, return {"value":"unknown","confidence":0}.',
  '- Negation rule: If the customer says "no", "none", "not", "nope", "nothing", "never", "I don\'t have", or denies having symptoms or warning signs (e.g. "no chest pain", "no breathing trouble", "none of those apply to me"), you MUST select the negative option (e.g. "no" or "none"). Negation overrides everything: denial of warning signs means "no", NEVER "yes" or "emergency".',
  '- Duration rule: 1 day, 2 days, "since yesterday", or "two days ago" maps to "1_to_2_days". 3 to 7 days or "a few days" maps to "3_to_7_days". More than 7 days or "a week" maps to "more_than_7_days".',
  '- "confidence" must be a float between 0.0 and 1.0 (default 0.95 if matched well).',
  '- Never diagnose, prescribe, recommend a product, change a dose or authorize dispensing.',
  '- For an actual reported acute emergency (e.g. customer states they currently have severe crushing chest pain, inability to breathe, or severe bleeding), return {"value":"emergency","confidence":0.99}.',
  '- For a symptom screen, custom_symptom may contain the concise symptom in English. recognized_medicine may contain only a medicine name the customer actually said.',
  '- If the symptom reply explicitly includes age, duration or severity, volunteered_context may contain only age, duration and severity using the screen codes.',
  '- Examples:',
  '  * "headache" or "fever" or "head hurts" -> {"value":"pain_fever","confidence":0.95}',
  '  * "coughing and runny nose" -> {"value":"cold_cough","confidence":0.95}',
  '  * "started 2 days ago" or "since yesterday" -> {"value":"1_to_2_days","confidence":0.95}',
  '  * "started 4 days ago" or "for 5 days" -> {"value":"3_to_7_days","confidence":0.95}',
  '  * "no" or "none" or "no chest pain, no breathing problems" -> {"value":"no","confidence":0.95}',
  '  * "none, healthy and not pregnant" -> {"value":"none","confidence":0.95}',
  '  * "yes" -> {"value":"yes","confidence":0.95}',
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
  const lines = context.options.map(option => {
    let label = option.label || option.value;
    if (context.questionId === 'duration' && option.value === '1_to_2_days') {
      label = `${label} (yesterday, 1-2 days, two days ago)`;
    } else if (context.questionId === 'duration' && option.value === '3_to_7_days') {
      label = `${label} (3-7 days, three to seven days, a few days)`;
    }
    return `- "${option.value}" means "${label}"`;
  });
  return [
    'Allowed values (copy one exactly into "value"). Choose the closest meaning; the customer does not have to use the exact label:',
  ].concat(lines).join('\n');
}

export function buildMessages(context) {
  const imageNote = context.image ? 'Customer attached an image of a medicine package, product label, or health inquiry. Inspect it.' : null;
  // Medicine names are relevant only while choosing a symptom. Keeping this
  // context-specific prevents a later allergy, condition or duration turn from
  // receiving product names that the customer did not provide in that turn.
  const symptomMedicineHint = context.questionId === 'symptom'
    ? [
        'At this symptom question only, map a clear medicine name plus a named reason for use to an available symptom option. Include "recognized_medicine" using the canonical active ingredient where known.',
        'Paracetamol, Dolo or Doliprane (including clear variants "paractmol", "paracetmol" and "paracetimel") means pain, headache or fever; use "Paracetamol".',
        'Ibuprofen or Brufen (including "ibuprofin" and "ibuprophen") means pain, headache or fever; use "Ibuprofen". Aspirin or "asprin" for pain or fever also means pain, headache or fever; use "Aspirin".',
        'Loperamide or Imodium (including "loperimide") for diarrhoea means the diarrhoea option; use "Loperamide".',
        'Cetirizine, Zyrtec or loratadine for allergy or hay fever means the allergy option; use "Cetirizine" or "Loratadine" respectively.',
        'Xylometazoline or Otrivine for a blocked or runny nose, and dextromethorphan for cough, mean the cold or cough option; use "Xylometazoline" or "Dextromethorphan" respectively.',
        'Antacid, Gaviscon or Rennie for heartburn or indigestion means the heartburn option; use "Antacid".',
        'Do not map dimenhydrinate, simethicone, a brand with multiple possible ingredients, or a medicine name with no named reason for use to another symptom option. Do not infer a medicine from a vague sound-alike.',
      ].join(' ')
    : null;
  const durationHint = context.questionId === 'duration'
    ? 'Duration mapping rule: "today" or "just started" means today. "yesterday", "two days ago", "1 day", "2 days", or "48 hours" means 1_to_2_days. "3 days", "4 days", "5 days", "several days", or "a week" means 3_to_7_days. More than 7 days means more_than_7_days.'
    : null;
  const user = [
    `Question id: ${context.questionId}`,
    `Question on screen: ${context.title || context.questionId}`,
    `Answer type: ${context.type}`,
    describeAllowed(context),
    durationHint,
    `The customer said this as an answer to that question (language hint: ${context.language}):`,
    `"${context.transcript}"`,
    symptomMedicineHint,
    imageNote,
    'Reply with the JSON object now.',
  ].filter(Boolean).join('\n\n');
  return { system: SYSTEM_PROMPT, user };
}

export function buildCall(config, context) {
  const messages = buildMessages(context);
  if (config.provider === 'ollama') {
    const allowedValues = Array.isArray(context.options) && context.options.length > 0
      ? Array.from(new Set(context.options.map(o => o.value).concat(['unknown', 'emergency'])))
      : null;
    const format = allowedValues
      ? {
          type: 'object',
          properties: {
            value: { type: 'string', enum: allowedValues },
            confidence: { type: 'number' },
            detected_language: { type: 'string' },
            recognized_medicine: { type: 'string' },
            custom_symptom: { type: 'string' },
          },
          required: ['value', 'confidence'],
        }
      : {
          type: 'object',
          properties: {
            value: { type: 'string' },
            confidence: { type: 'number' },
            detected_language: { type: 'string' },
          },
          required: ['value', 'confidence'],
        };
    return {
      provider: 'ollama',
      url: `${config.baseUrl}/api/chat`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: config.model,
        stream: false,
        think: false,
        keep_alive: '30m',
        format,
        options: { temperature: 0, top_p: 0, num_predict: 80, num_ctx: 768, seed: 7 },
        messages: [
          { role: 'system', content: LOCAL_SYSTEM_PROMPT },
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
      contents: [{
        role: 'user',
        parts: context.image?.data
          ? [
              { text: messages.user },
              {
                inlineData: {
                  mimeType: context.image.mimeType || 'image/jpeg',
                  data: context.image.data,
                },
              },
            ]
          : [{ text: messages.user }],
      }],
      generationConfig: {
        temperature: 0,
        topP: 0,
        maxOutputTokens: 256,
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
  const isAllowedNone = Array.isArray(context.options) && context.options.some(o => (o.value || '').toLowerCase() === 'none');
  if (!answer || answer.toLowerCase() === 'unknown' || (answer.toLowerCase() === 'none' && !isAllowedNone)) {
    return reject('not_answered', confidence);
  }

  if (answer.toLowerCase() === 'emergency' || parsed.emergency === true) {
    return { matched: false, emergency: true, value: 'emergency', label: 'Emergency', confidence, reason: 'emergency_triage' };
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
  const recognizedMedicine = parsed.recognized_medicine ? normalizeText(parsed.recognized_medicine, 60) : null;
  const followUpQuestion = parsed.follow_up_question ? normalizeText(parsed.follow_up_question, 200) : null;
  const possibleCategories = Array.isArray(parsed.possible_categories)
    ? parsed.possible_categories
        .map(c => normalizeText(c, 40))
        .filter(c => context.options.some(o => o.value === c))
    : [];
  const volunteeredContext = parsed.volunteered_context && typeof parsed.volunteered_context === 'object'
    ? parsed.volunteered_context
    : null;
  const customSymptom = parsed.custom_symptom ? normalizeText(parsed.custom_symptom, 50) : null;
  const detectedLanguageRaw = normalizeText(parsed.detected_language, 12).toLowerCase().split('-')[0];
  const detectedLanguage = /^[a-z]{2}$/.test(detectedLanguageRaw) ? detectedLanguageRaw : null;

  return {
    matched: true,
    value: option.value,
    label: option.label || option.value,
    confidence,
    reason: null,
    recognized_medicine: recognizedMedicine,
    follow_up_question: followUpQuestion,
    possible_categories: possibleCategories,
    volunteered_context: volunteeredContext,
    custom_symptom: customSymptom,
    detected_language: detectedLanguage,
  };
}
