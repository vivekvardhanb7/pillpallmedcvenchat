# PILLPAL Voice Chatbot — Full Improvement Plan

**Purpose:** A practical, safety-first roadmap to make the voice experience easier to use, more reliable in real kiosk conditions, and verifiable before a pilot.

**Scope:** Voice conversation from microphone permission through transcription, answer understanding, confirmation, assessment, spoken response, interruption, recovery, and session cleanup. This plan does not authorize clinical recommendations, dispensing, or deployment.

**Status baseline:** Based on the local project code and notes reviewed on 9 November 2026. Automated checks run during this review: `npm test`, `npm run check`, and `npm run test:journeys` passed. These establish software regression behavior only. They do not establish microphone accuracy, clinical correctness, privacy/legal compliance, or suitability for deployment.

---

## 1. Executive summary

PILLPAL already has a substantial voice foundation: a voice-first page, local Whisper and Piper integrations, browser speech fallback, optional Gemini paths, deterministic answer mapping, read-back confirmation, full warning prompts, text fallback, session cleanup, interruption handling, and diagnostics. The most important next step is **not adding more AI**. It is proving that a real person can complete the intended conversation safely and predictably on the actual kiosk hardware.

The highest priorities are:

1. Establish a **real-device voice acceptance baseline** for the selected microphone, speaker, room, browser, and language.
2. Improve **speech capture and transcript quality** for the words that can change a safety decision: age, symptom duration/severity, warning signs, pregnancy/breastfeeding, allergies, medicines, and medical conditions.
3. Make **uncertainty and repair** natural: show what was heard, ask a narrow clarification, and never silently convert low-confidence speech into a safety answer.
4. Ensure interruption, cancellation, language changes, silence, device loss, and network loss cannot skip a question, lose a warning, or apply a stale answer.
5. Make the experience genuinely usable without speech through equally visible, localized touch and text controls.
6. Support only languages and speech modes that have been explicitly validated; a language selector or an available ASR/TTS model is not evidence of clinical-language support.

Until these are done, treat the application as a research/demo prototype. Keep real medicine recommendations disabled without a clinically and legally reviewed catalogue and pathway. Do not connect dispensing hardware.

---

## 2. Current voice experience: verified observations

### Present in the code

- `web/voice.html` is the default voice-first page and provides a transcript drawer, text drawer, language control, microphone controls, mute and end controls, captions, and a diagnostics panel.
- `web/voice-assistant.js` coordinates voice capture and playback. `web/local-whisper-transcriber.js` captures audio and posts a WAV to the local server. `web/gemini-live-transcriber.js` implements an optional cloud live transcription route using short-lived tokens.
- Local TTS is served through `/api/tts`; the server can select configured Piper models by language. Browser speech synthesis and optional cloud paths exist as alternatives/fallbacks.
- `web/voice-input-mapper.js` deterministically maps speech to values for the currently displayed question. Optional answer understanding can help when deterministic matching fails.
- Interpreted or volunteered answers require read-back confirmation. The UI allows touch/text interaction while confirmation is pending.
- `web/assessment-speech.js` localizes prompts and includes all localized red flags. It splits long speech into chunks instead of truncating it at the TTS limit.
- Voice lifecycle tests cover cancellation, stale results, microphone permission timing, simulated barge-in, and interrupted warnings. Physical audio is not tested by those simulations.
- `web/voice-experience.js` displays online/offline state and exposes opt-in technical diagnostics. The implementation report says diagnostics avoid transcript text.
- Germany is the local deployment default. German and English are the implemented conversation languages; Hindi is a labelled preview/fallback path. Broader language choices must not be represented as fully supported solely because they appear in a selector.

### Important evidence gap

The implementation report states that no microphone permission was accepted during the browser checks. TTS returned valid WAV data, but audibility, microphone recognition, acoustic echo, clinical intelligibility, and the physical kiosk workflow remain unverified. Automated tests use mocked playback or simulated PCM and cannot fill this gap.

### Documentation caveat

Some repository status documents are older and describe a different architecture or feature state. Use the current code plus `docs/GERMANY_SAFETY_IMPLEMENTATION.md` and this plan as the working baseline; reconcile stale voice/security claims before using documentation as release evidence.

---

## 3. Product principles for voice

1. **Safety rules remain deterministic.** Speech recognition and language models may transcribe or map a response to a current allowed answer. They must not diagnose, decide eligibility, choose medicine, skip a safety question, or authorize dispensing.
2. **Uncertainty is a valid outcome.** When the system is unsure, ask again, offer touch/text, or refer according to clinician-approved rules. Never interpret silence, noise, or a low-confidence transcript as “no.”
3. **Confirm high-impact facts.** Confirm values that materially affect safety, especially age, medicine/allergy names, warning-sign answers, pregnancy/breastfeeding, and ambiguous multi-part answers. Clinical owners must define which facts need read-back.
4. **Keep warning content complete.** Do not interrupt a safety warning in a way that drops the unspoken remainder. If interrupted, resume the remaining content or present the complete warning visibly and repeat it on request.
5. **Voice is optional.** Every step must remain completable with touch or text. Users must be able to stop speaking, correct an answer, request repetition, or end the session.
6. **Be honest about privacy and connectivity.** Clearly distinguish local processing from optional external processing. Never imply “offline” if the assessment engine/catalogue or any required step depends on a network service.
7. **Language is a release capability, not a UI option.** Enable a voice/language combination only after speech, wording, safety content, TTS, fallback, and clinical review are independently validated.
8. **No raw audio or transcript retention by default.** Collect only the minimum operational data needed. Any research recording requires separate governance, consent, retention rules, access control, and ethics/legal approval.

---

## 4. Prioritized roadmap

Priority labels: **P0 = release blocker / do first**, **P1 = high value**, **P2 = later enhancement**. A task is complete only when its acceptance criteria are met and evidence is recorded.

### Phase 0 — Define the target voice product (P0)

**Why:** Hardware, environment, language, privacy mode, and intended user determine the right voice design. Optimizing an unspecified setup leads to false confidence.

**Work**

- Record the intended device model, OS, browser/version, display resolution, microphone/speaker/headset, microphone placement, room acoustics, expected ambient noise, and whether the device is shared/public.
- Decide supported jurisdiction and launch languages. For the initial Germany scope, define whether German is the only voice-supported language or whether English is also in scope. Keep Hindi marked preview unless fully validated.
- Decide whether any cloud speech or translation provider is allowed. Default to local speech processing where feasible; make cloud modes explicitly opt-in and disclose what is sent, to whom, for what purpose, and under which retention terms.
- Define the operating mode: push-to-talk, voice turn after explicit tap, or continuous listening. Do not introduce always-on listening or wake-word behavior without a dedicated privacy and safety assessment.
- Define the customer outcome for product-unavailable cases, emergency cues, microphone denial, and network loss. Use clinician-approved text and local emergency/service information.
- Document the distinction between **speech-supported**, **interface-translated**, and **clinically validated** languages.

**Acceptance criteria**

- A signed-off deployment profile lists the exact hardware/software/languages and allowed speech providers.
- Privacy notice and user-facing voice consent behavior are approved for each enabled provider and jurisdiction.
- The UI exposes no unsupported language as a fully supported voice option.

### Phase 1 — Real-device voice acceptance (P0)

**Why:** Current automated voice tests are simulated. This is the most important unresolved engineering evidence gap.

**Work**

- Build a repeatable acceptance protocol for quiet, typical, and noisy conditions at the kiosk's real placement.
- Use fictional scenarios and clinician-reviewed expected outcomes. Include accents, soft/fast speech, pauses, repeated words, self-correction, code-switching, background conversation, microphone distance variation, and speaker feedback.
- Run the entire conversation hands-free where intended, then repeat with touch/text recovery.
- Test cold start, first microphone permission, permission denial, permission revoked mid-session, unplugged/reconnected microphone, speaker unavailable/muted, browser tab backgrounding, sleep/wake, local server restart, Wi-Fi loss/recovery, and concurrent kiosk load.
- Measure performance by question type. A high overall word-accuracy score can conceal dangerous failures on negation, drug names, numbers, or red flags.
- Record only aggregate, non-identifying test outcomes. Do not retain real patient audio/transcripts as a shortcut.

**Metrics to collect**

- Task completion without operator help.
- Critical answer accuracy and critical fact error rate (age, negation, warning signs, pregnancy/breastfeeding, medicines/allergies).
- Correct abstention/clarification rate when speech is unclear.
- False advancement rate: any case where an incorrect or uncertain answer advances without required confirmation.
- Transcription latency p50/p95, turn-response latency p50/p95, and time to stop playback after interruption.
- No-speech/error rate, repeat rate, touch/text fallback rate, and abandonment rate.
- Warning prompt completeness and intelligibility, verified by listeners.

**Acceptance criteria**

- Clinical owner sets numeric thresholds before testing. Do not choose thresholds after observing results.
- Zero unconfirmed critical-answer errors in the release acceptance set. Every unsafe or unexplained case blocks release until root cause and regression test are documented.
- Full warning text is audible or visibly available; interrupted prompts resume/replay without omission.
- The device clearly shows when the microphone is active and reliably stops capture at session end.
- A hardware acceptance report is stored with device/browser/model versions, test conditions, results, failures, and sign-off.

### Phase 2 — Capture quality, turn-taking, and latency (P0/P1)

**Why:** Misheard speech is the main voice-specific risk. Current modules request browser echo cancellation/noise suppression and use energy thresholds, but code-level configuration does not prove acoustic performance.

**Work**

- Establish a robust audio pipeline for each supported browser. Verify actual sample rate, channel count, clipping, silence, resampling, and WAV headers on the kiosk hardware.
- Tune microphone gain/noise thresholds against recorded *test-only* acoustic conditions. Ensure background noise does not trigger false speech and soft speech is not discarded.
- Evaluate replacing deprecated `ScriptProcessorNode` with `AudioWorklet` when supported by the deployment browser; keep a tested fallback. Benchmark before adopting—the change is useful only if it improves stability/latency on target hardware.
- Add explicit voice activity states: ready, requesting permission, listening, speech detected, processing, confirming, speaking, interrupted, unavailable, and ended. State transitions must be driven by actual resources/results, not just visual timers.
- Add bounded timeouts and cancellation for each stage. A hung transcription or TTS request must resolve to an actionable retry/fallback rather than leaving the kiosk in “thinking.”
- For barge-in, measure acoustic echo and false interruptions with the real speaker/mic arrangement. Keep tap-to-interrupt as a reliable fallback. Do not claim full duplex if interruption is only a button action or a software simulation.
- Ensure TTS chunks preserve sentence boundaries and meaning. Avoid awkward chunk boundaries around negations, numbers, units, medicine names, and emergency warnings.
- Avoid overlapping Whisper, model inference, and TTS on constrained hardware; measure CPU/RAM/temperature during long sessions.

**Acceptance criteria**

- Measured p95 latency targets are agreed and met on the target device at the expected thermal state.
- Speech detection works across the approved noise/distance range with measured false-trigger and missed-speech rates.
- Interruption stops playback within an agreed measurable budget; the remaining message is resumed or replayable.
- All resources (microphone tracks, audio contexts, sockets, abort controllers, temp files) are closed/released after success, error, cancel, timeout, and end-session paths.

### Phase 3 — Safe answer understanding and conversational repair (P0)

**Why:** Correct recognition is not enough; the application must map it to the right question and recover safely when the answer is ambiguous or contains multiple facts.

**Work**

- Treat each transcript as a candidate answer to the **current question only**. Preserve current question IDs/revisions and server-owned state; never let transcript text choose or change the safety workflow.
- Keep deterministic mapping first. If optional model-based mapping is enabled, constrain it to the current question, current options, and numeric bounds; return a structured “not understood” result rather than guessing.
- Require explicit confirmation for any inferred value, volunteered fact, correction, or value with low confidence. Confidence thresholds should trigger clarification only—not authorize bypassing confirmation.
- Add a short, question-specific repair prompt: “I heard age 30. Is that right?” / “Was that yes or no?” / “Which medicine name did you say?” Avoid asking customers to repeat a long medical history.
- Detect and handle negation, correction, uncertainty, “I don’t know,” “prefer not to say,” multiple answers in one utterance, and a question from the user. Keep each response attached to the correct active question.
- For high-risk free text (medicine/ingredient/allergy names), echo the transcript and ask the user to confirm or use text/touch. Unknown medicine names must not be treated as no medicines or as a safe match.
- Add a visible “what I heard” caption. Provide a one-tap correction, repeat, and “use touch instead” action.
- Prevent duplicate turns: disable/guard repeated submits while processing, reject stale responses, and ignore late results after cancel, session restart, or language change.
- Define what happens when the user speaks while a safety prompt is playing. Positive or uncertain emergency answers should be handled immediately; any remaining warning content must still be made available.

**Acceptance criteria**

- Every accepted spoken answer can be traced to the active question and active session revision.
- Unclear/empty/unsupported answers do not mutate clinical state or advance the assessment.
- Confirm/correct actions are accessible by voice and touch, and correction restarts from a safe, deterministic state.
- Test coverage includes ambiguous numbers, compound answers, negation, corrections, drug-name uncertainty, interruption during each safety-critical prompt, and stale/cancelled asynchronous results in all release languages.

### Phase 4 — UX, accessibility, and trust (P1)

**Work**

- Make the microphone status obvious: active capture, muted/unavailable, and processing should not rely on color or animation alone. Add a persistent privacy indicator while audio capture is active.
- Keep the primary task and next action obvious on small kiosk viewports. Verify the noted short viewport issue and prevent clipping at the actual display resolution and browser zoom.
- Ensure text alternatives, transcript, answer buttons, repeat prompt, language selector, mute/end actions, and emergency/referral text are keyboard/touch accessible and have meaningful localized accessible names.
- Manage focus after each screen change and confirmation. Keep screen-reader live-region updates concise; do not announce long warning text twice while also preserving it visibly.
- Offer adjustable speech rate/volume within safe bounds, a repeat button, captions, and a non-audio path. Test mute behavior so important safety content remains clearly visible.
- Improve the opening: say who the assistant is, that it is not emergency care, that the user can stop or switch to touch, and whether audio is processed locally or externally. Keep it short and reviewed.
- Distinguish “connection to the server,” “catalogue readiness,” and “speech engine readiness.” Browser `navigator.onLine` alone does not establish backend or catalogue availability.
- Add a clear offline/unavailable message and recovery path. Do not say “connected” if the core assessment endpoint or speech service is unavailable.
- Use plain-language phrasing, one idea per question, explicit units, and concrete answer examples only when clinically reviewed.
- Avoid anthropomorphic claims that imply a clinician is listening or that the system understands more than it does.

**Acceptance criteria**

- All key flows can be completed by touch/text without microphone access.
- Small viewport, high zoom, keyboard-only, screen-reader, reduced-motion, and high-contrast checks pass for target environments.
- Every state has a localized visible status and a clear next action.

### Phase 5 — Language and voice quality governance (P0 for each language)

**Work**

- Start with a small, honest language set. German is the primary local language; enable English only when its full path is reviewed and acceptance-tested. Keep Hindi preview clearly separated from clinical release behavior until reviewed.
- For each language, validate ASR and TTS separately. Validate dialect/accent coverage, number/date phrasing, medicine names, units, negation, emergency terms, common code-switching, and user corrections.
- Do not rely on dynamic machine translation for questions, warnings, dose instructions, contraindications, or referrals without a clinician/translator review workflow and versioned approval.
- Create an approved phrase catalogue: opening, questions, examples, confirmations, error/retry messages, warnings, referral, no-product outcome, privacy explanation, and end-session text. Version it and test parity.
- Measure pronunciation and intelligibility of medicine/ingredient names and German compounds/numbers with native speakers. Provide spelling/display confirmation for uncertain names.
- For right-to-left languages, test directionality, punctuation, captions, mixed medicine names/Latin text, and accessible reading order—not just translated strings.
- Provide fallback behavior per language if local TTS is absent: visible text, user-selected browser voice only if tested, and an explicit announcement that speech output is unavailable.

**Acceptance criteria**

- A language is “voice-supported” only when a release checklist records native-speaker linguistic review, clinical review of all safety copy, speech accuracy evaluation, TTS intelligibility review, accessibility review, and real-device acceptance.
- No unsupported language silently falls back to a different language for safety-critical content.
- Product safety text is localized only from approved, versioned translations; otherwise the system does not present a potentially misunderstood recommendation.

### Phase 6 — Privacy, reliability, and operations (P1)

**Work**

- Publish a concise privacy explanation before microphone use: what is captured, local/cloud processing, retention, and how to continue without voice.
- Keep default audio/transcript storage off. Verify the browser, server, ASR provider, proxy, n8n, and model logs do not accidentally retain request bodies, transcripts, temporary WAVs, or tokens.
- Confirm temporary audio cleanup for every exit path, including server termination and process crashes. Add a startup cleanup policy for stale temporary WAVs with a strict allowlist and age limit.
- Bound TTS cache disk usage and concurrency; establish cleanup and operator monitoring. Avoid caching sensitive/free-text speech if it is ever introduced; prefer caching only fixed approved prompts.
- Define backend health checks for local ASR/TTS, session engine, catalogue trust/expiry, and network dependencies. Show actionable degraded states to the operator without exposing secrets or customer text.
- Add a watchdog/health report and a documented recovery procedure for failed microphone, ASR, TTS, server, network, and catalogue states.
- Pin speech/model/runtime versions and checksums. Record model, browser, application build, prompt/catalogue versions in acceptance evidence (not in patient-facing logs).
- Establish incident reporting and rollback procedures. Any unexpected recommendation, missed emergency cue, leaked transcript, or stale-session behavior is a release-blocking incident.

**Acceptance criteria**

- A privacy/data-flow review covers every audio and text hop, storage location, log, cache, and provider.
- Disk/resource use remains bounded during an extended endurance test.
- Operators can identify degraded readiness and recover using a documented procedure without reading source code.

### Phase 7 — Evaluation, release gates, and continuous tests (P0/P1)

**Work**

- Maintain separate test layers:
  1. deterministic engine/unit and journey regression;
  2. ASR transcript-to-answer mapping tests;
  3. audio pipeline tests with synthetic/test-only audio;
  4. real hardware voice acceptance;
  5. clinical case review and held-out safety evaluation;
  6. deployment parity checks.
- Create a versioned, consent/governance-approved test corpus with diverse speakers and controlled noise. Prefer a purpose-built test corpus; do not collect patient audio by default.
- Annotate expected transcript, critical facts, mapped answer, confirmation requirement, next state, and correct referral/abstention. Evaluate each language and question type separately.
- Add a compact voice regression dashboard/report with error categories and p50/p95 latency. Never collapse all quality into one WER or success score.
- Add CI to run `npm test`, `npm run check`, and `npm run test:journeys` on each change. Keep live tests/manual hardware acceptance in a separate release gate.
- Verify spoken prompt text against the localized safety contract, with checks for missing warnings, lost negation, missing options, number/unit changes, and fallback language.
- Require an explicit release checklist and sign-off from engineering, clinical, language, privacy/security, and kiosk operations owners.

**Acceptance criteria**

- CI is green and test report states exactly what was simulated versus physically tested.
- Held-out clinical/speech cases are not used to tune mappings and then reported as independent evaluation.
- No release proceeds with unresolved critical speech or safety failures.

---

## 5. Concrete voice scenarios that must be tested

Test each supported language, modality, and target device. Use fictional data only.

### Audio input and recognition

- Quiet, fan noise, shop/room conversation, speaker echo, microphone off-axis, close/far, soft/fast speech.
- Different age ranges, accents, voice pitch, speech disfluencies, pauses, repeated words, and non-native speakers.
- No speech, very short speech, background speech, clipped first word, clipped ending, and a recording at the capture-duration limit.
- Negation: “no allergies,” “I do take…,” “I don’t know,” “not pregnant,” “not that medicine.”
- Number confusions: ages around eligibility boundaries, teens, compound German numbers, “two ten,” numbers spoken with units, and corrections (“I’m 40—sorry, 30”).
- Medicine/ingredient names: brand/ingredient aliases, similar-sounding products, strengths, unfamiliar names, and unknown names.
- Code-switching only for languages where it is an explicit target. Do not treat accidental mixed-language recognition as validated support.

### Conversation and state

- User volunteers age, duration, allergy, medicine, or warning-sign information before being asked; confirm it and do not skip required questions.
- Multiple facts in one utterance; map only the relevant fact, preserve others only through the existing safe confirmed-context design.
- User asks a question instead of answering; answer only from approved content or state the limitation, then re-ask current question.
- User interrupts each warning, confirmation, referral, and result prompt; confirm immediate danger without delaying, then replay remaining safety instructions.
- User changes or retracts an answer after read-back; invalidate dependent conclusions and follow the intended restart/correction path.
- Repeated taps, double submits, stale response, cancellation, session expiry, server restart, and a new user arriving immediately after the prior session.

### Device, network, and recovery

- Permission prompt accepted/denied/ignored; permission revoked mid-session; microphone unplugged/reconnected.
- Speaker muted, volume too low, audio output device changed, TTS unavailable, and partial TTS chunk failure.
- Network disconnected before start, during transcription, during assessment request, or before optional cloud speech; restored network must not duplicate the turn.
- Server stops/restarts, catalogue missing/unsigned/expired, and local speech model missing.
- Browser refresh, tab hidden, screen lock, system sleep/wake, and long-running thermal load.

---

## 6. Recommended voice UX behavior

A dependable turn should follow a visible, recoverable state path:

1. **Ready:** tell the user how to begin and show that touch/text are available.
2. **Permission:** request microphone access only after a clear user action; explain how to continue if denied.
3. **Listening:** show a microphone-active indicator; show live/interim text only if it is reliable and privacy-reviewed.
4. **Processing:** indicate local or cloud processing accurately; allow cancel where safe.
5. **Interpretation:** show “I heard …” and the normalized answer, not just a spinner.
6. **Confirmation:** ask for confirmation when required. A non-answer, uncertain answer, or conflicting transcript leaves the state unchanged.
7. **Assessment:** send only a validated answer bound to the active question/session revision.
8. **Response:** speak and display the same approved response. Preserve warnings and meaning across TTS chunks.
9. **Recovery:** offer repeat, correct, touch/text, or start over; do not leave a dead-end error state.
10. **End:** stop tracks and playback, cancel pending jobs, clear transcript/session presentation, and confirm the microphone is no longer active.

Do not make continuous listening the default. Make button-driven listening and tap-to-interrupt reliable before pursuing hands-free turn-taking.

---

## 7. Architecture guidance

### Keep the safety boundary clear

- ASR produces text only.
- Answer mapping produces a candidate value for the active question only.
- Confirmation is required according to the clinically reviewed policy.
- The deterministic server/session engine owns state and controls progression.
- The deterministic clinical matcher uses only approved, country-specific release data.
- TTS reads approved content; it must not improvise or modify medical instructions.

### Avoid adding features that blur this boundary

Do not add an open-ended voice LLM that can decide the next question, interpret free-form symptoms into a diagnosis, generate a dose, recommend alternatives, or answer clinical questions from general knowledge. If a conversational model is used for transcription/answer mapping, constrain the output to an allowlisted schema and current screen, require confirmation, and test failures. Do not treat a confidence score as a clinical safety guarantee.

### Improve maintainability without overengineering

- Keep voice state transitions in a small explicit state machine; add transition tests instead of scattered independent booleans where that reduces invalid combinations.
- Use shared contracts for language, question ID, session ID/revision, transcription result, and error code across ASR, mapper, UI, and server.
- Standardize errors into categories: permission, unsupported browser, no speech, timeout, network, provider unavailable, invalid audio, transcript unusable, stale turn, and internal error.
- Add schema/version fields to diagnostics only where useful; avoid recording transcript text or secrets.
- Keep local and optional cloud providers behind the same tested transcription interface, with explicit capability/readiness metadata and no silent mode switching that changes privacy assumptions.

---

## 8. Suggested delivery backlog

### First sprint — proof and critical repair

1. Create the hardware/language/provider deployment profile.
2. Write and run the first real-device voice acceptance protocol for German and English if both are in scope.
3. Fix and verify the target viewport clipping issue on the actual screen.
4. Audit every status/error message for mic permission, no speech, network loss, unavailable voice, catalogue readiness, and session expiry.
5. Add targeted regression cases for number ambiguity, negation, medicine-name uncertainty, interrupted warnings, late responses after language/session change, and duplicate-submit behavior.
6. Produce a baseline metrics report; do not tune against a single overall accuracy number.

### Second sprint — reliability and privacy

1. Improve audio-worklet/capture behavior based on device evidence; keep fallback behavior.
2. Verify and bound cache/temp disk use and cleanup on crash/restart.
3. Add health/readiness reporting that separates server, ASR, TTS, network, and signed catalogue.
4. Verify privacy data flow, provider disclosure, logs, and retention.
5. Add CI for deterministic tests and workflow drift checks.

### Third sprint — approved language and accessibility

1. Review complete German and English spoken phrase sets with native speakers and clinical owner.
2. Improve correction flow and one-tap access to transcript/text/touch controls.
3. Conduct accessibility and short-viewport tests with intended kiosk users.
4. Consider another language only after a dedicated ASR/TTS/clinical-language test program is funded and approved.

### Later — only with evidence

- Acoustic barge-in/AEC beyond tap-to-interrupt.
- Push-to-talk physical button integration after hardware interface confirmation.
- Wake word or always-on listening only after separate privacy, consent, and false-trigger assessment.
- Additional languages, code-switching, or cloud speech only after language-specific release gates.

---

## 9. Release gates

A voice pilot must not start until all applicable gates are satisfied:

### Clinical and language

- Named clinical owner and documented scope.
- Reviewed questions, red flags, referral language, and all spoken safety text for each enabled language.
- Reviewed catalogue and product labels for the jurisdiction; no synthetic/reference-only record can authorize a real recommendation.
- Independent held-out cases and documented critical failure review.

### Voice and UI

- Real target hardware passed acceptance in the intended environment.
- Correct transcription/mapping/confirmation for critical facts meets pre-agreed criteria.
- No unconfirmed critical answer advances.
- Warning interruption/resumption preserves all safety content.
- Text/touch fallback, accessibility, viewport, and end-session cleanup pass.

### Privacy, security, and operations

- Approved data-flow/privacy/legal review for all enabled providers.
- No unapproved audio/transcript retention in browser, server, logs, proxy, n8n, or provider.
- Clear readiness/degraded-mode display, operator runbook, watchdog, rollback, and incident process.
- TLS and appropriate rate limiting/security controls for any network-exposed deployment.
- Local and deployed code/workflow/catalogue versions are confirmed and recorded.

### Explicit non-goals until separately approved

- Autonomous medicine dispensing.
- AI-generated diagnosis or dose instructions.
- Unsupported languages presented as clinically validated.
- Always-on microphone capture without separate governance.
- Real-product recommendations based only on software test fixtures or unsigned reference data.

---

## 10. Decision log template

Use this section to keep product choices explicit rather than embedded only in code.

| Decision | Owner | Decision / evidence | Date | Revisit date |
|---|---|---|---|---|
| Initial deployment hardware and browser |  |  |  |  |
| Initial supported voice languages |  |  |  |  |
| Local/cloud ASR policy |  |  |  |  |
| Whether live captions are shown |  |  |  |  |
| Push-to-talk vs hands-free behavior |  |  |  |  |
| Critical facts requiring read-back | Clinical owner |  |  |  |
| Audio/transcript retention policy | Privacy/security owner |  |  |  |
| Acceptance thresholds and held-out cases | Clinical + engineering |  |  |  |
| Pilot/rollback approval | Product + clinical + operations |  |  |  |

---

## 11. Final recommendation

Invest next in **evidence and recovery**, not more conversational AI: configure the intended kiosk, run a controlled real-microphone/speaker evaluation, measure errors on safety-critical phrases, improve clarification/correction, and validate warning playback through interruption and failure. Keep German as the primary release target, keep other languages clearly gated, make touch/text equally usable, and do not enable real product recommendations until clinical and legal owners approve the pathway and catalogue.
