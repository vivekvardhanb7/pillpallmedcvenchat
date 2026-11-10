import assert from 'node:assert/strict';
import {
  LANGUAGES,
  STRINGS,
  detectLanguage,
  languageByCode,
  localizeResult,
  localizeScreen,
  localizeSummary,
  speechLocale,
  t,
} from '../web/i18n.js';

const languageCodes = LANGUAGES.map(language => language.code);
assert.equal(languageCodes[0], 'auto');
assert.equal(new Set(languageCodes).size, languageCodes.length);
for (const required of ['en', 'de', 'tr', 'ar', 'uk', 'pl', 'ru', 'ro', 'fr', 'fa', 'ur', 'hi', 'te', 'ku', 'ps', 'so', 'vi']) {
  assert.ok(languageCodes.includes(required), `missing common Germany language ${required}`);
}
assert.equal(languageByCode('auto').code, 'auto');
assert.equal(languageByCode('fr-FR').code, 'fr');
assert.equal(languageByCode('de-DE').code, 'de');
assert.equal(speechLocale('de'), 'de-DE');
assert.equal(speechLocale('en'), 'en-US');
assert.equal(speechLocale('ar'), 'ar-MA');

assert.equal(detectLanguage('I have a headache'), 'en');
assert.equal(detectLanguage('I am not pregnant'), 'en');
assert.equal(detectLanguage('Ich habe Kopfschmerzen'), 'de');
assert.equal(detectLanguage('mehr als eine Woche'), 'de');
assert.equal(detectLanguage('Ich weiß nicht'), 'de');
assert.equal(detectLanguage('Ja, bestätigen'), 'de');
assert.equal(detectLanguage('zweiunddreißig'), 'de');
assert.equal(detectLanguage('thirty five'), 'en');
assert.equal(detectLanguage('I take ibuprofen'), 'en');
assert.equal(detectLanguage('ich nehme ibuprofen'), 'de');
assert.equal(detectLanguage('yes'), null);
assert.equal(detectLanguage('okay'), null);

assert.equal(t('app.tapToStart', 'en'), 'Tap to Start');
assert.equal(t('app.tapToStart', 'de'), 'Zum Starten tippen');
assert.equal(t('speech.optionsAre', 'de', { options: 'A, B' }), 'Optionen sind: A, B.');

const symptom = {
  question_id: 'symptom',
  type: 'single_select',
  title: 'What would you like help with?',
  subtitle: 'Choose the closest option. This is not a diagnosis.',
  options: [
    { value: 'pain_fever', label: 'Headache, pain or fever' },
    { value: 'other', label: 'Other symptom' },
  ],
};
const germanSymptom = localizeScreen(symptom, 'de');
assert.equal(germanSymptom.title, 'Womit können wir Ihnen helfen?');
assert.deepEqual(
  germanSymptom.options.map(option => [option.value, option.label]),
  [
    ['pain_fever', 'Kopfschmerzen, Schmerzen oder Fieber'],
    ['other', 'Anderes Symptom'],
  ],
);
assert.equal(localizeScreen(symptom, 'en').title, symptom.title);

const errorScreen = localizeScreen(
  { ...symptom, question_id: 'age', type: 'number', options: [], error: 'Enter an age from 0 to 120.' },
  'de',
);
assert.equal(errorScreen.error, 'Geben Sie ein Alter von 0 bis 120 ein.');

const referral = localizeResult({ outcome: 'CLINIC_REFERRAL', reason_codes: ['under_18'], message: 'English message' }, 'de');
assert.equal(referral.title, 'Keine automatische Empfehlung');
assert.match(referral.message, /18/);
assert.doesNotMatch(referral.message, /English message/);

const immediate = localizeResult({ outcome: 'IMMEDIATE_MEDICAL_CARE', reason_codes: ['warning_sign_reported'], message: '' }, 'de');
assert.equal(immediate.title, 'Ärztliche Hilfe erforderlich');

const noProduct = localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['catalog_unavailable'], message: '' }, 'de');
assert.equal(noProduct.title, 'Kein geeignetes zugelassenes Produkt');
assert.match(noProduct.message, /Katalog/);

const eligible = localizeResult(
  { outcome: 'PRODUCT_ELIGIBLE', reason_codes: ['approved_product_match'], screen: { title: 'Fixture 500 mg' } },
  'de',
);
assert.equal(eligible.title, 'Fixture 500 mg');
assert.match(eligible.message, /zugelassenes Produkt/);

const summary = localizeSummary(
  {
    symptom_category: 'Headache, pain or fever',
    age: 32,
    duration: 'More than 7 days',
    severity: 'mild',
    warning_signs: 'None reported',
    pregnancy_or_breastfeeding: 'no',
    allergies: [],
  },
  'de',
);
assert.equal(summary[0].label, 'Symptomkategorie');
assert.equal(summary[0].value, 'Kopfschmerzen, Schmerzen oder Fieber');
assert.equal(summary[2].value, 'Mehr als 7 Tage');
assert.equal(summary[3].value, 'Leicht');
assert.equal(summary[4].value, 'Keine angegeben');
assert.equal(summary[5].value, 'Nein');
assert.equal(summary[6].value, 'Keine angegeben');

const englishSummary = localizeSummary({ severity: 'mild', duration: '3–7 days' }, 'en');
assert.equal(englishSummary[0].value, 'Mild');
assert.equal(englishSummary[1].value, '3–7 days');

assert.equal(t('pharmacy.purposeQuestion', 'en'), 'What do you need it for?');
assert.equal(t('pharmacy.purposeQuestion', 'de'), 'Wofür benötigen Sie es?');
assert.match(t('pharmacy.uses.paracetamol', 'en'), /pain and fever/);
assert.match(t('pharmacy.uses.paracetamol', 'de'), /Schmerzen und Fieber/);
for (const key of ['paracetamol', 'ibuprofen', 'aspirin', 'loperamide', 'cetirizine']) {
  assert.ok(t(`pharmacy.uses.${key}`, 'en'), `missing en pharmacy.uses.${key}`);
  assert.ok(t(`pharmacy.uses.${key}`, 'de'), `missing de pharmacy.uses.${key}`);
}
assert.ok(t('voice.sessionComplete', 'de'));
assert.ok(t('session.inactivity', 'de'));

// A question the customer never reached must not read as an answer of "Not sure".
assert.equal(localizeSummary({ warning_signs: 'Not asked', severity: 'mild' }, 'de')[0].value, 'Nicht abgefragt');
assert.equal(localizeSummary({ allergies: 'Not asked' }, 'en')[0].value, 'Not asked');

// Age-only product blocks get their own copy in both languages.
const ageRange = localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['age_outside_supported_range', 'all_products_blocked'] }, 'de');
assert.match(ageRange.message, /Altersgruppe/);
assert.match(localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['age_outside_supported_range'] }, 'en').message, /different age range/);

// Out-of-scope categories and a symptom that outlasts the approved self-care
// window each need their own sentence: "no product matched" alone tells the
// customer nothing about what to do next.
assert.match(localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['pathway_not_serviced'] }, 'en').message, /pharmacist or doctor/);
assert.match(localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['pathway_not_serviced'] }, 'de').message, /Apothekerin oder ein Arzt/);
assert.match(localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['symptom_longer_than_product_allows', 'all_products_blocked'] }, 'en').message, /longer than these products are approved/);
assert.match(localizeResult({ outcome: 'NO_SUITABLE_PRODUCT', reason_codes: ['symptom_longer_than_product_allows'] }, 'de').message, /länger, als für diese Produkte/);

// The fever red flags must reach a German customer in German, not as the
// generic list and not as English text on a German screen.
const feverScreenDe = localizeScreen({ question_id: 'warning_signs', type: 'single_select', title: 'Do any serious warning signs apply?', pathway_code: 'pain_fever', subtitle: 'engine english fallback' }, 'de');
assert.match(feverScreenDe.subtitle, /Nackensteifigkeit/);
assert.match(feverScreenDe.subtitle, /Hautausschlag, der beim Drücken eines Glases nicht verblasst/);
assert.doesNotMatch(feverScreenDe.subtitle, /engine english fallback/);
const feverScreenEn = localizeScreen({ question_id: 'warning_signs', type: 'single_select', title: 'x', pathway_code: 'pain_fever', subtitle: 'fallback' }, 'en');
assert.match(feverScreenEn.subtitle, /stiff neck/);
assert.match(feverScreenEn.subtitle, /does not fade when you press a glass/);
// An unknown pathway falls back to the generic list rather than rendering nothing.
const genericScreen = localizeScreen({ question_id: 'warning_signs', type: 'single_select', title: 'x', pathway_code: 'cold_cough', subtitle: 'generic fallback' }, 'de');
assert.match(genericScreen.subtitle, /Diese allgemeine Liste/);

// English and German dictionaries must stay key-identical: a key that exists
// only in English renders English text on the German screen without any error.
const flattenKeys = (node, prefix = '') => Object.entries(node).flatMap(([key, value]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return typeof value === 'string' ? [path] : flattenKeys(value, path);
});
const englishKeys = flattenKeys(STRINGS.en).sort();
assert.ok(englishKeys.length > 100);
assert.deepEqual(flattenKeys(STRINGS.de).sort(), englishKeys, 'de dictionary is out of step with en');
for (const key of englishKeys) {
  assert.ok(t(key, 'en').trim(), `empty en value for ${key}`);
  assert.ok(t(key, 'de').trim(), `empty de value for ${key}`);
}

console.log('All i18n tests passed.');
