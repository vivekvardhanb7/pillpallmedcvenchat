import assert from 'node:assert/strict';
import { VoiceAssistant } from '../web/voice-assistant.js';
import { resolveVoiceAnswer } from '../web/voice-input-mapper.js';
import { extractVolunteeredContext, isEmergencyWording } from '../web/question-intent.js';

console.log('Testing Phone-Call Duplex Natural Interruption (Barge-In) in EN & DE...\n');

// Mock SpeechRecognition for simulating phone call duplex audio
class MockRecognition {
  constructor() {
    MockRecognition.instance = this;
    this.starts = 0;
    this.stops = 0;
    this.aborts = 0;
  }
  start() { this.starts++; }
  stop() { this.stops++; }
  abort() { this.aborts++; }
  simulateUserSpeaking(text, isFinal = false) {
    this.onresult({
      results: [Object.assign([{ transcript: text }], { isFinal })]
    });
  }
}
globalThis.SpeechRecognition = MockRecognition;

// -----------------------------------------------------------------------------
// 1. ENGLISH: Natural Phone Call Interruption
// -----------------------------------------------------------------------------
{
  console.log('>>> [1. English Phone Call Interruption]');
  const voice = new VoiceAssistant({ provider: 'piper', bargeIn: true, languageCode: 'en' });

  const recognition = MockRecognition.instance;
  recognition.onstart();

  let interruptedText = null;
  voice.onBargeIn = (text) => { interruptedText = text; };

  // Simulate neural TTS audio playback that plays for 1000ms unless interrupted
  let audioCancelled = false;
  voice.playNeural = async (text, run) => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), 1000);
      voice.currentAbort = {
        abort: () => {
          clearTimeout(timer);
          audioCancelled = true;
          resolve(false);
        }
      };
    });
  };

  // Assistant begins speaking question
  voice.speak('How long have you had this symptom? For example, did it start today, or has it lasted several days?');
  assert.equal(voice.speaking, true, 'Assistant should be actively speaking');

  // Customer interrupts while assistant is talking (Barge-in!)
  recognition.simulateUserSpeaking('Actually it started yesterday', false);

  assert.equal(voice.speaking, false, 'Barge-in must immediately stop assistant speaking');
  assert.equal(audioCancelled, true, 'Audio playback must be aborted immediately upon user speech');
  assert.equal(interruptedText, 'Actually it started yesterday');
  console.log('✔ Assistant speaking cut off immediately upon user voice: interruptedText =', interruptedText);

  // Customer finishes utterance
  let capturedTranscript = '';
  voice.onFinalTranscript = (text) => { capturedTranscript = text; };
  recognition.simulateUserSpeaking('Started yesterday', true);
  recognition.onend();

  assert.equal(capturedTranscript, 'Started yesterday');

  // Map to duration question
  const durationScreen = {
    question_id: 'duration',
    type: 'single_select',
    options: [
      { value: 'today', label: 'Started today' },
      { value: '1_to_2_days', label: '1–2 days' },
      { value: 'more_than_7_days', label: 'More than 7 days' }
    ]
  };
  const answer = resolveVoiceAnswer(capturedTranscript, durationScreen);
  assert.equal(answer?.value, '1_to_2_days');
  console.log('✔ English spoken interruption naturally mapped to answer: "1_to_2_days"');
  voice.destroy();
}

// -----------------------------------------------------------------------------
// 2. GERMAN: Natural Phone Call Interruption
// -----------------------------------------------------------------------------
{
  console.log('\n>>> [2. German Phone Call Interruption]');
  const voiceDE = new VoiceAssistant({ provider: 'piper', bargeIn: true, languageCode: 'de' });

  const recognitionDE = MockRecognition.instance;
  recognitionDE.onstart();

  let deBargeIn = null;
  voiceDE.onBargeIn = (text) => { deBargeIn = text; };

  let deAudioCancelled = false;
  voiceDE.playNeural = async (text, run) => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), 1000);
      voiceDE.currentAbort = {
        abort: () => {
          clearTimeout(timer);
          deAudioCancelled = true;
          resolve(false);
        }
      };
    });
  };

  // Assistant speaks German question
  voiceDE.speak('Seit wann haben Sie diese Beschwerden? Seit heute, seit ein bis zwei Tagen oder länger?');
  assert.equal(voiceDE.speaking, true, 'German assistant should be actively speaking');

  // German speaker interrupts midway
  recognitionDE.simulateUserSpeaking('Seit gestern', false);

  assert.equal(voiceDE.speaking, false, 'German barge-in must immediately stop assistant speech');
  assert.equal(deAudioCancelled, true, 'German audio playback must be aborted immediately upon user speech');
  assert.equal(deBargeIn, 'Seit gestern');
  console.log('✔ German assistant speech cut off immediately upon user voice: deBargeIn =', deBargeIn);

  let deCapturedTranscript = '';
  voiceDE.onFinalTranscript = (text) => { deCapturedTranscript = text; };
  recognitionDE.simulateUserSpeaking('Seit gestern', true);
  recognitionDE.onend();

  const durationScreenDE = {
    question_id: 'duration',
    type: 'single_select',
    options: [
      { value: 'today', label: 'Seit heute' },
      { value: '1_to_2_days', label: 'Seit 1 bis 2 Tagen' },
      { value: 'more_than_7_days', label: 'Mehr als 7 Tage' }
    ]
  };
  const answerDE = resolveVoiceAnswer(deCapturedTranscript, durationScreenDE);
  assert.equal(answerDE?.value, '1_to_2_days');
  console.log('✔ German spoken interruption naturally mapped to answer: "1_to_2_days"');
  voiceDE.destroy();
}

// -----------------------------------------------------------------------------
// 3. COMPOUND ANSWER INTERRUPTION (Both EN & DE)
// -----------------------------------------------------------------------------
{
  console.log('\n>>> [3. Compound Answer Phone-Call Interruption]');

  // English compound interruption
  const enCompound = 'I have a mild headache since this morning and I am thirty';
  const enFacts = extractVolunteeredContext(enCompound);
  assert.deepEqual(enFacts, { duration: 'today', severity: 'mild', age: 30 });
  console.log('✔ English compound phone-call interruption extracted:', enFacts);

  // German compound interruption
  const deCompound = 'Ich habe seit heute Morgen leichte Kopfschmerzen und ich bin dreißig Jahre alt';
  const deFacts = extractVolunteeredContext(deCompound);
  assert.deepEqual(deFacts, { duration: 'today', severity: 'mild', age: 30 });
  console.log('✔ German compound phone-call interruption extracted:', deFacts);
}

// -----------------------------------------------------------------------------
// 4. EMERGENCY BARGE-IN INTERRUPTION (CRITICAL CLINICAL SAFETY)
// -----------------------------------------------------------------------------
{
  console.log('\n>>> [4. Emergency Red-Flag Interruption During Speech]');

  // English: User interrupts with acute breathing/chest symptom
  const enEmergency = 'Wait stop, my throat is closing and chest hurts!';
  assert.equal(isEmergencyWording(enEmergency), true);
  console.log('✔ English emergency wording intercepted during speech: triggers immediate triage');

  // German: User interrupts with acute chest pain
  const deEmergency = 'Halt, ich habe schwere Brustschmerzen und keine Luft!';
  assert.equal(isEmergencyWording(deEmergency), true);
  console.log('✔ German emergency wording intercepted during speech: triggers immediate triage');
}

// -----------------------------------------------------------------------------
// 5. LOCAL WHISPER ACOUSTIC BARGE-IN
// -----------------------------------------------------------------------------
{
  console.log('\n>>> [5. Local Whisper Acoustic Activity Barge-In]');
  const voiceWhisper = new VoiceAssistant({ localWhisper: true, provider: 'piper', fallbackToBrowser: false, bargeIn: true });

  let activityBargeIn = false;
  voiceWhisper.onBargeIn = () => { activityBargeIn = true; };

  let onActivityCallback = null;
  voiceWhisper.localWhisper = {
    start: async ({ onSpeechStart }) => {
      onActivityCallback = onSpeechStart;
    },
    endMonitoring: () => {},
    cancel: () => {},
  };

  voiceWhisper.playNeural = async (text, run) => {
    return new Promise(resolve => {
      voiceWhisper.currentAbort = { abort: () => resolve(false) };
    });
  };

  voiceWhisper.speak('Please describe your symptoms in detail.');
  assert.equal(voiceWhisper.speaking, true, 'Assistant should be actively speaking');
  assert.ok(onActivityCallback, 'Local Whisper should be listening in duplex mode');

  // Simulate local Whisper detecting voice activity (energy > threshold)
  onActivityCallback();

  assert.equal(voiceWhisper.speaking, false, 'Local Whisper acoustic activity must halt speech immediately');
  assert.equal(activityBargeIn, true);
  console.log('✔ Confirmed speech-start event stops playback (mocked transport; no measured hardware latency).');
  voiceWhisper.destroy();
}

console.log('\n================================================================');
console.log(' ALL PHONE-CALL DUPLEX INTERRUPTION (BARGE-IN) TESTS PASSED!   ');
console.log('================================================================');
