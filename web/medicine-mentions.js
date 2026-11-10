import { normalizeSpeech } from './voice-input-mapper.js';

// Controlled dictionary: brand and ingredient names a customer may say when
// they already know what they want ("I need dolo for fever"). Each entry maps
// to a fixed key whose plain-language use description lives in i18n.js.
const MEDICINE_MENTIONS = [
  // Common speech-recognition variants are intentionally limited to clear
  // misspellings of the ingredient. A vague sound-alike is not enough to infer
  // a medicine or bypass the symptom and safety questions.
  { key: 'paracetamol', aliases: ['paracetamol', 'paracetamolum', 'paractmol', 'paracetmol', 'paracetimel', 'paracetimol', 'paracitamol', 'acetaminophen', 'dolo', 'doliprane', 'dolomo', 'tylenol', 'panadol'] },
  { key: 'ibuprofen', aliases: ['ibuprofen', 'ibuprofenum', 'ibuprofin', 'ibuprophen', 'brufen', 'nurofen', 'advil'] },
  { key: 'aspirin', aliases: ['aspirin', 'asprin', 'aspirinum', 'acetylsalicylic', 'acetylsalicylsaure'] },
  { key: 'loperamide', aliases: ['loperamide', 'loperamid', 'loperimide', 'imodium'] },
  { key: 'cetirizine', aliases: ['cetirizine', 'cetirizin', 'cetrizine', 'setirizine', 'zyrtec', 'zirtec'] },
  { key: 'loratadine', aliases: ['loratadine', 'loratadin', 'loratidine', 'clarityn', 'claritin'] },
  { key: 'xylometazoline', aliases: ['xylometazoline', 'xylometazolin', 'xylometazaline', 'xylomethazoline', 'otrivine', 'otrivin'] },
  { key: 'dextromethorphan', aliases: ['dextromethorphan', 'dextromethorfan', 'dextromethophan'] },
  // These two have no currently supported vending pathway. We can explain their
  // usual purpose, but do not infer a different symptom category from the name.
  { key: 'dimenhydrinate', aliases: ['dimenhydrinate', 'dimenhydrinat'] },
  { key: 'simethicone', aliases: ['simethicone', 'simethicon', 'simeticone', 'gas x', 'gasx'] },
  { key: 'antacid', aliases: ['antacid', 'antacida', 'antazida', 'gaviscon', 'rennie', 'maalox', 'tums'] },
  { key: 'lozenge', aliases: ['lozenge', 'lozenges', 'strepsils', 'throat lozenge', 'halstablette', 'halstabletten'] },
  // "Nasal spray" alone is not enough to identify saline: it can contain a
  // decongestant or another active ingredient. Ask the customer to show or say
  // the product name instead of guessing.
  { key: 'saline', aliases: ['saline', 'saline spray', 'meerwasserspray'] },
  { key: 'ors', aliases: ['ors', 'oral rehydration', 'rehydration', 'elektrolyte'] },
];

const CONDITION_MENTIONS = [
  { key: 'ulcer', aliases: ['ulcer', 'ulcers', 'stomach ulcer', 'magengeschwur', 'peptic ulcer', 'gastritis'] },
  { key: 'asthma', aliases: ['asthma', 'asthmatisch'] },
  { key: 'hypertension', aliases: ['hypertension', 'high blood pressure', 'blood pressure', 'bluthochdruck'] },
  { key: 'kidney', aliases: ['kidney', 'kidneys', 'nieren', 'nierenprobleme', 'renal'] },
  { key: 'liver', aliases: ['liver', 'leber', 'hepat'] },
  { key: 'pregnancy', aliases: ['pregnant', 'pregnancy', 'schwanger', 'schwangerschaft', 'breastfeeding', 'stillen'] },
];

const ALIAS_TO_KEY = new Map();
for (const entry of MEDICINE_MENTIONS) {
  for (const alias of entry.aliases) ALIAS_TO_KEY.set(alias, entry.key);
}

const CONDITION_ALIAS_TO_KEY = new Map();
for (const entry of CONDITION_MENTIONS) {
  for (const alias of entry.aliases) CONDITION_ALIAS_TO_KEY.set(alias, entry.key);
}

export function detectMedicineMention(text) {
  const normalized = normalizeSpeech(text);
  if (!normalized) return null;
  // Match full phrase or single word
  for (const [alias, key] of ALIAS_TO_KEY) {
    if (new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)) {
      return { key, alias };
    }
  }
  return null;
}

export function detectConditionMention(text) {
  const normalized = normalizeSpeech(text);
  if (!normalized) return null;
  for (const [alias, key] of CONDITION_ALIAS_TO_KEY) {
    if (new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)) {
      return { key, alias };
    }
  }
  return null;
}

const KNOWN_PRECAUTIONS = {
  ibuprofen: new Set(['ulcer', 'asthma', 'hypertension', 'kidney', 'pregnancy']),
  aspirin: new Set(['ulcer', 'asthma', 'hypertension', 'kidney', 'pregnancy']),
  paracetamol: new Set(['liver']),
};

export function hasKnownPrecaution(medicineKey, conditionKey) {
  return Boolean(KNOWN_PRECAUTIONS[medicineKey]?.has(conditionKey));
}
