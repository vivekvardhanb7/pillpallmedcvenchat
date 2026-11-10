import assert from 'node:assert/strict';

class Recognition {
  constructor() { Recognition.instance = this; this.starts = 0; this.stops = 0; this.aborts = 0; }
  start() { this.starts++; }
  stop() { this.stops++; }
  abort() { this.aborts++; }
  result(text, final = false) { this.onresult({ results: [Object.assign([{ transcript: text }], { isFinal: final })] }); }
}
globalThis.SpeechRecognition = Recognition;
const { VoiceAssistant } = await import('../web/voice-assistant.js');
const voice = new VoiceAssistant({ provider: 'none', fallbackToBrowser: false });
assert.equal(voice.silenceTimeoutMs, 1800, 'voice turns allow a natural pause');
const recognition = Recognition.instance;
const transcripts = [];
const errors = [];
voice.onFinalTranscript = text => transcripts.push(text);
voice.onError = (_message, code) => errors.push(code);
assert.equal(voice.startListening(), true);
assert.equal(voice.startListening(), true);
assert.equal(recognition.starts, 1, 'repeated starts must not race browser onstart');
recognition.onstart();
recognition.result('head', false);
voice.stopListening();
assert.deepEqual(transcripts, [], 'wait for final recognition results');
recognition.result('headache', true);
recognition.onend();
assert.deepEqual(transcripts, ['headache']);
voice.startListening();
recognition.onstart();
recognition.result('unfinished', false);
voice.cancelListening();
recognition.result('unfinished final', true);
recognition.onend();
assert.deepEqual(transcripts, ['headache'], 'interrupted audio must not become an answer');
voice.startListening();
recognition.onstart();
recognition.onerror({ error: 'not-allowed' });
recognition.onend();
assert.equal(recognition.starts, 3, 'permission failures must not retry indefinitely');
voice.startListening();
recognition.onstart();
recognition.onerror({ error: 'no-speech' });
recognition.onend();
assert.equal(recognition.starts, 4, 'no-speech must not retry indefinitely');
assert.deepEqual(errors, ['not-allowed', 'no-speech']);
voice.startListening();
voice.cancelListening();
recognition.onstart();
recognition.onend();
assert.equal(voice.listening, false, 'late onstart after cancellation must not reopen microphone');
voice.destroy();

const timedOutVoice = new VoiceAssistant({ provider: 'none', fallbackToBrowser: false, listenTimeoutMs: 1 });
const timedOutRecognition = Recognition.instance;
const timeoutErrors = [];
timedOutVoice.onError = (_message, code) => timeoutErrors.push(code);
timedOutVoice.startListening();
timedOutRecognition.onstart();
await new Promise(resolve => setTimeout(resolve, 3050));
assert.equal(timedOutRecognition.stops, 1, 'a silent recognizer must be stopped by the watchdog');
timedOutRecognition.onend();
assert.equal(timedOutVoice.listening, false, 'watchdog timeout must return to idle after recognition ends');
assert.deepEqual(timeoutErrors, ['no-speech']);
timedOutVoice.destroy();
console.log('Voice recognition lifecycle tests passed.');
