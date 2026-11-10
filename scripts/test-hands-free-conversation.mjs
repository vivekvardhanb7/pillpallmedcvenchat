import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { extractVolunteeredContext } from '../web/question-intent.js';
import { localizeScreen, t } from '../web/i18n.js';
import { resolveConfirmationReply } from '../web/voice-input-mapper.js';

assert.equal(resolveConfirmationReply('Ja, das stimmt'), 'yes');
assert.equal(resolveConfirmationReply('Ja, das ist richtig'), 'yes');
assert.notEqual(resolveConfirmationReply('Ja, aber ich bin 35'), 'yes');

const source = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
for (const [language, phrase] of [
  ['en', "Hi, I've had a headache since this morning. It's not too bad. I'm thirty years old."],
  ['de', 'Ich habe seit heute Morgen leichte Kopfschmerzen. Ich bin dreißig Jahre alt.'],
]) {
  const facts = extractVolunteeredContext(phrase);
  assert.deepEqual(facts, { duration: 'today', age: 30, severity: 'mild' });
  let confirmation, submissions = [], prompts = [];
  const state = vm.createContext({
    current: { screen: { question_id: 'age', type: 'number', title: 'Age' }, state: { turns: 1 } },
    lastAnnouncedKey: '', sessionVolunteeredContext: facts,
    confirmedConversationFacts: new Map(), acknowledgedVolunteeredQuestions: new Set(),
    activeLanguage: () => language, currentLanguage: language, localizeScreen, t,
    assessmentGeneration: 1, setTimeout,
    showAnswerConfirmation(answer, _source, prompt) { confirmation = answer; prompts.push(prompt); },
    submitAnswer(value) { submissions.push(value); },
    pendingAnswer: null, appendTranscript() {}, hideAnswerConfirmation() {},
  });
  vm.runInContext(source.slice(source.indexOf('async function announceCurrent()'), source.indexOf('function setLoading(')), state);
  vm.runInContext(source.slice(source.indexOf('function confirmPendingAnswer('), source.indexOf('function changePendingAnswer(')), state);
  await vm.runInContext('announceCurrent()', state);
  assert.deepEqual(JSON.parse(JSON.stringify(confirmation.confirmedContext)), facts);
  assert.match(prompts[0], /30/);
  assert.doesNotMatch(prompts[0], /option\.|summary\./);
  state.pendingAnswer = confirmation;
  vm.runInContext('confirmPendingAnswer({ spoken: true })', state);
  assert.deepEqual(submissions, [30]);
  for (const question_id of ['duration', 'severity']) {
    state.current = { screen: { question_id, type: 'single_select' }, state: { turns: question_id } };
    await vm.runInContext('announceCurrent()', state);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.deepEqual(submissions, [30, 'today', 'mild']);
  assert.equal(prompts.length, 1, 'confirmed facts are carried forward without repeated questions');
}
assert.equal(extractVolunteeredContext('more than a week').duration, 'more_than_7_days');
assert.equal(extractVolunteeredContext('not mild').severity, undefined);
assert.equal(extractVolunteeredContext('nicht leicht').severity, undefined);

// The real hands-free callback must reopen after playback, never after reset.
let starts = 0, release;
const state = vm.createContext({
  handsFreeArmed: true, assessmentGeneration: 1, voiceFirst: true, muted: false,
  handsFreeBlocked: false, started: true, busy: false, current: { screen: {} },
  voice: { recognitionSupported: true, queue: [], startListening() { starts++; } },
  setTimeout: callback => callback(),
  initMicAudioAnalyser: () => new Promise(resolve => { release = resolve; }),
});
vm.runInContext(source.slice(source.indexOf('function openHandsFreeMicrophone()'), source.indexOf('function setVoiceMode(')), state);
vm.runInContext('openHandsFreeMicrophone()', state);
release();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(starts, 1, 'follow-up listening needs no tap');
vm.runInContext('openHandsFreeMicrophone(); assessmentGeneration++; started = false;', state);
release();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(starts, 1, 'ending session prevents delayed microphone reopening');
console.log('Hands-free EN/DE tests passed: compound answers, grouped confirmation, remembered facts and automatic listening.');
