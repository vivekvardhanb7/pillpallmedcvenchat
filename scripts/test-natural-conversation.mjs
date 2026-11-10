import assert from 'node:assert/strict';
import { assessmentSpeech, splitSpeechText } from '../web/assessment-speech.js';
import { resolveVoiceAnswer, resolveConfirmationReply } from '../web/voice-input-mapper.js';
import { createSessionManager } from '../web/session-manager.mjs';
import { processChatTurn } from '../web/local-engine.mjs';
import { STRINGS, localizeResult, localizeScreen } from '../web/i18n.js';

const menu = /options are|optionen sind|choose|select|displayed|separate.*commas|wählen|auswählen|kommas/i;
let conversations = 0;
async function begin(language) {
  const chat = createSessionManager(processChatTurn);
  let turn = (await chat({ reset: true, language_code: language })).result;
  return {
    get turn() { return turn; },
    async say(question, utterance, { unclear = false } = {}) {
      assert.equal(turn.screen.question_id, question, `${language}: ${utterance}`);
      const prompt = assessmentSpeech(turn.screen, language, { summary: turn.summary });
      assert.ok(prompt.trim());
      assert.doesNotMatch(prompt, menu, `${question} must not read a menu`);
      const localized = localizeScreen(turn.screen, language);
      for (const flag of localized.red_flags || []) assert.ok(prompt.includes(flag), `missing warning: ${flag}`);
      assert.equal(splitSpeechText(prompt).join(' '), prompt);
      const answer = resolveVoiceAnswer(utterance, localized);
      if (unclear) { assert.equal(answer, null, utterance); return; }
      assert.ok(answer, `cannot understand ${language}/${question}: ${utterance}`);
      const response = await chat({ session_id: turn.session_id, revision: turn.revision,
        language_code: language, answer: { question_id: question, value: answer.value } });
      assert.equal(response.status, 200);
      turn = response.result;
      assert.equal(turn.state.country_code, 'DE');
      assert.equal(turn.dispense_authorized, false);
    },
  };
}
const phrases = {
  en: { symptom: 'I have a headache', age: 'I am thirty two', duration: 'It started yesterday', severity: 'It is mild',
    warnings: 'No, none of those apply', history: 'I take medicines', none: 'No, none of these', yes: 'yes', no: 'no',
    confirm: 'Yes, that is correct', uncertain: 'I am not sure', unknown: "I don't know the name", severe: 'It is unbearable' },
  de: { symptom: 'Ich habe Kopfschmerzen', age: 'zweiunddreißig', duration: 'Seit gestern', severity: 'Es ist leicht',
    warnings: 'Nein, keine davon', history: 'Ich nehme Medikamente', none: 'Nein, nichts davon', yes: 'ja', no: 'nein',
    confirm: 'Ja, das ist richtig', uncertain: 'Ich bin nicht sicher', unknown: 'Ich kenne den Namen nicht', severe: 'Es ist unerträglich' },
};
async function toBackground(c, p) {
  for (const [q, value] of [['symptom', p.symptom], ['age', p.age], ['duration', p.duration],
    ['severity', p.severity], ['warning_signs', p.warnings]]) await c.say(q, value);
}
for (const language of ['en', 'de']) {
  const p = phrases[language];
  // Every current question has a conversational prompt, regardless of menu labels.
  for (const question_id of Object.keys(STRINGS[language].voiceQuestion)) {
    const text = assessmentSpeech({ question_id, title: 'Choose one', subtitle: 'Separate with commas',
      options: [{ value: 'yes', label: 'DO_NOT_READ_THIS_MENU' }] }, language);
    assert.doesNotMatch(text, menu);
    assert.doesNotMatch(text, /DO_NOT_READ_THIS_MENU/);
  }
  const clean = await begin(language);
  await toBackground(clean, p);
  await clean.say('safety_background_status', p.none);
  const readback = assessmentSpeech(clean.turn.screen, language, { summary: clean.turn.summary });
  assert.match(readback, /32/);
  assert.ok(readback.includes(localizeScreen({ question_id: 'symptom', options: [{ value: 'pain_fever', label: 'Headache, pain or fever' }] }, language).options[0].label));
  await clean.say('confirm', p.uncertain, { unclear: true });
  await clean.say('confirm', p.confirm);
  assert.equal(clean.turn.outcome, 'NO_SUITABLE_PRODUCT');
  assert.ok(localizeResult(clean.turn, language).message);
  conversations++;

  const full = await begin(language);
  await toBackground(full, p);
  for (const [q, value] of [['safety_background_status', p.history], ['allergy_status', p.yes],
    ['allergy_terms', 'ibuprofen'], ['medication_status', p.yes], ['medication_terms', 'cetirizine'],
    ['condition_status', p.yes], ['condition_terms', 'asthma']]) await full.say(q, value);
  const fullReadback = assessmentSpeech(full.turn.screen, language, { summary: full.turn.summary });
  for (const value of ['ibuprofen', 'cetirizine', 'asthma']) assert.ok(fullReadback.includes(value));
  await full.say('confirm', p.confirm);
  assert.equal(full.turn.outcome, 'NO_SUITABLE_PRODUCT');
  conversations++;

  // A correction clears the medical interview before re-assessment.
  const correction = await begin(language);
  await toBackground(correction, p);
  await correction.say('safety_background_status', p.none);
  await correction.say('confirm', p.no);
  assert.equal(correction.turn.screen.question_id, 'symptom');
  assert.equal(correction.turn.state.age_years, null);
  await toBackground(correction, { ...p, age: '35' });
  await correction.say('safety_background_status', p.none);
  await correction.say('confirm', p.confirm);
  assert.equal(correction.turn.summary.age, 35);
  conversations++;

  const ambiguous = await begin(language);
  await ambiguous.say('symptom', language === 'en' ? 'I feel unwell' : 'Mir geht es nicht gut', { unclear: true });
  await ambiguous.say('symptom', p.symptom);
  await ambiguous.say('age', '32');
  await ambiguous.say('duration', language === 'en' ? 'I cannot remember' : 'Das weiß ich nicht', { unclear: true });
  assert.equal(ambiguous.turn.screen.question_id, 'duration');
  conversations++;

  for (const warning of [p.yes, p.uncertain]) {
    const emergency = await begin(language);
    for (const [q, value] of [['symptom', p.symptom], ['age', '32'], ['duration', p.duration], ['severity', p.severity], ['warning_signs', warning]]) await emergency.say(q, value);
    assert.equal(emergency.turn.outcome, 'IMMEDIATE_MEDICAL_CARE');
    conversations++;
  }
  for (const group of ['allergy', 'medication', 'condition']) {
    const uncertain = await begin(language);
    await toBackground(uncertain, p);
    await uncertain.say('safety_background_status', p.history);
    for (const current of ['allergy', 'medication', 'condition']) {
      await uncertain.say(`${current}_status`, current === group ? p.yes : p.no);
      if (current === group) { await uncertain.say(`${current}_terms`, p.unknown); break; }
    }
    assert.equal(uncertain.turn.outcome, 'CLINIC_REFERRAL');
    assert.ok(uncertain.turn.reason_codes.includes('medical_history_uncertain'));
    conversations++;
  }
  const severe = await begin(language);
  for (const [q, value] of [['symptom', p.symptom], ['age', '32'], ['duration', p.duration], ['severity', p.severe]]) await severe.say(q, value);
  assert.equal(severe.turn.outcome, 'CLINIC_REFERRAL');
  conversations++;
  const child = await begin(language);
  await child.say('symptom', p.symptom);
  await child.say('age', '12');
  assert.equal(child.turn.outcome, 'CLINIC_REFERRAL');
  conversations++;
}
assert.notEqual(resolveConfirmationReply('not sure'), 'yes');
console.log(`${conversations} natural-conversation scenarios passed (EN/DE), covering all questions, readbacks, corrections, uncertainty and referrals.`);
