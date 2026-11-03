export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', speech: 'en-US' },
  { code: 'de', label: 'Deutsch', short: 'DE', speech: 'de-DE' },
];

export const DEFAULT_LANGUAGE = 'en';

export const STRINGS = {
  en: {
    app: {
      eyebrow: 'Smart medicine vending assistant',
      researchMode: 'Research mode',
      tapToStart: 'Tap to Start',
      tapToSpeak: 'Tap to speak',
      voiceAssistant: 'Voice assistant',
    },
    voice: {
      readyWhenYouAre: 'Ready when you are',
      readyForAnswer: 'Ready for your answer',
      sessionComplete: 'Assessment complete',
      listening: 'Listening…',
      speaking: 'Speaking…',
      thinking: 'Checking your answer…',
      inputUnavailable: 'Voice input unavailable — touch remains active',
      outputUnavailable: 'Voice is not available for this language. Text is shown instead.',
      tapToStop: 'Listening… tap to stop',
      unavailableLabel: 'Voice input unavailable',
      on: 'Voice on',
      off: 'Voice off',
      mute: 'Mute voice',
      enable: 'Enable voice',
      micDenied: 'Microphone permission was not granted. You can continue with touch controls.',
      recognitionError: 'Voice recognition error: {error}',
    },
    theme: {
      dark: 'Dark',
      light: 'Light',
      switchToLight: 'Switch to light mode',
      switchToDark: 'Switch to dark mode',
    },
    language: {
      label: 'Language',
    },
    progress: {
      aria: 'Assessment progress',
      symptoms: 'Symptoms',
      safety: 'Safety',
      history: 'Medical history',
      review: 'Review',
    },
    welcome: {
      eyebrow: 'Voice + chat + touch',
      title: 'Private, guided medicine screening',
      body: 'Tap the start button above. You can speak, type, or touch an option throughout the assessment.',
    },
    session: {
      readyTitle: 'Session ready',
      clearMessage: 'Your session has been cleared for privacy. Tap to start a new assessment.',
      inactivity: 'The kiosk was idle, so your session was cleared for privacy. Tap to start a new assessment.',
    },
    confirm: {
      eyebrow: 'Confirm your answer',
      correct: 'Correct',
      change: 'Change',
    },
    chat: {
      repeat: 'Repeat the question',
      typeLabel: 'Type your answer',
      placeholderDefault: 'Type your answer…',
      typeAge: 'Type your age…',
      placeholderOption: 'Type an option or describe your answer…',
      completeStep: 'Complete the current step…',
      startToChat: 'Start the assessment to chat…',
      send: 'Send',
      heard: 'I heard',
      understood: 'I understood',
      isCorrect: 'Is that correct?',
      againPrompt: 'Okay. Please say, type, or choose your answer again.',
      correctAnswer: 'Correct',
      changeAnswer: 'Change answer',
    },
    transcript: {
      live: 'Live transcript',
      title: 'Conversation',
      empty: 'The conversation will appear here after you start.',
      listening: 'Listening: {text}',
      aria: 'Live conversation transcript',
    },
    role: {
      assistant: 'MedAssist',
      user: 'You',
    },
    avatar: {
      assistant: 'AI',
      user: 'You',
    },
    actions: {
      startOver: 'Start over',
      endSession: 'End session',
    },
    footer: {
      note: 'Voice processing depends on browser support. No medicine is dispensed by this research version.',
    },
    speech: {
      label: 'Speak · type · or touch',
      interactionHint: 'You can speak, type, or choose an option.',
      optionsAre: 'Options are: {options}.',
      product: 'Product: {name}.',
      assessmentCompleted: 'Assessment completed.',
      inputGuidance: 'Use the chat field below or tap the microphone to answer.',
      numberNotIdentified: 'I could not identify a number. Please say or type your age as a number.',
      answerNotMatched: 'I could not match that answer. Please say, type, or touch one of the displayed options.',
      greeting: 'Hello, how can I help you today?',
      retry: 'Try again',
    },
    loading: {
      checking: 'Checking your answer…',
      starting: 'Starting a new assessment…',
    },
    error: {
      connectionLabel: 'Connection problem',
      connectionTitle: 'The chatbot workflow could not be reached',
      connectionHint: 'Confirm that n8n is running, the workflow is active, and web/config.js contains the correct production webhook URL.',
      authHint: 'The kiosk key does not match the n8n credential. Check webhookSecret in web/config.js and the Header Auth value in n8n, then reload this page.',
      workflowHint: 'n8n responded with an error. Check that the workflow is active and its nodes ran without errors.',
      networkHint: 'n8n is unreachable. Check the webhook URL in web/config.js and that the server is running.',
      secretMissingHint: 'No kiosk key is configured. Set webhookSecret in web/config.js to the n8n Header Auth value, then reload this page.',
      workflow: 'The chatbot workflow could not be reached. {message}',
    },
    setup: {
      prefix: 'SETUP:',
      configUpdated: 'CONFIG UPDATED — reload this page to apply',
      aiNotUsable: 'the spoken-answer helper is configured but not usable (missing API key or unknown provider). Voice input still works with the standard answers.',
      dismiss: 'Dismiss notice',
    },
    clarify: {
      severity: 'Mild means manageable and not strongly limiting normal activity. Moderate means clearly uncomfortable or limiting some activity. Severe means intense or strongly limiting normal activity. Choose the closest option.',
      age: 'Age is required because medicine eligibility and safety restrictions can differ by age. This research pathway currently refers patients under eighteen for professional advice.',
      allergy: 'Medicine allergies are checked against approved product ingredients before any product can be shown.',
      medicine: 'Current medicines are checked against approved interaction rules before any product can be shown.',
      condition: 'Ongoing health conditions may make some products unsuitable, so they are checked against approved contraindication rules.',
      generic: 'I can explain the current question, but I cannot diagnose symptoms. Please answer using the displayed choices, voice, or chat.',
    },
    pharmacy: {
      purposeQuestion: 'What do you need it for?',
      purposeProceed: 'Let me run a quick safety check.',
      caution: 'It is not suitable for everyone, so I will ask a few quick safety questions.',
      uses: {
        paracetamol: 'Paracetamol is commonly used for mild to moderate pain and fever.',
        ibuprofen: 'Ibuprofen is commonly used for pain, fever and inflammation.',
        aspirin: 'Aspirin is used for pain and fever. Regular low-dose use needs medical advice.',
        loperamide: 'Loperamide is used for the short-term relief of acute diarrhoea.',
        cetirizine: 'Cetirizine is an antihistamine used for allergy symptoms such as hay fever.',
      },
    },
    question: {
      symptom: {
        title: 'What would you like help with?',
        subtitle: 'Choose the closest option. This is not a diagnosis.',
      },
      age: {
        title: 'What is your age?',
        subtitle: 'Enter age in completed years.',
      },
      duration: {
        title: 'How long have you had this symptom?',
      },
      severity: {
        title: 'How severe is it right now?',
      },
      warning_signs: {
        title: 'Do any serious warning signs apply?',
        subtitle: 'Examples include trouble breathing, chest pressure, fainting, confusion, significant bleeding, a sudden extreme symptom, or being unable to keep fluids down. This general list is not a complete pathway-specific clinical screen.',
        pain_fever: {
          subtitle: 'Check whether any of these apply to you right now: a stiff neck with sensitivity to light, or a rash that does not fade when you press a glass on it; confusion, fainting, or difficulty staying awake; trouble breathing, chest pain or pressure; a sudden severe headache unlike any you have had before; fever above 39.5 C, or fever that does not come down after medicine; a weakened immune system (chemotherapy, transplant, long-term steroids) or pregnancy. If you are unsure, choose "I am not sure".',
        },
      },
      pregnancy_breastfeeding: {
        title: 'Are you pregnant or breastfeeding?',
      },
      allergy_status: {
        title: 'Do you have any medicine allergies?',
      },
      allergy_terms: {
        title: 'Which medicines or ingredients are you allergic to?',
        subtitle: 'Separate multiple entries with commas.',
        placeholder: 'Example: ibuprofen, aspirin',
      },
      medication_status: {
        title: 'Are you currently taking any medicines?',
        subtitle: 'Include prescription and non-prescription medicines.',
      },
      medication_terms: {
        title: 'Which medicines are you taking?',
        subtitle: 'Separate multiple entries with commas.',
        placeholder: 'Enter medicine names',
      },
      condition_status: {
        title: 'Do you have any ongoing medical conditions?',
      },
      condition_terms: {
        title: 'Which medical conditions do you have?',
        subtitle: 'Separate multiple entries with commas.',
        placeholder: 'Enter conditions',
      },
      confirm: {
        title: 'Please confirm your answers',
      },
    },
    option: {
      symptom: {
        pain_fever: 'Headache, pain or fever',
        cold_cough: 'Cold or cough',
        allergy: 'Allergy',
        diarrhoea: 'Diarrhoea',
        heartburn: 'Heartburn or stomach discomfort',
        skin_minor_wound: 'Skin or minor wound',
        other: 'Other symptom',
      },
      duration: {
        today: 'Started today',
        '1_to_2_days': '1–2 days',
        '3_to_7_days': '3–7 days',
        more_than_7_days: 'More than 7 days',
      },
      severity: {
        mild: 'Mild',
        moderate: 'Moderate',
        severe: 'Severe',
      },
      warning_signs: {
        no: 'No, none of these',
        yes: 'Yes, one or more',
        not_sure: 'I am not sure',
      },
      pregnancy_breastfeeding: {
        pregnant: 'Pregnant',
        breastfeeding: 'Breastfeeding',
        both: 'Both',
        no: 'No',
        not_applicable: 'Not applicable',
        prefer_not_to_say: 'Prefer not to say',
      },
      allergy_status: { no: 'No', yes: 'Yes', not_sure: 'Not sure' },
      medication_status: { no: 'No', yes: 'Yes', not_sure: 'Not sure' },
      condition_status: { no: 'No', yes: 'Yes', not_sure: 'Not sure' },
      confirm: {
        yes: 'Confirm and check products',
        no: 'Start again',
      },
    },
    pathway: {
      pain_fever: 'Headache, pain or fever',
      cold_cough: 'Cold or cough',
      allergy: 'Allergy',
      diarrhoea: 'Diarrhoea',
      heartburn: 'Heartburn or stomach discomfort',
      skin_minor_wound: 'Skin or minor wound',
      other: 'Other symptom',
    },
    result: {
      label: {
        immediate: 'Immediate medical care',
        referral: 'Clinic referral',
        noProduct: 'No suitable product',
        eligible: 'Approved product found',
        generic: 'Assessment result',
      },
      title: {
        immediate: 'Medical care is needed',
        referral: 'No automatic recommendation',
        noProduct: 'No suitable approved product',
        completed: 'Assessment completed',
      },
      message: {
        immediate: 'This may require immediate medical attention. Please seek care at the nearest emergency department or clinic.',
        severe: 'This machine cannot recommend a medicine for a severe symptom. Please visit a nearby clinic or doctor.',
        under18: 'The current automated assessment is limited to adults aged 18 or older. Please visit a nearby clinic, doctor or pharmacy for advice.',
        duration: 'The symptom has lasted longer than the current self-care pathway supports. Please visit a nearby clinic or doctor.',
        pregnancy: 'This machine cannot automatically recommend a medicine during pregnancy or breastfeeding, or when this information is uncertain. Please visit a nearby clinic, doctor or pharmacy for advice.',
        history: 'More certain allergy, medicine and health-condition information is required. Please visit a nearby clinic, doctor or pharmacy for advice.',
        sessionLimit: 'The assessment session limit was reached. Please visit a nearby clinic, doctor or pharmacy for advice.',
        unsupported: 'This symptom is outside the currently supported pathways. Please visit a nearby clinic, doctor or pharmacy for advice.',
        catalogUnavailable: 'The approved product catalogue is temporarily unavailable. No medicine can be recommended. Please visit a nearby clinic, doctor or pharmacy for advice.',
        noApprovedProduct: 'No clinically and legally approved product is currently enabled for this symptom pathway. Please visit a nearby clinic, doctor or pharmacy for advice.',
        allBlocked: 'The available approved products did not pass all safety checks. Please visit a nearby clinic, doctor or pharmacy for advice.',
        ageOutsideRange: 'The approved products for this symptom are suitable for a different age range than the age you entered. Please visit a nearby clinic, doctor or pharmacy for advice.',
        pathwayNotServiced: 'This machine does not yet offer a supported self-care pathway for that symptom, so a pharmacist or doctor should assess it. Please visit a nearby clinic, doctor or pharmacy.',
        symptomTooLong: 'You have had this symptom longer than these products are approved for self-treatment. Taking them now could mask a condition that needs assessment. Please visit a nearby clinic, doctor or pharmacy for advice.',
        eligible: 'An approved product matched the completed safety assessment. Review the product information before continuing.',
      },
      strength: 'Strength',
      form: 'Form',
      instructions: 'Approved instructions',
      openLabel: 'Open approved product information',
      restart: 'Start a new assessment',
      seeLabel: 'See approved label',
      seeLocalLabel: 'See approved local product label',
    },
    summary: {
      symptom_category: 'Symptom category',
      age: 'Age',
      duration: 'Duration',
      severity: 'Severity',
      warning_signs: 'Warning signs',
      pregnancy_or_breastfeeding: 'Pregnancy or breastfeeding',
      allergies: 'Allergies',
      medicines: 'Medicines',
      conditions: 'Conditions',
      noneReported: 'None reported',
      notProvided: 'Not provided',
      notAsked: 'Not asked',
      reported: 'Reported',
      notSure: 'Not sure',
    },
  },

  de: {
    app: {
      eyebrow: 'Intelligenter Medikamenten-Automat',
      researchMode: 'Forschungsmodus',
      tapToStart: 'Zum Starten tippen',
      tapToSpeak: 'Zum Sprechen tippen',
      voiceAssistant: 'Sprachassistent',
    },
    voice: {
      readyWhenYouAre: 'Bereit, wenn Sie es sind',
      readyForAnswer: 'Bereit für Ihre Antwort',
      sessionComplete: 'Prüfung abgeschlossen',
      listening: 'Ich höre zu…',
      speaking: 'Ich spreche…',
      thinking: 'Antwort wird geprüft…',
      inputUnavailable: 'Spracheingabe nicht verfügbar – Berührung bleibt aktiv',
      outputUnavailable: 'Die Stimme ist für diese Sprache nicht verfügbar. Stattdessen wird der Text angezeigt.',
      tapToStop: 'Ich höre zu… zum Beenden tippen',
      unavailableLabel: 'Spracheingabe nicht verfügbar',
      on: 'Stimme an',
      off: 'Stimme aus',
      mute: 'Stimme stummschalten',
      enable: 'Stimme aktivieren',
      micDenied: 'Mikrofonzugriff wurde nicht erlaubt. Sie können mit den Berührungsfeldern fortfahren.',
      recognitionError: 'Spracherkennungsfehler: {error}',
    },
    theme: {
      dark: 'Dunkel',
      light: 'Hell',
      switchToLight: 'Zum hellen Modus wechseln',
      switchToDark: 'Zum dunklen Modus wechseln',
    },
    language: {
      label: 'Sprache',
    },
    progress: {
      aria: 'Fortschritt der Prüfung',
      symptoms: 'Symptome',
      safety: 'Sicherheit',
      history: 'Krankengeschichte',
      review: 'Überprüfung',
    },
    welcome: {
      eyebrow: 'Sprache + Chat + Berührung',
      title: 'Private, geführte Medikamentenprüfung',
      body: 'Tippen Sie oben auf Start. Sie können während der gesamten Prüfung sprechen, tippen oder eine Option berühren.',
    },
    session: {
      readyTitle: 'Sitzung bereit',
      clearMessage: 'Ihre Sitzung wurde zum Schutz Ihrer Privatsphäre gelöscht. Tippen Sie, um eine neue Prüfung zu starten.',
      inactivity: 'Der Kiosk war inaktiv, daher wurde Ihre Sitzung zum Schutz Ihrer Privatsphäre gelöscht. Tippen Sie, um eine neue Prüfung zu starten.',
    },
    confirm: {
      eyebrow: 'Antwort bestätigen',
      correct: 'Richtig',
      change: 'Ändern',
    },
    chat: {
      repeat: 'Frage wiederholen',
      typeLabel: 'Antwort eingeben',
      placeholderDefault: 'Antwort eingeben…',
      typeAge: 'Alter eingeben…',
      placeholderOption: 'Option eingeben oder Antwort beschreiben…',
      completeStep: 'Schließen Sie den aktuellen Schritt ab…',
      startToChat: 'Starten Sie die Prüfung, um zu chatten…',
      send: 'Senden',
      heard: 'Ich habe gehört',
      understood: 'Ich habe verstanden',
      isCorrect: 'Ist das richtig?',
      againPrompt: 'Okay. Bitte sagen, tippen oder wählen Sie Ihre Antwort erneut.',
      correctAnswer: 'Richtig',
      changeAnswer: 'Antwort ändern',
    },
    transcript: {
      live: 'Live-Transkript',
      title: 'Gespräch',
      empty: 'Das Gespräch erscheint hier, sobald Sie starten.',
      listening: 'Ich höre: {text}',
      aria: 'Live-Gesprächstranskript',
    },
    role: {
      assistant: 'MedAssist',
      user: 'Sie',
    },
    avatar: {
      assistant: 'AI',
      user: 'Sie',
    },
    actions: {
      startOver: 'Neu starten',
      endSession: 'Sitzung beenden',
    },
    footer: {
      note: 'Die Sprachverarbeitung hängt von der Browserunterstützung ab. In dieser Forschungsversion wird kein Medikament ausgegeben.',
    },
    speech: {
      label: 'Sprechen · tippen · oder berühren',
      interactionHint: 'Sie können sprechen, tippen oder eine Option wählen.',
      optionsAre: 'Optionen sind: {options}.',
      product: 'Produkt: {name}.',
      assessmentCompleted: 'Prüfung abgeschlossen.',
      inputGuidance: 'Verwenden Sie das Chatfeld unten oder tippen Sie auf das Mikrofon, um zu antworten.',
      numberNotIdentified: 'Ich konnte keine Zahl erkennen. Bitte sagen oder tippen Sie Ihr Alter als Zahl.',
      answerNotMatched: 'Ich konnte diese Antwort nicht zuordnen. Bitte sagen, tippen oder berühren Sie eine der angezeigten Optionen.',
      greeting: 'Hallo! Wie kann ich Ihnen heute helfen?',
      retry: 'Erneut versuchen',
    },
    loading: {
      checking: 'Antwort wird geprüft…',
      starting: 'Neue Prüfung wird gestartet…',
    },
    error: {
      connectionLabel: 'Verbindungsproblem',
      connectionTitle: 'Die Chatbot-Workflow-Verbindung konnte nicht hergestellt werden',
      connectionHint: 'Stellen Sie sicher, dass n8n läuft, der Workflow aktiv ist und web/config.js die richtige Produktions-Webhook-URL enthält.',
      authHint: 'Der Kiosk-Schlüssel passt nicht zum n8n-Credential. Prüfen Sie webhookSecret in web/config.js und den Header-Auth-Wert in n8n und laden Sie diese Seite neu.',
      workflowHint: 'n8n hat mit einem Fehler geantwortet. Prüfen Sie, ob der Workflow aktiv ist und seine Knoten ohne Fehler gelaufen sind.',
      networkHint: 'n8n ist nicht erreichbar. Prüfen Sie die Webhook-URL in web/config.js und ob der Server läuft.',
      secretMissingHint: 'Kein Kiosk-Schlüssel konfiguriert. Setzen Sie webhookSecret in web/config.js auf den Header-Auth-Wert aus n8n und laden Sie diese Seite neu.',
      workflow: 'Der Chatbot-Workflow konnte nicht erreicht werden. {message}',
    },
    setup: {
      prefix: 'EINRICHTUNG:',
      configUpdated: 'KONFIGURATION AKTUALISIERT – bitte laden Sie diese Seite neu, um sie anzuwenden',
      aiNotUsable: 'die Sprachantwort-Erkennung ist eingerichtet, aber nicht nutzbar (fehlender API-Schlüssel oder unbekannter Anbieter). Spracheingabe funktioniert weiterhin mit den Standardantworten.',
      dismiss: 'Hinweis schließen',
    },
    clarify: {
      severity: 'Leicht bedeutet handhabbar und die normale Aktivität nicht stark einschränkend. Mittel bedeutet deutlich unangenehm oder die Aktivität teilweise einschränkend. Schwer bedeutet intensiv oder die normale Aktivität stark einschränkend. Wählen Sie die passendste Option.',
      age: 'Das Alter ist erforderlich, da die Zulassung von Medikamenten und Sicherheitsbeschränkungen je nach Alter unterschiedlich sein können. Dieser Forschungspfad verweist Patienten unter achtzehn Jahren derzeit an eine fachliche Beratung.',
      allergy: 'Medikamentenallergien werden vor der Anzeige eines Produkts mit den zugelassenen Inhaltsstoffen abgeglichen.',
      medicine: 'Aktuelle Medikamente werden vor der Anzeige eines Produkts mit den zugelassenen Wechselwirkungsregeln abgeglichen.',
      condition: 'Bestehende Erkrankungen können manche Produkte ungeeignet machen und werden daher mit den zugelassenen Kontraindikationsregeln abgeglichen.',
      generic: 'Ich kann die aktuelle Frage erklären, aber keine Symptome diagnostizieren. Bitte antworten Sie über die angezeigten Optionen, per Sprache oder im Chat.',
    },
    pharmacy: {
      purposeQuestion: 'Wofür benötigen Sie es?',
      purposeProceed: 'Ich führe eine kurze Sicherheitsprüfung durch.',
      caution: 'Es ist nicht für jeden geeignet, daher stelle ich ein paar kurze Sicherheitsfragen.',
      uses: {
        paracetamol: 'Paracetamol wird häufig bei leichten bis mäßigen Schmerzen und Fieber verwendet.',
        ibuprofen: 'Ibuprofen wird häufig bei Schmerzen, Fieber und Entzündungen verwendet.',
        aspirin: 'Aspirin wird bei Schmerzen und Fieber verwendet. Eine regelmäßige Einnahme in niedriger Dosis erfordert ärztlichen Rat.',
        loperamide: 'Loperamid wird zur kurzfristigen Behandlung von akutem Durchfall verwendet.',
        cetirizine: 'Cetirizin ist ein Antihistaminikum gegen Allergiesymptome wie Heuschnupfen.',
      },
    },
    question: {
      symptom: {
        title: 'Womit können wir Ihnen helfen?',
        subtitle: 'Wählen Sie die passendste Option. Dies ist keine Diagnose.',
      },
      age: {
        title: 'Wie alt sind Sie?',
        subtitle: 'Geben Sie Ihr Alter in vollendeten Jahren ein.',
      },
      duration: {
        title: 'Seit wann haben Sie dieses Symptom?',
      },
      severity: {
        title: 'Wie stark ist es gerade?',
      },
      warning_signs: {
        title: 'Treffen ernste Warnzeichen zu?',
        subtitle: 'Beispiele sind Atemnot, Brustdruck, Ohnmacht, Verwirrtheit, stärkere Blutungen, ein plötzlich extremes Symptom oder die Unfähigkeit, Flüssigkeit bei sich zu behalten. Diese allgemeine Liste ist keine vollständige klinische Prüfung für jeden Pfad.',
        pain_fever: {
          subtitle: 'Prüfen Sie, ob eines dieser Anzeichen gerade auf Sie zutrifft: Nackensteifigkeit mit Lichtempfindlichkeit oder ein Hautausschlag, der beim Drücken eines Glases nicht verblasst; Verwirrtheit, Ohnmacht oder Schwierigkeiten, wach zu bleiben; Atemnot, Brustschmerz oder Druckgefühl; ein plötzlicher sehr starker Kopfschmerz, wie Sie ihn noch nie hatten; Fieber über 39,5 °C oder Fieber, das nach Medikamenteneinnahme nicht sinkt; ein geschwächtes Abwehrsystem (Chemotherapie, Transplantation, langfristige Kortikosteroide) oder Schwangerschaft. Wenn Sie unsicher sind, wählen Sie "Ich bin unsicher".',
        },
      },
      pregnancy_breastfeeding: {
        title: 'Sind Sie schwanger oder stillen Sie?',
      },
      allergy_status: {
        title: 'Haben Sie Medikamentenallergien?',
      },
      allergy_terms: {
        title: 'Gegen welche Medikamente oder Inhaltsstoffe sind Sie allergisch?',
        subtitle: 'Trennen Sie mehrere Einträge durch Kommas.',
        placeholder: 'Beispiel: Ibuprofen, Aspirin',
      },
      medication_status: {
        title: 'Nehmen Sie derzeit Medikamente ein?',
        subtitle: 'Einschließlich verschreibungspflichtiger und rezeptfreier Medikamente.',
      },
      medication_terms: {
        title: 'Welche Medikamente nehmen Sie ein?',
        subtitle: 'Trennen Sie mehrere Einträge durch Kommas.',
        placeholder: 'Medikamentennamen eingeben',
      },
      condition_status: {
        title: 'Haben Sie chronische Erkrankungen?',
      },
      condition_terms: {
        title: 'Welche Erkrankungen haben Sie?',
        subtitle: 'Trennen Sie mehrere Einträge durch Kommas.',
        placeholder: 'Erkrankungen eingeben',
      },
      confirm: {
        title: 'Bitte bestätigen Sie Ihre Antworten',
      },
    },
    option: {
      symptom: {
        pain_fever: 'Kopfschmerzen, Schmerzen oder Fieber',
        cold_cough: 'Erkältung oder Husten',
        allergy: 'Allergie',
        diarrhoea: 'Durchfall',
        heartburn: 'Sodbrennen oder Magenbeschwerden',
        skin_minor_wound: 'Haut oder kleine Wunde',
        other: 'Anderes Symptom',
      },
      duration: {
        today: 'Heute begonnen',
        '1_to_2_days': '1–2 Tage',
        '3_to_7_days': '3–7 Tage',
        more_than_7_days: 'Mehr als 7 Tage',
      },
      severity: {
        mild: 'Leicht',
        moderate: 'Mittel',
        severe: 'Schwer',
      },
      warning_signs: {
        no: 'Nein, keines davon',
        yes: 'Ja, eines oder mehrere',
        not_sure: 'Ich bin nicht sicher',
      },
      pregnancy_breastfeeding: {
        pregnant: 'Schwanger',
        breastfeeding: 'Stillend',
        both: 'Beides',
        no: 'Nein',
        not_applicable: 'Nicht zutreffend',
        prefer_not_to_say: 'Keine Angabe',
      },
      allergy_status: { no: 'Nein', yes: 'Ja', not_sure: 'Nicht sicher' },
      medication_status: { no: 'Nein', yes: 'Ja', not_sure: 'Nicht sicher' },
      condition_status: { no: 'Nein', yes: 'Ja', not_sure: 'Nicht sicher' },
      confirm: {
        yes: 'Bestätigen und Produkte prüfen',
        no: 'Neu starten',
      },
    },
    pathway: {
      pain_fever: 'Kopfschmerzen, Schmerzen oder Fieber',
      cold_cough: 'Erkältung oder Husten',
      allergy: 'Allergie',
      diarrhoea: 'Durchfall',
      heartburn: 'Sodbrennen oder Magenbeschwerden',
      skin_minor_wound: 'Haut oder kleine Wunde',
      other: 'Anderes Symptom',
    },
    result: {
      label: {
        immediate: 'Sofortige medizinische Hilfe',
        referral: 'Kliniküberweisung',
        noProduct: 'Kein geeignetes Produkt',
        eligible: 'Zugelassenes Produkt gefunden',
        generic: 'Prüfungsergebnis',
      },
      title: {
        immediate: 'Ärztliche Hilfe erforderlich',
        referral: 'Keine automatische Empfehlung',
        noProduct: 'Kein geeignetes zugelassenes Produkt',
        completed: 'Prüfung abgeschlossen',
      },
      message: {
        immediate: 'Dies kann eine sofortige medizinische Behandlung erfordern. Bitte suchen Sie umgehend die nächste Notaufnahme oder Klinik auf.',
        severe: 'Dieser Automat kann bei einem schweren Symptom kein Medikament empfehlen. Bitte suchen Sie eine nahe gelegene Klinik oder einen Arzt auf.',
        under18: 'Die automatisierte Prüfung ist derzeit auf Erwachsene ab 18 Jahren beschränkt. Bitte wenden Sie sich an eine nahe gelegene Klinik, einen Arzt oder eine Apotheke.',
        duration: 'Das Symptom dauert länger, als der aktuelle Selbsthilfe-Pfad unterstützt. Bitte suchen Sie eine nahe gelegene Klinik oder einen Arzt auf.',
        pregnancy: 'Dieser Automat kann während der Schwangerschaft oder Stillzeit bzw. bei unsicherer Angabe kein Medikament automatisch empfehlen. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        history: 'Es werden genauere Angaben zu Allergien, Medikamenten und Gesundheitszuständen benötigt. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        sessionLimit: 'Das Sitzungslimit der Prüfung wurde erreicht. Bitte suchen Sie eine nahe gelegene Klinik, einen Arzt oder eine Apotheke auf.',
        unsupported: 'Dieses Symptom liegt außerhalb der derzeit unterstützten Pfade. Bitte suchen Sie eine nahe gelegene Klinik, einen Arzt oder eine Apotheke auf.',
        catalogUnavailable: 'Der Katalog zugelassener Produkte ist vorübergehend nicht verfügbar. Es kann kein Medikament empfohlen werden. Bitte suchen Sie eine nahe gelegene Klinik, einen Arzt oder eine Apotheke auf.',
        noApprovedProduct: 'Für diesen Symptompfad ist derzeit kein klinisch und rechtlich zugelassenes Produkt freigeschaltet. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        allBlocked: 'Die verfügbaren zugelassenen Produkte haben nicht alle Sicherheitsprüfungen bestanden. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        ageOutsideRange: 'Die zugelassenen Produkte für dieses Symptom passen zu einer anderen Altersgruppe als dem von Ihnen angegebenen Alter. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        pathwayNotServiced: 'Dieses Gerät bietet für dieses Symptom noch keinen unterstützten Selbstbehandlungspfad an, daher sollte eine Apothekerin oder ein Arzt es beurteilen. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        symptomTooLong: 'Sie haben dieses Symptom länger, als für diese Produkte zur Selbstbehandlung zugelassen ist. Eine Einnahme jetzt könnte eine Erkrankung verdecken, die abgeklärt werden muss. Bitte suchen Sie eine Klinik, einen Arzt oder eine Apotheke auf.',
        eligible: 'Ein zugelassenes Produkt passt zur abgeschlossenen Sicherheitsprüfung. Prüfen Sie die Produktinformationen, bevor Sie fortfahren.',
      },
      strength: 'Stärke',
      form: 'Darreichungsform',
      instructions: 'Zugelassene Anwendungshinweise',
      openLabel: 'Zugelassene Produktinformationen öffnen',
      restart: 'Neue Prüfung starten',
      seeLabel: 'Siehe zugelassene Packungsbeilage',
      seeLocalLabel: 'Siehe zugelassene lokale Packungsbeilage',
    },
    summary: {
      symptom_category: 'Symptomkategorie',
      age: 'Alter',
      duration: 'Dauer',
      severity: 'Schweregrad',
      warning_signs: 'Warnzeichen',
      pregnancy_or_breastfeeding: 'Schwangerschaft oder Stillzeit',
      allergies: 'Allergien',
      medicines: 'Medikamente',
      conditions: 'Erkrankungen',
      noneReported: 'Keine angegeben',
      notProvided: 'Nicht angegeben',
      notAsked: 'Nicht abgefragt',
      reported: 'Angegeben',
      notSure: 'Nicht sicher',
    },
  },
};

const ERROR_TRANSLATIONS = {
  de: {
    'That answer does not match the current question. Please try again.': 'Diese Antwort passt nicht zur aktuellen Frage. Bitte versuchen Sie es erneut.',
    'Please choose one of the available symptom categories.': 'Bitte wählen Sie eine der verfügbaren Symptomkategorien.',
    'Enter an age from 0 to 120.': 'Geben Sie ein Alter von 0 bis 120 ein.',
    'Please choose a duration.': 'Bitte wählen Sie eine Dauer.',
    'Please choose mild, moderate or severe.': 'Bitte wählen Sie leicht, mittel oder schwer.',
    'Please choose yes, no or not sure.': 'Bitte wählen Sie ja, nein oder nicht sicher.',
    'Please choose one of the available options.': 'Bitte wählen Sie eine der verfügbaren Optionen.',
    'Enter at least one medicine or ingredient allergy.': 'Geben Sie mindestens eine Medikamenten- oder Inhaltsstoffallergie ein.',
    'Enter at least one current medicine.': 'Geben Sie mindestens ein aktuelles Medikament ein.',
    'Enter at least one medical condition.': 'Geben Sie mindestens eine Erkrankung ein.',
    'Please confirm your answers or start again.': 'Bitte bestätigen Sie Ihre Antworten oder starten Sie neu.',
  },
};

const PATHWAY_CODE_BY_LABEL = {
  'Headache, pain or fever': 'pain_fever',
  'Cold or cough': 'cold_cough',
  Allergy: 'allergy',
  Diarrhoea: 'diarrhoea',
  'Heartburn or stomach discomfort': 'heartburn',
  'Skin or minor wound': 'skin_minor_wound',
  'Other symptom': 'other',
};

export function languageByCode(code) {
  const base = String(code || '').toLowerCase().split('-')[0];
  return LANGUAGES.find(language => language.code === base) || null;
}

export function speechLocale(code) {
  return (languageByCode(code) || LANGUAGES[0]).speech;
}

function resolve(source, key) {
  let value = source;
  for (const part of String(key).split('.')) {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) return null;
    value = value[part];
  }
  return typeof value === 'string' ? value : null;
}

export function t(key, lang, vars) {
  const table = STRINGS[languageByCode(lang)?.code] || STRINGS.en;
  const value = resolve(table, key) ?? resolve(STRINGS.en, key) ?? key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name])));
}

function tn(key, lang, fallback) {
  const table = STRINGS[languageByCode(lang)?.code] || STRINGS.en;
  return resolve(table, key) ?? resolve(STRINGS.en, key) ?? fallback;
}

export function optionLabel(questionId, value, fallback, lang) {
  return tn(`option.${questionId}.${value}`, lang, tn(`option.generic.${value}`, lang, fallback));
}

export function translateWorkflowMessage(message, lang) {
  const text = String(message || '');
  if (!text) return '';
  if ((languageByCode(lang)?.code || 'en') === 'en') return text;
  return ERROR_TRANSLATIONS[languageByCode(lang).code]?.[text] || text;
}

export function localizeScreen(screen, lang) {
  if (!screen || typeof screen !== 'object') return screen;
  const questionId = screen.question_id;
  // Clinical screening lists are pathway-specific, so a German customer must get
  // the same red flags as an English one instead of the generic fallback.
  const pathwaySubtitle = screen.pathway_code
    ? tn(`question.${questionId}.${screen.pathway_code}.subtitle`, lang, null)
    : null;
  return {
    ...screen,
    title: tn(`question.${questionId}.title`, lang, screen.title),
    subtitle: pathwaySubtitle ?? tn(`question.${questionId}.subtitle`, lang, screen.subtitle),
    placeholder: tn(`question.${questionId}.placeholder`, lang, screen.placeholder),
    error: screen.error ? translateWorkflowMessage(screen.error, lang) : null,
    options: (screen.options || []).map(option => ({
      ...option,
      label: optionLabel(questionId, option.value, option.label, lang),
    })),
  };
}

const REASON_MESSAGE_KEYS = {
  warning_sign_reported_or_uncertain: 'result.message.immediate',
  warning_sign_reported: 'result.message.immediate',
  warning_sign_uncertain: 'result.message.immediate',
  severe_symptom: 'result.message.severe',
  under_18: 'result.message.under18',
  duration_outside_pathway: 'result.message.duration',
  pregnancy_breastfeeding_or_uncertain: 'result.message.pregnancy',
  medical_history_uncertain: 'result.message.history',
  session_limit: 'result.message.sessionLimit',
  unsupported_pathway: 'result.message.unsupported',
  catalog_unavailable: 'result.message.catalogUnavailable',
  no_approved_product_for_pathway: 'result.message.noApprovedProduct',
  all_products_blocked: 'result.message.allBlocked',
  age_outside_supported_range: 'result.message.ageOutsideRange',
  pathway_not_serviced: 'result.message.pathwayNotServiced',
  symptom_longer_than_product_allows: 'result.message.symptomTooLong',
  approved_product_match: 'result.message.eligible',
};

export function localizeResult(entry, lang) {
  const outcome = entry?.outcome;
  const reasonCodes = Array.isArray(entry?.reason_codes) ? entry.reason_codes : [];
  const isProduct = outcome === 'PRODUCT_ELIGIBLE';
  let labelKey = 'result.label.generic';
  let titleKey = null;
  let messageKey = null;

  if (outcome === 'IMMEDIATE_MEDICAL_CARE') {
    labelKey = 'result.label.immediate';
    titleKey = 'result.title.immediate';
    messageKey = 'result.message.immediate';
  } else if (outcome === 'CLINIC_REFERRAL') {
    labelKey = 'result.label.referral';
    titleKey = 'result.title.referral';
  } else if (outcome === 'NO_SUITABLE_PRODUCT') {
    labelKey = 'result.label.noProduct';
    titleKey = 'result.title.noProduct';
  } else if (isProduct) {
    labelKey = 'result.label.eligible';
  }

  if (!messageKey) {
    messageKey = reasonCodes.map(code => REASON_MESSAGE_KEYS[code]).find(Boolean) || null;
  }

  return {
    label: t(labelKey, lang),
    title: isProduct
      ? entry?.screen?.title || entry?.product?.name || t('result.title.completed', lang)
      : titleKey
        ? t(titleKey, lang)
        : entry?.screen?.title || t('result.title.completed', lang),
    message: messageKey ? t(messageKey, lang) : entry?.message || '',
  };
}

function summaryValue(key, value, lang) {
  if (Array.isArray(value)) {
    const items = value.map(item => String(item)).filter(Boolean);
    return items.length ? items.join(', ') : t('summary.noneReported', lang);
  }
  if (value == null || value === '') return t('summary.notProvided', lang);
  const text = String(value).trim();
  if (/^not asked$/i.test(text)) return t('summary.notAsked', lang);

  if (key === 'duration') {
    const normalized = text.toLowerCase().replaceAll('–', '-');
    if (normalized.includes('today')) return t('option.duration.today', lang);
    if (normalized === '1-2 days' || normalized === '1-2 day') return t('option.duration.1_to_2_days', lang);
    if (normalized === '3-7 days' || normalized === '3-7 day') return t('option.duration.3_to_7_days', lang);
    if (normalized.includes('more than 7')) return t('option.duration.more_than_7_days', lang);
    return text;
  }
  if (key === 'severity') {
    return tn(`option.severity.${text.toLowerCase()}`, lang, text);
  }
  if (key === 'pregnancy_or_breastfeeding') {
    return tn(`option.pregnancy_breastfeeding.${text}`, lang, text);
  }
  if (key === 'warning_signs') {
    if (/^none reported$/i.test(text)) return t('summary.noneReported', lang);
    if (/^reported$/i.test(text)) return t('summary.reported', lang);
    if (/^not sure$/i.test(text)) return t('summary.notSure', lang);
    return text;
  }
  if (key === 'symptom_category') {
    const code = PATHWAY_CODE_BY_LABEL[text];
    return code ? t(`pathway.${code}`, lang) : text;
  }
  if (['allergies', 'medicines', 'conditions'].includes(key) && /^none reported$/i.test(text)) {
    return t('summary.noneReported', lang);
  }
  return text;
}

export function localizeSummary(summary, lang) {
  if (!summary || typeof summary !== 'object') return [];
  return Object.entries(summary).map(([key, value]) => ({
    key,
    label: tn(`summary.${key}`, lang, key.replaceAll('_', ' ')),
    value: summaryValue(key, value, lang),
  }));
}

const GERMAN_DISTINCTIVE = new Set([
  'kopfschmerzen', 'kopfschmerz', 'schmerzen', 'schmerz', 'fieber', 'husten',
  'allergie', 'allergien', 'medikament', 'medikamente', 'arznei', 'arzneimittel',
  'sodbrennen', 'durchfall', 'halsschmerzen', 'schnupfen', 'erkaltung', 'haut',
  'wunde', 'ausschlag', 'schwanger', 'schwangerschaft', 'stillend', 'stillen',
  'arzt', 'arztin', 'klinik', 'apotheke', 'heute', 'woche', 'wochen', 'tage',
  'leicht', 'mittel', 'schwer', 'nein', 'ja', 'mehr', 'langer', 'keine',
  'keinen', 'keinem', 'nicht', 'sicher', 'unsicher', 'beides', 'beide',
  'zutreffend', 'angabe', 'erkaltung', 'verletzung', 'verbrennung',
  'hallo', 'danke', 'bitte', 'guten', 'sprechen', 'hilfe', 'helfen',
  'richtig', 'bestatigen', 'weiter', 'andern', 'falsch', 'keines', 'davon',
  'eines', 'mehrere', 'verstanden', 'wiederholen',
]);

const GERMAN_NUMBER = /^(?:(?:ein|eins|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn|elf|zwolf|dreizehn|vierzehn|funfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|dreissig|vierzig|funfzig|sechzig|siebzig|achtzig|neunzig)|(?:[a-z]+und(?:zwanzig|dreissig|vierzig|funfzig|sechzig|siebzig|achtzig|neunzig))|hundert)$/;

const ENGLISH_NUMBER = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred',
]);

const GERMAN_COMMON = new Set([
  'der', 'die', 'das', 'den', 'dem', 'und', 'oder', 'ich', 'sie', 'er', 'es',
  'habe', 'haben', 'hat', 'mit', 'fur', 'ist', 'sind', 'mein', 'meine', 'mir',
  'mich', 'ein', 'eine', 'einen', 'einem', 'einer', 'als', 'seit', 'uber',
  'unter', 'ohne', 'mochte', 'moechte', 'mochten', 'moechten', 'will', 'kann',
  'konnen', 'koennen', 'was', 'warum', 'wie', 'wo', 'wann', 'welche', 'welcher',
  'bitte', 'danke', 'tut', 'weh', 'stark', 'sehr', 'etwas', 'paar', 'stunden',
  'bin', 'bist', 'bei', 'zum', 'zur', 'von', 'vom', 'im', 'in', 'an', 'auf',
  'nehme', 'nimmt', 'nehmen', 'hatte', 'waren',
]);

const ENGLISH_DISTINCTIVE = new Set([
  'headache', 'heartburn', 'diarrhoea', 'diarrhea', 'runny', 'throat',
  'stomach', 'wound', 'rash', 'pain', 'fever', 'cough', 'allergy', 'allergies',
  'sneezing', 'pregnant', 'breastfeeding', 'medicine', 'medicines', 'doctor',
  'clinic', 'pharmacy', 'mild', 'moderate', 'severe', 'today', 'week', 'weeks',
  'sure', 'none', 'chest', 'breathing', 'fainting', 'confusion',
]);

const ENGLISH_COMMON = new Set([
  'the', 'and', 'or', 'i', 'you', 'we', 'they', 'have', 'has', 'had', 'with',
  'for', 'is', 'are', 'was', 'were', 'my', 'me', 'it', 'this', 'that', 'a',
  'an', 'day', 'days', 'not', 'yes', 'no', 'help', 'feel', 'take', 'taking',
  'dont', 'don', 'know', 'why', 'what', 'how', 'when', 'which', 'please',
  'thanks', 'thank', 'hello', 'hi', 'hours', 'hour', 'couple',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred',
]);

function normalizeText(value) {
  return String(value ?? '')
    .slice(0, 800)
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectLanguage(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  let german = 0;
  let english = 0;
  let germanNumbers = 0;
  let englishNumbers = 0;
  for (const word of normalized.split(' ')) {
    if (GERMAN_DISTINCTIVE.has(word)) german += 3;
    else if (GERMAN_COMMON.has(word)) german += 1;
    if (GERMAN_NUMBER.test(word)) { german += 3; germanNumbers += 1; }
    if (ENGLISH_DISTINCTIVE.has(word)) english += 3;
    else if (ENGLISH_COMMON.has(word)) english += 1;
    if (ENGLISH_NUMBER.has(word)) englishNumbers += 1;
  }

  if (/\w*(schmerz|fieber|husten|allergie|medikament|schwanger|still|woche|durchfall|sodbrennen)\w*/.test(normalized)) german += 2;

  if (german === english) return null;
  const best = Math.max(german, english);
  const other = Math.min(german, english);
  if (best < 2) {
    if (germanNumbers > englishNumbers) return 'de';
    if (englishNumbers > germanNumbers) return 'en';
    return null;
  }
  if (best - other < 2) return null;
  return german > english ? 'de' : 'en';
}
