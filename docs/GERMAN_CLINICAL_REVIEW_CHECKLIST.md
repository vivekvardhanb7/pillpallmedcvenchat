# German adult pain/fever pilot: clinical review checklist

Status: DRAFT — not clinical approval, prescribing guidance, or permission to dispense.
Scope proposed for review: adults, Germany deployment, German and English voice.
Current product recommendations remain blocked without approved German data.

## Decisions required from the clinical owner

- Name the responsible German pharmacist/clinician, qualifications, review date and next review date.
- Define the exact complaints covered by the first pathway. Do not treat all pain or all fever as equivalent.
- Define included populations and excluded populations, including pregnancy/breastfeeding, age boundaries and relevant medical histories.
- Specify required questions, urgent warning signs, uncertainty handling and referral destinations for each complaint.
- Specify symptom severity, duration and recurrence thresholds with authoritative sources. No thresholds in this draft are approved.
- Confirm when no medicine is appropriate and the wording explaining that outcome.
- Review the full existing engine against this specification; passing software tests does not validate its medicine logic.

## Required evidence for every candidate product

- German product identifier, exact name, formulation, strength, active ingredients and current market status.
- Licensed, maintained German product information and patient leaflet: source URL, version and date checked.
- Approved indication and eligible population; explicit contraindications, precautions, interaction checks and duplicate-ingredient checks.
- Reviewed dose, route, maximum daily amount, duration and stopping/referral instructions; preserve units exactly.
- Machine-sale/legal eligibility and stock/slot mapping, reviewed separately from clinical eligibility.
- Reviewer identity, approval decision, expiry/review date and the evidence supporting it.
- Missing data or an unidentified existing medicine must block product eligibility pending clarification or professional review.

## German and English language review

- Review every question, warning, confirmation, recommendation and referral message in both languages.
- Confirm medicine-name/ingredient mappings; require clarification for uncertain brands or strengths.
- Test negation, corrections, uncertain answers, accents, mixed-language speech and noisy recordings.
- Confirm that language selection never changes the German jurisdiction or clinical outcome for equivalent facts.
- Do not advertise additional languages as clinically supported until separately validated.

## Independent validation and release decision

- Create clinician-labelled cases with expected eligible products or referral, reasons and critical facts.
- Include eligible cases, each exclusion, interaction/duplicate cases, emergency cases and unsupported complaints.
- Keep a held-out set separate from development examples. Record dataset, model, prompt, engine and catalogue versions.
- Measure unsafe recommendations, missed referrals, critical fact errors, correct abstention and voice latency separately.
- Clinical owner sets acceptance criteria before evaluation; investigate every critical failure rather than relying on average accuracy.
- Begin with a supervised pilot in which the pharmacist reviews recommendations before users act on them.
- Record medical-device classification assessment, applicable deployment requirements and health-data handling review.
- Sign off each release; define rollback and incident review procedures. Software approval flags alone are not evidence of this review.

## Laptop voice acceptance (still requires live evidence)

Use fictional symptoms. Confirm audible prompts, correct transcripts, natural follow-ups and complete warning playback in German and English.
Test interrupt, correction, silence, denied permission, end-session during recording/transcription and a fresh customer session.
Verify the microphone indicator clears at session end and stale responses cannot restart the conversation.
Automated mocked-audio tests are regression evidence only; they do not establish microphone quality or clinical accuracy.
