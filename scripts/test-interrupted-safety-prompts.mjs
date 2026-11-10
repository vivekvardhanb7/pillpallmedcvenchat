import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolveVoiceAnswer, resolveConfirmationReply } from '../web/voice-input-mapper.js';
const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('async function handleNaturalLanguageAnswer('), source.indexOf('function volunteeredContextAcknowledgement('));
for (const language of ['en', 'de']) {
  const submitted = [], spoken = [];
  const state = vm.createContext({
    cleanTranscriptText: s => s, markActivity() {}, appendTranscript() {}, detectLanguage: () => null,
    maybeSwitchLanguage() {}, isEmergencyWording: () => false, busy: false,
    current: { screen: { question_id: 'warning_signs', options: [
      { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not_sure', label: 'Not sure' },
    ] }, state: {} },
    extractVolunteeredContext: () => ({}), extractVolunteeredSafetyContext: () => ({}),
    trustedVolunteeredQuestions: new Set(), sessionVolunteeredContext: {}, pendingAnswer: null,
    localizeScreen: s => s, currentLanguage: language, conversationalReplyFor: () => null,
    understanding: { available: false }, resolveVoiceAnswer, resolveConfirmationReply,
    isQuestionByWording: () => false, clarificationFor: () => null,
    interruptedWarning: true, interruptedConfirmation: false,
    activeLanguage: () => language, questionSpeech: () => 'FULL WARNING LIST',
    sayAssistant: text => spoken.push(text), needsAnswerConfirmation: () => false,
    submitAnswer: value => submitted.push(value), confirmPendingAnswer: () => submitted.push('confirmed'),
    answerConfirmationText: { textContent: 'FULL CONFIRMATION' },
  });
  vm.runInContext(handler, state);
  const no = language === 'en' ? 'No' : 'Nein';
  await vm.runInContext(`handleNaturalLanguageAnswer(${JSON.stringify(no)}, 'chat')`, state);
  assert.deepEqual(submitted, [], 'interrupted warning cannot accept an all-clear');
  assert.ok(spoken[0].includes('FULL WARNING LIST'));
  await vm.runInContext(`handleNaturalLanguageAnswer(${JSON.stringify(no)}, 'chat')`, state);
  assert.deepEqual(submitted, ['no'], 'a complete replay can then receive a negative answer');
  state.interruptedWarning = true;
  const yes = language === 'en' ? 'Yes' : 'Ja';
  await vm.runInContext(`handleNaturalLanguageAnswer(${JSON.stringify(yes)}, 'chat')`, state);
  assert.deepEqual(submitted, ['no', 'yes'], 'positive warning is not delayed by a replay');
  state.pendingAnswer = { value: 30 };
  state.interruptedConfirmation = true;
  await vm.runInContext(`handleNaturalLanguageAnswer(${JSON.stringify(yes)}, 'chat')`, state);
  assert.equal(spoken.at(-1), 'FULL CONFIRMATION');
  assert.deepEqual(submitted, ['no', 'yes']);
}
// The real barge-in wiring must set the safety flags. A duplicate assignment of
// voice.onBargeIn previously replaced this handler and silently disabled both
// the warning replay and the confirmation replay.
const bargeSource = source.slice(
  source.indexOf('function handleVoiceBargeIn('),
  source.indexOf('function configureVoice('),
);
const barge = vm.createContext({
  current: { screen: { question_id: 'warning_signs' } },
  pendingAnswer: null,
  interruptedWarning: false,
  interruptedConfirmation: false,
  handsFreeArmed: false,
  voiceOnlyPage: false,
  voiceCaption: null,
  voiceCaptionRole: null,
  markActivity() {},
  voice: { lastBargeInMetric: { source: 'test', stop_ms: 1 } },
  voiceMetrics: { barge_ins: [] },
  lastRecordedBargeInMetric: null,
});
vm.runInContext(bargeSource, barge);
vm.runInContext('handleVoiceBargeIn("I need to stop")', barge);
assert.equal(barge.interruptedWarning, true, 'barge-in during a warning list must request a replay');
assert.equal(barge.handsFreeArmed, true, 'barge-in must keep hands-free listening armed');
assert.equal(barge.voiceMetrics.barge_ins.length, 1, 'barge-in metric is recorded once');
vm.runInContext('handleVoiceBargeIn("same metric")', barge);
assert.equal(barge.voiceMetrics.barge_ins.length, 1, 'the same metric object is not recorded twice');
vm.runInContext('current = { screen: { question_id: "age" } }; pendingAnswer = { value: 30 }; interruptedWarning = false;', barge);
vm.runInContext('handleVoiceBargeIn("thirty")', barge);
assert.equal(barge.interruptedWarning, false, 'a warning flag is only set on the warning question');
assert.equal(barge.interruptedConfirmation, true, 'barge-in during a read-back must request a replay');

console.log('Interrupted EN/DE safety prompts passed: complete readback required, positive warnings not delayed.');
