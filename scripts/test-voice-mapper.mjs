import assert from 'node:assert/strict';
import { resolveVoiceAnswer, resolveConfirmationReply, spokenNumber } from '../web/voice-input-mapper.js';
import {
  looksLikeQuestion,
  isQuestionByWording,
  normalizeIntentText,
  isEmergencyWording,
  extractVolunteeredContext,
  extractVolunteeredSafetyContext,
  detectDetailedSymptomContext,
  socialIntent,
} from '../web/question-intent.js';
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
assert.equal(resolveVoiceAnswer('these conditions', screen('warning_signs', ['yes', 'no', 'not_sure'])), null);
assert.equal(resolveVoiceAnswer('no, none of these conditions', screen('warning_signs', ['yes', 'no', 'not_sure'])).value, 'no');
assert.equal(resolveVoiceAnswer('yes confirm', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('ok approve', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('approve', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('check products', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('proceed', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('valider', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('wakha', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'yes');
assert.equal(resolveVoiceAnswer('restart', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'no');
assert.equal(resolveVoiceAnswer('start again', screen('confirm', ['yes', 'no'], 'confirmation')).value, 'no');
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
assert.equal(detectMedicineMention('The paracetimel is used for')?.key, 'paracetamol');
assert.equal(detectMedicineMention('Can I take paractmol for fever?')?.key, 'paracetamol');
assert.equal(detectMedicineMention('Brufen please')?.key, 'ibuprofen');
assert.equal(detectMedicineMention('ibuprofin for fever')?.key, 'ibuprofen');
assert.equal(detectMedicineMention('zyrtec')?.key, 'cetirizine');
assert.equal(detectMedicineMention('cetrazine')?.key, undefined);
assert.equal(detectMedicineMention('cetrizine for hay fever')?.key, 'cetirizine');
assert.equal(detectMedicineMention('imodium tablets')?.key, 'loperamide');
assert.equal(detectMedicineMention('loperimide for diarrhoea')?.key, 'loperamide');
assert.equal(detectMedicineMention('aspirin')?.key, 'aspirin');
assert.equal(detectMedicineMention('asprin tablets')?.key, 'aspirin');
assert.equal(detectMedicineMention('claritin')?.key, 'loratadine');
assert.equal(detectMedicineMention('otrivin nasal spray')?.key, 'xylometazoline');
assert.equal(detectMedicineMention('dextromethorfan cough syrup')?.key, 'dextromethorphan');
assert.equal(detectMedicineMention('dimenhydrinate')?.key, 'dimenhydrinate');
assert.equal(detectMedicineMention('gas x')?.key, 'simethicone');
assert.equal(detectMedicineMention('nasal spray please'), null);
assert.equal(detectMedicineMention('I have a headache'), null);
assert.equal(detectMedicineMention('paracetam'), null);

// A read-back in voice-first mode is answered out loud. Only a bare affirmation
// counts as agreement, so an answer that carries new content is never spent as
// "yes" and can never silently accept a misheard value.
assert.equal(resolveConfirmationReply('yes'), 'yes');
assert.equal(resolveConfirmationReply('ok approve'), 'yes');
assert.equal(resolveConfirmationReply('approve'), 'yes');
assert.equal(resolveConfirmationReply('approved'), 'yes');
assert.equal(resolveConfirmationReply('check products'), 'yes');
assert.equal(resolveConfirmationReply('proceed'), 'yes');
assert.equal(resolveConfirmationReply('oui'), 'yes');
assert.equal(resolveConfirmationReply("d'accord"), 'yes');
assert.equal(resolveConfirmationReply('wakha'), 'yes');
assert.equal(resolveConfirmationReply('valider'), 'yes');
assert.equal(resolveConfirmationReply('that is correct'), 'yes');
assert.equal(resolveConfirmationReply('Ja, genau'), 'yes');
assert.equal(resolveConfirmationReply('okay'), 'yes');
assert.equal(resolveConfirmationReply('no'), 'no');
assert.equal(resolveConfirmationReply('restart'), 'no');
assert.equal(resolveConfirmationReply('start again'), 'no');
assert.equal(resolveConfirmationReply('that is wrong'), 'no');
assert.equal(resolveConfirmationReply('nein'), 'no');
assert.equal(resolveConfirmationReply('recommencer'), 'no');
assert.equal(resolveConfirmationReply('it was actually the 15th of March'), null);
assert.equal(resolveConfirmationReply('I have a headache since this morning'), null);
assert.equal(resolveConfirmationReply(''), null);

// Statements are answers, not questions. "was" inside a sentence used to send
// "It was started today" into the clarification path, which answered "I cannot
// diagnose symptoms" instead of recording the duration.
assert.equal(looksLikeQuestion('It was started today'), false);
assert.equal(looksLikeQuestion('Started today'), false);
assert.equal(looksLikeQuestion('I have a headache since this morning'), false);
assert.equal(looksLikeQuestion('No, none of these'), false);
assert.equal(looksLikeQuestion('Yes correct'), false);
assert.equal(looksLikeQuestion('Ages 25'), false);
assert.equal(looksLikeQuestion('not too bad, just annoying'), false);
assert.equal(looksLikeQuestion('what does mild mean?'), true);
assert.equal(looksLikeQuestion('What is my age?'), true);
assert.equal(looksLikeQuestion('Was bedeutet leicht?'), true);
assert.equal(looksLikeQuestion('I do not understand'), true);
assert.equal(looksLikeQuestion('Can I take this?'), true);
assert.equal(looksLikeQuestion('combien de jours?'), true);
assert.equal(looksLikeQuestion(''), false);

// Recognition appends "?" to a statement spoken with rising intonation. In the
// demo the customer said "It was started today?" on the duration question and
// got the clarification reply instead of the answer, so punctuation alone must
// not outweigh an utterance that names an option.
assert.equal(looksLikeQuestion('It was started today?'), true);
assert.equal(isQuestionByWording('It was started today?'), false);
assert.equal(isQuestionByWording('what does mild mean?'), true);
assert.equal(isQuestionByWording('repeat the question'), true);
assert.equal(isQuestionByWording('no, none of these'), false);
assert.equal(resolveVoiceAnswer('It was started today?', screen('duration', ['today', '3_to_7_days', 'more_than_7_days'])).value, 'today');
assert.equal(resolveVoiceAnswer('Ages 25?', { question_id: 'age', type: 'number', options: [] }).value, 25);
// Wording still wins: this names "mild" but is a question about it.
assert.equal(isQuestionByWording('does mild mean a lot?'), true);
assert.equal(normalizeIntentText('Was bedeutet leicht?'), 'was bedeutet leicht');
assert.equal(socialIntent('Hi.'), 'greeting');
assert.equal(socialIntent('Thank you!'), 'thanks');
assert.equal(socialIntent('Can you help me?'), 'help');
assert.equal(socialIntent('I have a headache'), null);

// Common natural-language duration answers map without the AI helper.
const duration = screen('duration', ['today', '1_to_2_days', '3_to_7_days', 'more_than_7_days']);
assert.equal(resolveVoiceAnswer('It was started today', duration).value, 'today');
assert.equal(resolveVoiceAnswer('since this morning', duration).value, 'today');
assert.equal(resolveVoiceAnswer('from last night', duration).value, 'today');
assert.equal(resolveVoiceAnswer('since yesterday', duration).value, '1_to_2_days');
assert.equal(resolveVoiceAnswer('two days', duration).value, '1_to_2_days');
assert.equal(resolveVoiceAnswer('one week', duration).value, '3_to_7_days');
assert.equal(resolveVoiceAnswer('for 5 days', duration).value, '3_to_7_days');
assert.equal(resolveVoiceAnswer('more than a week', duration).value, 'more_than_7_days');
assert.equal(resolveVoiceAnswer('for two weeks', duration).value, 'more_than_7_days');

const severity = screen('severity', ['mild', 'moderate', 'severe']);
assert.equal(resolveVoiceAnswer('not too bad, just a bit annoying', severity).value, 'mild');
assert.equal(resolveVoiceAnswer('it is really bad', severity).value, 'severe');
assert.equal(resolveVoiceAnswer('uncomfortable but manageable', severity).value, 'moderate');

assert.equal(resolveVoiceAnswer('my head deck since morning', screen('symptom', ['pain_fever', 'cold_cough'])).value, 'pain_fever');
assert.equal(resolveVoiceAnswer('my head hurts', screen('symptom', ['pain_fever', 'cold_cough'])).value, 'pain_fever');

assert.equal(isEmergencyWording('my throat is closing'), true);
assert.equal(isEmergencyWording('she fainted and is unconscious'), true);
assert.equal(isEmergencyWording('j ai une douleur thoracique grave'), true);
assert.equal(isEmergencyWording('severe shortness of breath'), true);
assert.equal(isEmergencyWording('I have a mild headache'), false);

assert.deepEqual(extractVolunteeredContext('suffering from fever test from yesterday morning'), { duration: '1_to_2_days' });
assert.deepEqual(extractVolunteeredContext('I have fever from last night'), { duration: 'today' });
assert.deepEqual(extractVolunteeredContext('my age is 25 and started today'), { age: 25, duration: 'today' });
assert.deepEqual(extractVolunteeredContext('severe pain for 5 days'), { severity: 'severe', duration: '3_to_7_days' });
assert.deepEqual(
  extractVolunteeredSafetyContext('I odont have any alleargies or any other medcial conditios recommend medicine'),
  { allergy_status: 'no', condition_status: 'no' },
);
assert.deepEqual(extractVolunteeredSafetyContext('I have no drug allergies and no health issues'), { allergy_status: 'no', condition_status: 'no' });
assert.deepEqual(extractVolunteeredSafetyContext("I'm not on any medication and I don't have any illness"), { medication_status: 'no', condition_status: 'no' });
assert.deepEqual(extractVolunteeredSafetyContext('Ich habe keine Allergien und keine Erkrankungen'), { allergy_status: 'no', condition_status: 'no' });
assert.deepEqual(extractVolunteeredSafetyContext("Je n'ai aucune allergie et pas de maladie"), { allergy_status: 'no', condition_status: 'no' });
assert.equal(detectDetailedSymptomContext('I have stomach pain and she is on her period'), 'period_pain');
assert.equal(detectDetailedSymptomContext('The pain is in my lower abdomen'), 'abdominal_pain');
assert.equal(detectDetailedSymptomContext('ordinary headache'), 'headache');
assert.equal(detectDetailedSymptomContext('my head hurts since morning'), 'headache');
assert.equal(detectDetailedSymptomContext('I have a fever'), 'fever');

console.log('All voice answer mapper tests passed.');


assert.equal(resolveVoiceAnswer('keines davon', screen('safety_background_status', ['none', 'pregnancy', 'history', 'both', 'not_sure'])).value, 'none');
