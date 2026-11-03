import assert from 'node:assert/strict';
import { resolveVoiceAnswer, spokenNumber } from '../web/voice-input-mapper.js';
import { detectMedicineMention } from '../web/medicine-mentions.js';

const screen = (question_id, values, type = 'single_select') => ({
  question_id,
  type,
  options: values.map(value => ({ value, label: value.replaceAll('_', ' ') })),
});

assert.equal(spokenNumber('I am thirty two years old'), 32);
assert.equal(spokenNumber('one hundred and twenty'), 120);
assert.equal(resolveVoiceAnswer('I have a headache', screen('symptom', ['pain_fever', 'cold_cough'])).value, 'pain_fever');
assert.equal(resolveVoiceAnswer('more than a week', screen('duration', ['today', '3_to_7_days', 'more_than_7_days'])).value, 'more_than_7_days');
assert.equal(resolveVoiceAnswer('I am not pregnant', screen('pregnancy_breastfeeding', ['pregnant', 'no'])).value, 'no');
assert.equal(resolveVoiceAnswer("I don't know", screen('allergy_status', ['yes', 'no', 'not_sure'])).value, 'not_sure');
assert.equal(resolveVoiceAnswer('I do not have any', screen('warning_signs', ['yes', 'no', 'not_sure'])).value, 'no');
assert.equal(resolveVoiceAnswer('yes confirm', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('thirty five', { question_id: 'age', type: 'number', options: [] }).value, 35);
assert.equal(resolveVoiceAnswer('unmatched speech', screen('severity', ['mild', 'moderate', 'severe'])), null);

assert.equal(spokenNumber('zweiunddreißig'), 32);
assert.equal(spokenNumber('fünfunddreißig'), 35);
assert.equal(resolveVoiceAnswer('Ich habe Kopfschmerzen', screen('symptom', ['pain_fever', 'cold_cough'])).value, 'pain_fever');
assert.equal(resolveVoiceAnswer('Ich habe Durchfall', screen('symptom', ['pain_fever', 'diarrhoea'])).value, 'diarrhoea');
assert.equal(resolveVoiceAnswer('mehr als eine Woche', screen('duration', ['today', '3_to_7_days', 'more_than_7_days'])).value, 'more_than_7_days');
assert.equal(resolveVoiceAnswer('seit drei Tagen', screen('duration', ['today', '1_to_2_days', '3_to_7_days'])).value, '3_to_7_days');
assert.equal(resolveVoiceAnswer('leicht', screen('severity', ['mild', 'moderate', 'severe'])).value, 'mild');
assert.equal(resolveVoiceAnswer('Ich bin nicht schwanger', screen('pregnancy_breastfeeding', ['pregnant', 'no'])).value, 'no');
assert.equal(resolveVoiceAnswer('Ich weiß nicht', screen('allergy_status', ['yes', 'no', 'not_sure'])).value, 'not_sure');
assert.equal(resolveVoiceAnswer('Ja, bestätigen', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('unbekannte Antwort', screen('severity', ['mild', 'moderate', 'severe'])), null);

assert.equal(detectMedicineMention('I need dolo for fever')?.key, 'paracetamol');
assert.equal(detectMedicineMention('ich brauche Doliprane')?.key, 'paracetamol');
assert.equal(detectMedicineMention('Brufen please')?.key, 'ibuprofen');
assert.equal(detectMedicineMention('zyrtec')?.key, 'cetirizine');
assert.equal(detectMedicineMention('imodium tablets')?.key, 'loperamide');
assert.equal(detectMedicineMention('aspirin')?.key, 'aspirin');
assert.equal(detectMedicineMention('I have a headache'), null);
assert.equal(detectMedicineMention('paracetam'), null);

console.log('All voice answer mapper tests passed.');

