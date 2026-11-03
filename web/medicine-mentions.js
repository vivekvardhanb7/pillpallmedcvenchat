import { normalizeSpeech } from './voice-input-mapper.js';

// Controlled dictionary: brand and ingredient names a customer may say when
// they already know what they want ("I need dolo for fever"). Each entry maps
// to a fixed key whose plain-language use description lives in i18n.js.
const MEDICINE_MENTIONS = [
  { key: 'paracetamol', aliases: ['paracetamol', 'paracetamolum', 'acetaminophen', 'dolo', 'doliprane', 'dolomo', 'tylenol', 'panadol'] },
  { key: 'ibuprofen', aliases: ['ibuprofen', 'ibuprofenum', 'brufen', 'nurofen', 'advil'] },
  { key: 'aspirin', aliases: ['aspirin', 'aspirinum', 'acetylsalicylic', 'acetylsalicylsaure'] },
  { key: 'loperamide', aliases: ['loperamide', 'loperamid', 'imodium'] },
  { key: 'cetirizine', aliases: ['cetirizine', 'cetirizin', 'zyrtec'] },
];

const ALIAS_TO_KEY = new Map();
for (const entry of MEDICINE_MENTIONS) {
  for (const alias of entry.aliases) ALIAS_TO_KEY.set(alias, entry.key);
}

export function detectMedicineMention(text) {
  const normalized = normalizeSpeech(text);
  if (!normalized) return null;
  const words = new Set(normalized.split(' '));
  for (const [alias, key] of ALIAS_TO_KEY) {
    if (words.has(alias)) return { key, alias };
  }
  return null;
}
