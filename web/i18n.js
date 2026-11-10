import { HINDI_PREVIEW } from './i18n-hi.js';
export const LANGUAGES = [
  { code: 'auto', label: 'Auto - Deutsch / English', short: 'AUTO', speech: 'en-US' },
  { code: 'en', label: 'English', short: 'EN', speech: 'en-US' },
  { code: 'de', label: 'Deutsch', short: 'DE', speech: 'de-DE' },
  { code: 'fr', label: 'Français', short: 'FR', speech: 'fr-FR' },
  { code: 'ar', label: 'العربية', short: 'AR', speech: 'ar-MA' },
  { code: 'tr', label: 'Türkçe', short: 'TR', speech: 'tr-TR' },
  { code: 'es', label: 'Español', short: 'ES', speech: 'es-ES' },
  { code: 'it', label: 'Italiano', short: 'IT', speech: 'it-IT' },
  { code: 'pl', label: 'Polski', short: 'PL', speech: 'pl-PL' },
  { code: 'ru', label: 'Русский', short: 'RU', speech: 'ru-RU' },
  { code: 'uk', label: 'Українська', short: 'UK', speech: 'uk-UA' },
  { code: 'ro', label: 'Română', short: 'RO', speech: 'ro-RO' },
  { code: 'nl', label: 'Nederlands', short: 'NL', speech: 'nl-NL' },
  { code: 'pt', label: 'Português', short: 'PT', speech: 'pt-PT' },
  { code: 'fa', label: 'فارسی', short: 'FA', speech: 'fa-IR' },
  { code: 'ur', label: 'اردو', short: 'UR', speech: 'ur-PK' },
  { code: 'hi', label: 'हिन्दी', short: 'HI', speech: 'hi-IN' },
  { code: 'te', label: 'తెలుగు', short: 'TE', speech: 'te-IN' },
  { code: 'bg', label: 'Български', short: 'BG', speech: 'bg-BG' },
  { code: 'cs', label: 'Čeština', short: 'CS', speech: 'cs-CZ' },
  { code: 'da', label: 'Dansk', short: 'DA', speech: 'da-DK' },
  { code: 'el', label: 'Ελληνικά', short: 'EL', speech: 'el-GR' },
  { code: 'hu', label: 'Magyar', short: 'HU', speech: 'hu-HU' },
  { code: 'sv', label: 'Svenska', short: 'SV', speech: 'sv-SE' },
  { code: 'no', label: 'Norsk', short: 'NO', speech: 'nb-NO' },
  { code: 'fi', label: 'Suomi', short: 'FI', speech: 'fi-FI' },
  { code: 'sr', label: 'Српски', short: 'SR', speech: 'sr-RS' },
  { code: 'hr', label: 'Hrvatski', short: 'HR', speech: 'hr-HR' },
  { code: 'bs', label: 'Bosanski', short: 'BS', speech: 'bs-BA' },
  { code: 'sq', label: 'Shqip', short: 'SQ', speech: 'sq-AL' },
  { code: 'mk', label: 'Македонски', short: 'MK', speech: 'mk-MK' },
  { code: 'sl', label: 'Slovenščina', short: 'SL', speech: 'sl-SI' },
  { code: 'sk', label: 'Slovenčina', short: 'SK', speech: 'sk-SK' },
  { code: 'lt', label: 'Lietuvių', short: 'LT', speech: 'lt-LT' },
  { code: 'lv', label: 'Latviešu', short: 'LV', speech: 'lv-LV' },
  { code: 'et', label: 'Eesti', short: 'ET', speech: 'et-EE' },
  { code: 'fy', label: 'Frysk', short: 'FY', speech: 'fy-NL' },
  { code: 'ka', label: 'ქართული', short: 'KA', speech: 'ka-GE' },
  { code: 'hy', label: 'Հայերեն', short: 'HY', speech: 'hy-AM' },
  { code: 'az', label: 'Azərbaycanca', short: 'AZ', speech: 'az-AZ' },
  { code: 'kk', label: 'Қазақша', short: 'KK', speech: 'kk-KZ' },
  { code: 'uz', label: 'O‘zbekcha', short: 'UZ', speech: 'uz-UZ' },
  { code: 'ku', label: 'Kurdî', short: 'KU', speech: 'ku-TR' },
  { code: 'ps', label: 'پښتو', short: 'PS', speech: 'ps-AF' },
  { code: 'he', label: 'עברית', short: 'HE', speech: 'he-IL' },
  { code: 'bn', label: 'বাংলা', short: 'BN', speech: 'bn-IN' },
  { code: 'ta', label: 'தமிழ்', short: 'TA', speech: 'ta-IN' },
  { code: 'ml', label: 'മലയാളം', short: 'ML', speech: 'ml-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', short: 'KN', speech: 'kn-IN' },
  { code: 'gu', label: 'ગુજરાતી', short: 'GU', speech: 'gu-IN' },
  { code: 'mr', label: 'मराठी', short: 'MR', speech: 'mr-IN' },
  { code: 'ne', label: 'नेपाली', short: 'NE', speech: 'ne-NP' },
  { code: 'si', label: 'සිංහල', short: 'SI', speech: 'si-LK' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI', speech: 'vi-VN' },
  { code: 'th', label: 'ไทย', short: 'TH', speech: 'th-TH' },
  { code: 'id', label: 'Bahasa Indonesia', short: 'ID', speech: 'id-ID' },
  { code: 'ms', label: 'Bahasa Melayu', short: 'MS', speech: 'ms-MY' },
  { code: 'zh', label: '中文', short: 'ZH', speech: 'zh-CN' },
  { code: 'ja', label: '日本語', short: 'JA', speech: 'ja-JP' },
  { code: 'ko', label: '한국어', short: 'KO', speech: 'ko-KR' },
  { code: 'so', label: 'Soomaali', short: 'SO', speech: 'so-SO' },
  { code: 'am', label: 'አማርኛ', short: 'AM', speech: 'am-ET' },
  { code: 'sw', label: 'Kiswahili', short: 'SW', speech: 'sw-KE' },
];

export const DEFAULT_LANGUAGE = 'de';

export const STRINGS = {
  en: {
    app: {
      eyebrow: 'AI Clinical Voice Agent & Medical Assistant',
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
      noSpeech: 'I could not hear any speech. Tap to speak and try again.',
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
      inactivity: 'The session was idle, so your consultation was cleared for privacy. Tap to start a new assessment.',
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
      productQuestion: 'Ask about how to take it, uses, or precautions…',
      completeStep: 'Complete the current step…',
      startToChat: 'Type your symptom or question to start…',
      send: 'Send',
      heard: 'I heard',
      understood: 'I understood',
      isCorrect: 'Is that correct?',
      againPrompt: 'Okay. Please say, type, or choose your answer again.',
      camera: 'Take photo or show medicine',
      imageAttached: 'Photo attached',
      removeImage: 'Remove photo',
      correctAnswer: 'Correct',
      changeAnswer: 'Change answer',
      rememberedContext: 'From what you mentioned earlier: “{value}”. Tap to confirm or choose another option.',
      rememberedQuestion: 'Earlier you mentioned {value}. Is that correct?',
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
      productMatchIntro: 'Thanks. Based on the safety answers you gave, {name} is a suitable approved option.',
      productConciseIntro: 'A suitable option is {name}.',
      productDirections: 'Here is how to take it: {directions}',
      productDuplicateWarning: 'Do not take it with another medicine containing the same active ingredient.',
      productAnythingElse: 'Would you like me to repeat the directions or explain a precaution?',
      productReviewPrecautions: 'Please review the precautions on screen before continuing, and do not combine it with another medicine containing the same active ingredient.',
      dispensingConfirmation: 'Dispensing your medication from Slot {slot} now. Please collect your package from the tray below.',
      assessmentCompleted: 'Assessment completed.',
      inputGuidance: 'Use the chat field below or tap the microphone to answer.',
      numberNotIdentified: 'I could not identify a number. Please say or type your age as a number.',
      answerNotMatched: 'I could not match that answer. Please say, type, or touch one of the displayed options.',
      durationStillNeeded: 'Thank you. I still need to know how long you have had this symptom. For example, say started last night, since yesterday, or three days.',
      greeting: 'Hello, how can I help you?',
      retry: 'Try again',
      warningSignsPrompt: 'Do any serious warning signs apply? Please check the warning signs on screen, or choose "I am not sure".',
      warningSignsAnswerNeeded: 'Please check the warning signs on screen, then say “No, none of these”, “Yes, one or more”, or “I am not sure”.',
      autoConfirmCountdown: 'Confirming in {seconds}s…',
    },
    loading: {
      checking: 'Checking your answer…',
      finishingSpeech: 'Got it — checking your answer…',
      starting: 'Starting a new assessment…',
    },
    friendly: {
      greetingStart: 'Hi! I’m here to help. Please tell me what you would like help with, or choose an option on the screen.',
      greetingContinue: 'Hi! I’m still here with you. Let’s continue: {question}',
      thanks: 'You’re welcome. When you’re ready: {question}',
      help: 'Of course. I’ll guide you one step at a time. {question}',
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
      offlineActive: 'OFFLINE MODE — Local clinical triage and verified medicine catalogue active',
      onlineActive: 'ONLINE MODE — Connected to cloud formularies',
      dismiss: 'Dismiss notice',
    },
    clarify: {
      severity: 'Mild means manageable and not strongly limiting normal activity. Moderate means clearly uncomfortable or limiting some activity. Severe means intense or strongly limiting normal activity. Choose the closest option.',
      age: 'Age is required because medicine eligibility and safety restrictions can differ by age. This research pathway currently refers patients under eighteen for professional advice.',
      allergy: 'Medicine allergies are checked against approved product ingredients before any product can be shown.',
      medicine: 'Current medicines are checked against approved interaction rules before any product can be shown.',
      condition: 'Ongoing health conditions may make some products unsuitable, so they are checked against approved contraindication rules.',
      warningSigns: 'I am checking urgent warning signs, not ordinary cold symptoms. Please look on screen for signs such as trouble breathing, chest pain, confusion, a stiff neck, an unusual rash, or a sudden severe headache. Then choose no, yes, or I am not sure.',
      generic: 'I can explain the current question, but I cannot diagnose symptoms. Please answer using the displayed choices, voice, or chat.',
    },
    pharmacy: {
      purposeQuestion: 'What do you need it for?',
      purposeProceed: 'First I will check whether this machine has an approved pathway. If it does, I will ask about age, allergies, other medicines and health conditions.',
      caution: 'It is not suitable for everyone, so I will ask a few quick safety questions.',
      emergencyTitle: 'Immediate Medical Care Needed',
      emergencyNotice: 'Your symptoms may require urgent medical care. Please call emergency services (112, 15 or 911) or visit the nearest emergency clinic or hospital immediately.',
      symptomIntentProceed: 'I can check if we have a suitable over-the-counter medicine for {symptom}. To make sure it is safe for you, let us complete a quick safety assessment.',
      mixedColdFever: 'You mentioned both cold and fever. I will check the fever and pain pathway first. Any product shown may help fever or pain, but it may not treat the other cold symptoms.',
      conditionCaution: '{medicine} may not be suitable if you have {condition}. Let me run a safety check to see if an approved alternative is safe for you.',
      warningSignsCheckHeader: 'Check whether any of these apply to you right now:',
      takeWithFoodBadge: 'Take with or after food (stomach protection)',
      paracetamolLimitBadge: 'Do not take with another paracetamol-containing medicine',
      dosingInterval: 'Wait {hours} hours between doses',
      maxDailyDoses: 'Max {count} doses in 24 hours',
      uses: {
        paracetamol: 'Paracetamol is commonly used for mild to moderate pain and fever.',
        ibuprofen: 'Ibuprofen is commonly used for pain, fever and inflammation.',
        aspirin: 'Aspirin is used for pain and fever. Regular low-dose use needs medical advice.',
        loperamide: 'Loperamide is used for the short-term relief of acute diarrhoea.',
        cetirizine: 'Cetirizine is an antihistamine used for allergy symptoms such as hay fever.',
        loratadine: 'Loratadine is an antihistamine commonly used for allergy symptoms.',
        xylometazoline: 'Xylometazoline nasal spray is commonly used for short-term relief of nasal congestion.',
        dextromethorphan: 'Dextromethorphan is commonly used for temporary relief of cough.',
        dimenhydrinate: 'Dimenhydrinate is commonly used to prevent and treat motion sickness.',
        simethicone: 'Simethicone is commonly used to relieve trapped wind and bloating.',
        antacid: 'Antacids are used to relieve heartburn, indigestion and stomach upset.',
        lozenge: 'Throat lozenges are used for soothing sore or irritated throats.',
        saline: 'Saline nasal spray helps relieve nasal congestion and dry nasal passages.',
        ors: 'Oral rehydration salts help restore fluids and electrolytes lost through diarrhoea or vomiting.',
      },
    },
    productChat: {
      uses: 'This product is approved for: {uses}.',
      precautions: 'Important precautions: {warnings}',
      openLabel: 'Please review the verified product information and instructions on screen before taking.',
      goodbye: 'You’re welcome. Take care. You can end the session or start a new assessment.',
      help: 'You can ask me how to take this product, what it is used for, or about its precautions. What would you like to know?',
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
        title: 'Could pregnancy or breastfeeding apply to you?',
        subtitle: 'Choose Not applicable if this cannot apply to you.',
      },
      medical_history_status: {
        title: 'Do you have a medicine allergy, take any medicines, or have an ongoing medical condition?',
        subtitle: 'Choose No only if none of these apply.',
      },
      safety_background_status: {
        title: 'Do any of these apply to you: pregnancy or breastfeeding, a medicine allergy, current medicines, or an ongoing medical condition?',
        subtitle: 'Choose none only if none of these apply. Include prescription and non-prescription medicines.',
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
      medical_history_status: { no: 'No, none of these', yes: 'Yes, one or more', not_sure: 'I am not sure' },
      safety_background_status: {
        none: 'No, none of these', pregnancy: 'Pregnancy or breastfeeding', history: 'Allergy, medicines, or medical condition', both: 'Both groups apply', not_sure: 'I am not sure',
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
      commonUses: 'Common uses',
      quantityInUnits: 'Quantity in units',
      howToTake: 'How to take & precautions',
      matchedGroup: 'Suggested for: {group}',
      dosePerDose: 'Usual dose: {value}',
      doseMaxDoses: 'No more than {value} doses in 24 hours.',
      doseInterval: 'Leave at least {value} hours between doses.',
      doseDuration: 'Do not self-treat for more than {value} days.',
      ageFromMonths: 'from {value} months of age',
      ageFromYears: 'from {value} years of age',
      ageApproved: 'Approved {from}.',
      ageApprovedUntil: 'Approved {from}, up to {max} years.',
      warningAllergyTerms: 'Do not take if you are allergic to: {terms}.',
      warningDuplicate: 'Do not take with another medicine that contains {name}.',
      warningInteractionTerms: 'Do not combine with other medicines you are taking, especially: {terms}.',
      warningConsultTerms: 'Do not take without doctor advice if any of these apply to you: {terms}.',
      vendingSlot: 'Vending Slot {slot}',
      slotReadyToDispense: 'In Stock & Ready to Dispense',
      dispenseNow: 'Dispense from Slot {slot}',
      dispensingInProgress: 'Dispensing in progress…',
      dispenseSuccess: 'Medication dispensed! Please collect your package from the tray below.',
      clinicalRecord: 'Clinical Consultation Summary',
      metricSymptom: 'Assessed Indication',
      metricAgeBand: 'Age Verification',
      metricDuration: 'Reported Duration',
      metricSafetyStatus: 'Triage Clearance',
      safetyCleared: 'Eligible for self-care',
      safetySummary: 'Assessment safety summary',
      printSummary: 'Print Clinical Note',
      copySummary: 'Copy Consultation Note',
      summaryCopied: 'Copied to clipboard!',
      chooseDifferentSymptom: '← Choose a different symptom',
      correctAge: '← Correct my age',
      reviewDuration: '← Review duration',
    },
    option_subtitle: {
      symptom: {
        pain_fever: 'Headache, fever, toothache, muscle or body pain',
        cold_cough: 'Sore throat, cough, runny or congested nose',
        allergy: 'Sneezing, hay fever, itchy or watery eyes',
        diarrhoea: 'Acute watery stools, hydration support',
        heartburn: 'Acid indigestion, reflux, burning stomach discomfort',
        skin_minor_wound: 'Minor scrapes, grazes, small cuts, antiseptic',
        other: 'Toothache, sinus, earache, or speak in your own words',
      },
      severity: {
        mild: 'Minor discomfort, does not stop normal activities',
        moderate: 'Noticeable pain, interferes with focus or sleep',
        severe: 'Intense pain, medical attention usually recommended',
      },
      duration: {
        today: 'Just started today or last night',
        '1_to_2_days': 'Recently started (1–2 days ago)',
        '3_to_7_days': 'Ongoing for several days (3–7 days)',
        more_than_7_days: 'Prolonged (over 1 week, doctor review needed)',
      },
      warning_signs: {
        no: 'None of the serious warning signs apply to me',
        yes: 'I have one or more severe symptoms',
        not_sure: 'I am unsure, connect me with clinical staff',
      },
      pregnancy_breastfeeding: {
        no: 'Not pregnant and not breastfeeding',
        pregnant: 'Currently pregnant (requires doctor check)',
        breastfeeding: 'Currently breastfeeding',
        both: 'Both pregnant and breastfeeding',
        not_applicable: 'Not applicable',
        prefer_not_to_say: 'Prefer not to disclose',
      },
      allergy_status: {
        no: 'No known medicine allergies',
        yes: 'Known allergy to paracetamol, NSAIDs, etc.',
        not_sure: 'Not completely certain',
      },
      medication_status: {
        no: 'Not taking other regular medicines',
        yes: 'Taking prescription or OTC medications',
        not_sure: 'Not completely certain',
      },
      condition_status: {
        no: 'No chronic medical conditions',
        yes: 'Asthma, high blood pressure, ulcer, etc.',
        not_sure: 'Not completely certain',
      },
      confirm: {
        yes: 'All details accurate, check product match',
        no: 'Change an answer or start over',
      },
    },
    custom_symptom: {
      stepLabel: 'Speak · type · or choose a symptom',
      title: 'Tell us what you are experiencing',
      subtitle: 'Choose a common symptom below, or speak / type in your own words (e.g., toothache, back pain, sinus congestion).',
      speakHint: 'Tap the microphone or type below to describe your symptom in your own words.',
      backToMain: '← Back to main categories',
      otherCareNotice: 'If your symptom is not an over-the-counter condition, our system will connect you with a clinic or healthcare provider.',
      toothache: 'Toothache / Dental pain',
      toothacheSub: 'Relief for tooth, gum or jaw discomfort',
      backPain: 'Muscle or back pain',
      backPainSub: 'Relief for sore muscles, joint or back pain',
      sinus: 'Sinus pressure / Congestion',
      sinusSub: 'Nasal decongestant and sinus relief',
      heartburn: 'Indigestion / Heartburn',
      heartburnSub: 'Acid neutraliser and stomach protection',
      allergy: 'Itchy eyes / Hay fever',
      allergySub: 'Antihistamine relief for allergic eyes/nose',
      wound: 'Minor scrape, cut or graze',
      woundSub: 'Antiseptic wash, plaster or sterile gauze',
      earache: 'Earache / Ear pain',
      earacheSub: 'Pain and fever relief for ear discomfort',
      otherPathway: 'Other / Not listed above',
      otherPathwaySub: 'Referral to clinical care or healthcare provider',
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
      eyebrow: 'KI-Klinischer Sprach- & Medizinassistent',
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
      noSpeech: 'Ich konnte keine Sprache hören. Tippen Sie zum Sprechen und versuchen Sie es erneut.',
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
      inactivity: 'Die Sitzung war inaktiv, daher wurde Ihre Beratung zum Schutz der Privatsphäre gelöscht. Tippen Sie, um eine neue Prüfung zu starten.',
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
      productQuestion: 'Fragen Sie nach Einnahme, Anwendung oder Vorsichtsmaßnahmen…',
      completeStep: 'Schließen Sie den aktuellen Schritt ab…',
      startToChat: 'Beschreiben Sie Ihre Beschwerden zum Starten…',
      send: 'Senden',
      heard: 'Ich habe gehört',
      understood: 'Ich habe verstanden',
      isCorrect: 'Ist das richtig?',
      againPrompt: 'Okay. Bitte sagen, tippen oder wählen Sie Ihre Antwort erneut.',
      camera: 'Foto aufnehmen oder Medikament zeigen',
      imageAttached: 'Foto angehängt',
      removeImage: 'Foto entfernen',
      correctAnswer: 'Richtig',
      changeAnswer: 'Antwort ändern',
      rememberedContext: 'Aus Ihren vorherigen Angaben: „{value}“. Zum Bestätigen tippen oder andere Option wählen.',
      rememberedQuestion: 'Sie haben vorhin {value} erwähnt. Ist das richtig?',
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
      productMatchIntro: 'Danke. Nach Ihren Sicherheitsangaben ist {name} eine passende zugelassene Option.',
      productConciseIntro: 'Eine passende Option ist {name}.',
      productDirections: 'So wird es eingenommen: {directions}',
      productDuplicateWarning: 'Nehmen Sie es nicht zusammen mit einem anderen Arzneimittel mit demselben Wirkstoff ein.',
      productAnythingElse: 'Soll ich die Einnahme wiederholen oder eine Vorsichtsmaßnahme erklären?',
      productReviewPrecautions: 'Bitte prüfen Sie vor dem Fortfahren die Vorsichtsmaßnahmen auf dem Bildschirm und nehmen Sie es nicht zusammen mit einem anderen Arzneimittel mit demselben Wirkstoff ein.',
      dispensingConfirmation: 'Ihr Medikament wird jetzt aus Fach {slot} ausgegeben. Bitte entnehmen Sie Ihre Packung aus dem Ausgabefach.',
      assessmentCompleted: 'Prüfung abgeschlossen.',
      inputGuidance: 'Verwenden Sie das Chatfeld unten oder tippen Sie auf das Mikrofon, um zu antworten.',
      numberNotIdentified: 'Ich konnte keine Zahl erkennen. Bitte sagen oder tippen Sie Ihr Alter als Zahl.',
      answerNotMatched: 'Ich konnte diese Antwort nicht zuordnen. Bitte sagen, tippen oder berühren Sie eine der angezeigten Optionen.',
      durationStillNeeded: 'Danke. Ich muss noch wissen, wie lange Sie dieses Symptom haben. Sagen Sie zum Beispiel seit letzter Nacht, seit gestern oder drei Tage.',
      greeting: 'Hallo! Wie kann ich Ihnen heute helfen?',
      retry: 'Erneut versuchen',
      warningSignsPrompt: 'Liegen ernste Warnzeichen vor? Bitte prüfen Sie die Hinweise auf dem Bildschirm, oder wählen Sie „Ich bin nicht sicher“.',
      warningSignsAnswerNeeded: 'Bitte prüfen Sie die Warnzeichen auf dem Bildschirm und sagen Sie dann „Nein, keines davon“, „Ja, eines oder mehrere“ oder „Ich bin nicht sicher“.',
      autoConfirmCountdown: 'Bestätigung in {seconds}s…',
    },
    loading: {
      checking: 'Antwort wird geprüft…',
      finishingSpeech: 'Verstanden — Ihre Antwort wird geprüft…',
      starting: 'Neue Prüfung wird gestartet…',
    },
    friendly: {
      greetingStart: 'Hallo! Ich helfe Ihnen gern. Sagen Sie mir bitte, wobei Sie Hilfe benötigen, oder wählen Sie eine Option auf dem Bildschirm.',
      greetingContinue: 'Hallo! Ich bin weiterhin für Sie da. Machen wir weiter: {question}',
      thanks: 'Gern geschehen. Wenn Sie bereit sind: {question}',
      help: 'Natürlich. Ich führe Sie Schritt für Schritt. {question}',
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
      offlineActive: 'OFFLINE-MODUS – Lokale klinische Triage und geprüfter Medikamentenkatalog aktiv',
      onlineActive: 'ONLINE-MODUS – Mit Cloud-Arzneimittelverzeichnissen verbunden',
      dismiss: 'Hinweis schließen',
    },
    clarify: {
      severity: 'Leicht bedeutet handhabbar und die normale Aktivität nicht stark einschränkend. Mittel bedeutet deutlich unangenehm oder die Aktivität teilweise einschränkend. Schwer bedeutet intensiv oder die normale Aktivität stark einschränkend. Wählen Sie die passendste Option.',
      age: 'Das Alter ist erforderlich, da die Zulassung von Medikamenten und Sicherheitsbeschränkungen je nach Alter unterschiedlich sein können. Dieser Forschungspfad verweist Patienten unter achtzehn Jahren derzeit an eine fachliche Beratung.',
      allergy: 'Medikamentenallergien werden vor der Anzeige eines Produkts mit den zugelassenen Inhaltsstoffen abgeglichen.',
      medicine: 'Aktuelle Medikamente werden vor der Anzeige eines Produkts mit den zugelassenen Wechselwirkungsregeln abgeglichen.',
      condition: 'Bestehende Erkrankungen können manche Produkte ungeeignet machen und werden daher mit den zugelassenen Kontraindikationsregeln abgeglichen.',
      warningSigns: 'Ich prüfe dringende Warnzeichen, nicht gewöhnliche Erkältungssymptome. Achten Sie auf dem Bildschirm auf Atemnot, Brustschmerzen, Verwirrtheit, Nackensteife, einen ungewöhnlichen Ausschlag oder plötzlich sehr starke Kopfschmerzen. Wählen Sie dann Nein, Ja oder Ich bin nicht sicher.',
      generic: 'Ich kann die aktuelle Frage erklären, aber keine Symptome diagnostizieren. Bitte antworten Sie über die angezeigten Optionen, per Sprache oder im Chat.',
    },
    pharmacy: {
      purposeQuestion: 'Wofür benötigen Sie es?',
      purposeProceed: 'Zuerst prüfe ich, ob dieses Gerät einen zugelassenen Weg dafür hat. Falls ja, frage ich nach Alter, Allergien, anderen Medikamenten und Vorerkrankungen.',
      caution: 'Es ist nicht für jeden geeignet, daher stelle ich ein paar kurze Sicherheitsfragen.',
      emergencyTitle: 'Sofortige medizinische Versorgung erforderlich',
      emergencyNotice: 'Ihre Symptome erfordern möglicherweise sofortige ärztliche Hilfe. Bitte rufen Sie den Notruf (112) an oder begeben Sie sich unverzüglich in die nächste Notaufnahme.',
      symptomIntentProceed: 'Ich kann prüfen, ob wir ein passendes rezeptfreies Medikament für {symptom} haben. Für Ihre Sicherheit führen wir eine kurze Sicherheitsprüfung durch.',
      mixedColdFever: 'Sie haben Erkältung und Fieber genannt. Ich prüfe zuerst den Fieber- und Schmerzpfad. Ein angezeigtes Produkt kann gegen Fieber oder Schmerzen helfen, aber möglicherweise nicht gegen die anderen Erkältungssymptome.',
      conditionCaution: '{medicine} ist bei {condition} möglicherweise nicht geeignet. Lassen Sie uns die Sicherheitsprüfung durchführen, um eine sichere Alternative zu finden.',
      warningSignsCheckHeader: 'Prüfen Sie, ob eines dieser Zeichen auf Sie zutrifft:',
      takeWithFoodBadge: 'Mit oder nach dem Essen einnehmen (Magenschutz)',
      paracetamolLimitBadge: 'Nicht zusammen mit einem anderen paracetamolhaltigen Arzneimittel einnehmen',
      dosingInterval: 'Zwischen den Einnahmen {hours} Stunden warten',
      maxDailyDoses: 'Maximal {count} Dosen in 24 Stunden',
      uses: {
        paracetamol: 'Paracetamol wird häufig bei leichten bis mäßigen Schmerzen und Fieber verwendet.',
        ibuprofen: 'Ibuprofen wird häufig bei Schmerzen, Fieber und Entzündungen verwendet.',
        aspirin: 'Aspirin wird bei Schmerzen und Fieber verwendet. Eine regelmäßige Einnahme in niedriger Dosis erfordert ärztlichen Rat.',
        loperamide: 'Loperamid wird zur kurzfristigen Behandlung von akutem Durchfall verwendet.',
        cetirizine: 'Cetirizin ist ein Antihistaminikum gegen Allergiesymptome wie Heuschnupfen.',
        loratadine: 'Loratadin ist ein Antihistaminikum, das häufig bei Allergiebeschwerden verwendet wird.',
        xylometazoline: 'Xylometazolin-Nasenspray wird häufig zur kurzfristigen Linderung einer verstopften Nase verwendet.',
        dextromethorphan: 'Dextromethorphan wird häufig zur kurzfristigen Linderung von Husten verwendet.',
        dimenhydrinate: 'Dimenhydrinat wird häufig zur Vorbeugung und Behandlung von Reisekrankheit verwendet.',
        simethicone: 'Simeticon wird häufig zur Linderung von Blähungen verwendet.',
        antacid: 'Antazida werden zur Linderung von Sodbrennen und Magenbeschwerden eingesetzt.',
        lozenge: 'Halstabletten dienen der Linderung von Halsschmerzen und Heiserkeit.',
        saline: 'Meerwasserspray befeuchtet die Nasenschleimhaut und hilft bei verstopfter Nase.',
        ors: 'Elektrolytlösungen helfen beim Ausgleich von Flüssigkeits- und Mineralstoffverlusten bei Durchfall.',
      },
    },
    productChat: {
      uses: 'Dieses Produkt ist zugelassen für: {uses}.',
      precautions: 'Wichtige Vorsichtsmaßnahmen: {warnings}',
      openLabel: 'Bitte überprüfen Sie die verifizierten Produktinformationen und Anweisungen auf dem Bildschirm vor der Einnahme.',
      goodbye: 'Gern geschehen. Alles Gute. Sie können die Sitzung beenden oder eine neue Prüfung starten.',
      help: 'Sie können mich nach der Einnahme, den Anwendungsgebieten oder den Vorsichtsmaßnahmen dieses Produkts fragen. Was möchten Sie wissen?',
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
        title: 'Könnten Schwangerschaft oder Stillzeit auf Sie zutreffen?',
        subtitle: 'Wählen Sie Nicht zutreffend, wenn dies nicht auf Sie zutreffen kann.',
      },
      medical_history_status: {
        title: 'Haben Sie eine Medikamentenallergie, nehmen Sie Medikamente ein oder haben Sie eine chronische Erkrankung?',
        subtitle: 'Wählen Sie Nein nur, wenn nichts davon zutrifft.',
      },
      safety_background_status: {
        title: 'Trifft etwas davon auf Sie zu: Schwangerschaft oder Stillzeit, Medikamentenallergie, aktuelle Medikamente oder eine bestehende Erkrankung?',
        subtitle: 'Wählen Sie nichts davon nur, wenn keiner dieser Punkte zutrifft.',
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
      medical_history_status: { no: 'Nein, nichts davon', yes: 'Ja, eines oder mehrere', not_sure: 'Ich bin nicht sicher' },
      safety_background_status: {
        none: 'Nein, nichts davon', pregnancy: 'Schwangerschaft oder Stillzeit', history: 'Allergie, Medikamente oder Erkrankung', both: 'Beide Gruppen treffen zu', not_sure: 'Ich bin nicht sicher',
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
      commonUses: 'Häufige Anwendungsbereiche',
      quantityInUnits: 'Menge in Packungen',
      howToTake: 'Einnahme & Vorsichtsmaßnahmen',
      matchedGroup: 'Passend zu: {group}',
      dosePerDose: 'Übliche Dosis: {value}',
      doseMaxDoses: 'Nicht mehr als {value} Dosen innerhalb von 24 Stunden.',
      doseInterval: 'Zwischen zwei Dosen mindestens {value} Stunden warten.',
      doseDuration: 'Ohne ärztlichen Rat nicht länger als {value} Tage selbst behandeln.',
      ageFromMonths: 'ab {value} Monaten',
      ageFromYears: 'ab {value} Jahren',
      ageApproved: 'Zugelassen {from}.',
      ageApprovedUntil: 'Zugelassen {from}, bis {max} Jahre.',
      warningAllergyTerms: 'Nicht einnehmen bei einer Allergie gegen: {terms}.',
      warningDuplicate: 'Nicht zusammen mit einem anderen Arzneimittel einnehmen, das {name} enthält.',
      warningInteractionTerms: 'Nicht mit anderen Arzneimitteln kombinieren, insbesondere: {terms}.',
      warningConsultTerms: 'Vor der Einnahme ärztlich abklären, wenn Folgendes auf Sie zutrifft: {terms}.',
      vendingSlot: 'Ausgabefach {slot}',
      slotReadyToDispense: 'Vorrätig & bereit zur Ausgabe',
      dispenseNow: 'Aus Fach {slot} ausgeben',
      dispensingInProgress: 'Ausgabe läuft…',
      dispenseSuccess: 'Medikament ausgegeben! Bitte entnehmen Sie Ihre Packung aus dem Ausgabefach.',
      clinicalRecord: 'Klinische Beratungsübersicht',
      metricSymptom: 'Beurteilte Indikation',
      metricAgeBand: 'Altersprüfung',
      metricDuration: 'Gemeldete Dauer',
      metricSafetyStatus: 'Sicherheitsprüfung',
      safetyCleared: 'Geeignet zur Selbstmedikation',
      safetySummary: 'Zusammenfassung der Sicherheitsprüfung',
      printSummary: 'Beratungsnotiz drucken',
      copySummary: 'Notiz kopieren',
      summaryCopied: 'In die Zwischenablage kopiert!',
      chooseDifferentSymptom: '← Anderes Symptom wählen',
      correctAge: '← Mein Alter korrigieren',
      reviewDuration: '← Dauer überprüfen',
    },
    option_subtitle: {
      symptom: {
        pain_fever: 'Kopfschmerzen, Fieber, Zahnschmerzen, Muskelschmerzen',
        cold_cough: 'Halsschmerzen, Husten, laufende oder verstopfte Nase',
        allergy: 'Heuschnupfen, Niesen, juckende oder tränende Augen',
        diarrhoea: 'Akuter wässriger Durchfall, Elektrolytausgleich',
        heartburn: 'Sodbrennen, saures Aufstoßen, Magenbrennen',
        skin_minor_wound: 'Kleine Schürfwunden, Schnittwunden, Antiseptika',
        other: 'Zahnschmerzen, Nebenhöhlen oder eigene Worte sprechen',
      },
      severity: {
        mild: 'Leichte Beschwerden, schränkt Alltag nicht ein',
        moderate: 'Mäßige Schmerzen, beeinträchtigt Schlaf oder Arbeit',
        severe: 'Starke Schmerzen, ärztliche Abklärung nötig',
      },
      duration: {
        today: 'Heute oder letzte Nacht begonnen',
        '1_to_2_days': 'Kürzlich begonnen (vor 1–2 Tagen)',
        '3_to_7_days': 'Seit mehreren Tagen (3–7 Tage)',
        more_than_7_days: 'Länger als eine Woche (Arztbesuch empfohlen)',
      },
      warning_signs: {
        no: 'Keines der ernsten Warnzeichen trifft zu',
        yes: 'Ich habe eines oder mehrere ernste Symptome',
        not_sure: 'Ich bin unsicher, Fachpersonal hinzuziehen',
      },
      pregnancy_breastfeeding: {
        no: 'Weder schwanger noch stillend',
        pregnant: 'Aktuell schwanger (ärztlicher Rat nötig)',
        breastfeeding: 'Aktuell stillend',
        both: 'Sowohl schwanger als auch stillend',
        not_applicable: 'Nicht zutreffend',
        prefer_not_to_say: 'Keine Angabe',
      },
      allergy_status: {
        no: 'Keine bekannten Medikamentenallergien',
        yes: 'Bekannte Allergie gegen Paracetamol, NSAID etc.',
        not_sure: 'Nicht ganz sicher',
      },
      medication_status: {
        no: 'Keine regelmäßigen anderen Medikamente',
        yes: 'Einnahme von rezeptpflichtigen/rezeptfreien Mitteln',
        not_sure: 'Nicht ganz sicher',
      },
      condition_status: {
        no: 'Keine chronischen Vorerkrankungen',
        yes: 'Asthma, Bluthochdruck, Magengeschwür etc.',
        not_sure: 'Nicht ganz sicher',
      },
      confirm: {
        yes: 'Alle Angaben stimmen, Produktprüfung starten',
        no: 'Eine Antwort ändern oder neu beginnen',
      },
    },
    custom_symptom: {
      stepLabel: 'Sprechen · Tippen · oder Symptom wählen',
      title: 'Beschreiben Sie Ihre Beschwerden',
      subtitle: 'Wählen Sie unten ein häufiges Symptom oder sprechen/tippen Sie in eigenen Worten (z. B. Zahnschmerzen, Rückenschmerzen, Nebenhöhlendruck).',
      speakHint: 'Tippen Sie auf das Mikrofon oder tippen Sie unten, um Ihre Beschwerden zu beschreiben.',
      backToMain: '← Zurück zu den Hauptkategorien',
      otherCareNotice: 'Wenn Ihre Beschwerde nicht rezeptfrei behandelbar ist, vermittelt unser System Sie an eine Klinik oder einen Arzt.',
      toothache: 'Zahnschmerzen / Zahnbeschwerden',
      toothacheSub: 'Linderung bei Zahn-, Zahnfleisch- oder Kieferschmerzen',
      backPain: 'Muskel- oder Rückenschmerzen',
      backPainSub: 'Linderung bei Muskel-, Gelenk- oder Rückenschmerzen',
      sinus: 'Nebenhöhlendruck / Verstopfte Nase',
      sinusSub: 'Abschwellende Nasensprays und Linderung',
      heartburn: 'Sodbrennen / Magenbeschwerden',
      heartburnSub: 'Magensäure-Neutralisierer und Magenschutz',
      allergy: 'Juckende Augen / Heuschnupfen',
      allergySub: 'Antihistaminika gegen allergische Beschwerden',
      wound: 'Kleine Schürf- oder Schnittwunde',
      woundSub: 'Antiseptische Spülung, Pflaster oder Verband',
      earache: 'Ohrenschmerzen',
      earacheSub: 'Schmerz- und Fieberlinderung bei Ohrenschmerzen',
      otherPathway: 'Anderes / Oben nicht aufgeführt',
      otherPathwaySub: 'Weiterleitung an Klinik oder Arzt',
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

STRINGS.hi = HINDI_PREVIEW;
STRINGS.en.voiceOpening = 'Hello, I’m your PILLPAL assistant. Tell me what’s bothering you.';
STRINGS.de.voiceOpening = 'Hallo, ich bin Ihr PILLPAL-Assistent. Erzählen Sie mir, welche Beschwerden Sie haben.';
STRINGS.hi.voiceOpening = 'नमस्ते, मैं आपका PILLPAL सहायक हूँ। बताइए, आपको क्या परेशानी हो रही है?';
STRINGS.en.voiceSymptomClarification = 'Could you describe your main symptom and where you feel it?';
STRINGS.de.voiceSymptomClarification = 'Können Sie Ihre Hauptbeschwerde beschreiben und sagen, wo Sie sie spüren?';
STRINGS.hi.voiceSymptomClarification = 'कृपया अपनी मुख्य परेशानी बताइए और यह भी बताइए कि वह कहाँ महसूस हो रही है।';
STRINGS.en.voiceQuestion = {
  age: 'How old are you?',
  duration: 'When did this start, and how long have you been feeling this way?',
  severity: 'How bad does it feel right now?',
  warning_signs: 'Before we go on, I need to check for some warning signs. Please listen to the full list.',
  safety_background_status: 'For your safety, tell me if pregnancy or breastfeeding could apply, or if you have medicine allergies, take any medicines, or have an ongoing health condition. Include medicines bought without a prescription. If none of that applies, tell me. It is fine to say you are not sure.',
  pregnancy_breastfeeding: 'Could you be pregnant or breastfeeding? If this cannot apply to you, just tell me. If you are unsure or would rather not say, tell me that too.',
  medical_history_status: 'Do you have any medicine allergies, take any medicines, or have an ongoing health condition? Include medicines bought without a prescription. Tell me if you are unsure.',
  allergy_status: 'Are you allergic to any medicines? Tell me if you are not sure.',
  allergy_terms: 'Which medicines or ingredients are you allergic to? Please tell me their names. If you do not know, tell me that.',
  medication_status: 'Are you taking any medicines at the moment, including ones you bought without a prescription? Tell me if you are unsure.',
  medication_terms: 'Please tell me the names of the medicines you are taking. If you do not know a name, tell me that.',
  condition_status: 'Do you have any ongoing health conditions? Tell me if you are not sure.',
  condition_terms: 'Please tell me which health conditions you have. If you are unsure, tell me that.',
  confirm: 'Have I understood everything correctly? If something is wrong, tell me so we can start again and correct it.',
};
STRINGS.de.voiceQuestion = {
  age: 'Wie alt sind Sie?',
  duration: 'Wann hat das angefangen, und wie lange haben Sie diese Beschwerden schon?',
  severity: 'Wie stark sind Ihre Beschwerden im Moment?',
  warning_signs: 'Bevor wir weitermachen, muss ich nach einigen Warnzeichen fragen. Bitte hören Sie sich die ganze Liste an.',
  safety_background_status: 'Zu Ihrer Sicherheit: Könnten Schwangerschaft oder Stillzeit auf Sie zutreffen? Haben Sie Medikamentenallergien, nehmen Sie Medikamente oder haben Sie eine bestehende Erkrankung? Denken Sie auch an rezeptfreie Medikamente. Wenn nichts davon zutrifft oder Sie unsicher sind, sagen Sie mir das bitte.',
  pregnancy_breastfeeding: 'Könnten Sie schwanger sein oder stillen Sie? Wenn das auf Sie nicht zutreffen kann, sagen Sie mir das bitte. Sagen Sie auch, wenn Sie unsicher sind oder dazu keine Angabe machen möchten.',
  medical_history_status: 'Haben Sie Medikamentenallergien, nehmen Sie Medikamente oder haben Sie eine bestehende Erkrankung? Denken Sie auch an rezeptfreie Medikamente. Sagen Sie mir bitte, wenn Sie unsicher sind.',
  allergy_status: 'Sind Sie gegen Medikamente allergisch? Sagen Sie mir bitte, wenn Sie unsicher sind.',
  allergy_terms: 'Gegen welche Medikamente oder Inhaltsstoffe sind Sie allergisch? Nennen Sie mir bitte die Namen. Wenn Sie diese nicht kennen, sagen Sie mir das.',
  medication_status: 'Nehmen Sie zurzeit Medikamente, auch rezeptfreie? Sagen Sie mir bitte, wenn Sie unsicher sind.',
  medication_terms: 'Wie heißen die Medikamente, die Sie einnehmen? Wenn Sie einen Namen nicht kennen, sagen Sie mir das bitte.',
  condition_status: 'Haben Sie eine bestehende Erkrankung? Sagen Sie mir bitte, wenn Sie unsicher sind.',
  condition_terms: 'Welche Erkrankungen haben Sie? Wenn Sie unsicher sind, sagen Sie mir das bitte.',
  confirm: 'Habe ich alles richtig verstanden? Wenn etwas nicht stimmt, sagen Sie mir das bitte. Dann beginnen wir neu und korrigieren es.',
};
STRINGS.en.voiceReadbackIntro = 'Let me check that I understood you.';
STRINGS.de.voiceReadbackIntro = 'Ich fasse kurz zusammen, was ich verstanden habe.';
STRINGS.en.voiceWarningReply = 'Do any of these apply to you? Please tell me, even if you are not sure.';
STRINGS.de.voiceWarningReply = 'Trifft eines dieser Warnzeichen auf Sie zu? Sagen Sie mir das bitte, auch wenn Sie unsicher sind.';
STRINGS.en.voiceSeverityClarification = 'Could you describe the discomfort as mild, moderate, or severe?';
STRINGS.de.voiceSeverityClarification = 'Würden Sie die Beschwerden als leicht, mittelstark oder schwer beschreiben?';
STRINGS.en.setup.catalogPending = 'Assessment is available. Medicine recommendations await a verified local catalogue.';
STRINGS.de.setup.catalogPending = 'Die Prüfung ist verfügbar. Medikamentenempfehlungen warten auf einen verifizierten lokalen Katalog.';

export function languageCoverage(code) {
  const base = languageByCode(code)?.code || 'en';
  if (['de', 'en'].includes(base)) return { interface: 'complete', clinical_validation: false, speech: 'runtime-dependent' };
  return { interface: base === 'hi' ? 'preview' : 'english-fallback', clinical_validation: false, speech: 'unvalidated' };
}

STRINGS.en.premium = {
  start: 'Start conversation', transcript: 'Transcript', type: 'Type', microphone: 'Microphone', speaker: 'Speaker', end: 'End',
  connected: 'Network available', offline: 'Offline · local assessment available',
  hint_idle: 'Tap the orb to start. You can also type or use touch.',
  hint_listening: 'Speak naturally. I will stop when your turn is complete.',
  hint_thinking: 'Checking your answer with the medical safety workflow.',
  hint_speaking: 'Start speaking to interrupt. You can also tap the orb.',
  hint_error: 'Check microphone permission or connection. Text and touch remain available.',
  hint_ended: 'The conversation and local transcript have been cleared.',
  label_idle: 'Ready', label_listening: 'Listening to you', label_thinking: 'Checking your answer',
  label_speaking: 'MedAssist is speaking', label_error: 'Needs attention', label_ended: 'Session complete',
};
STRINGS.de.premium = {
  start: 'Gespräch starten', transcript: 'Verlauf', type: 'Tippen', microphone: 'Mikrofon', speaker: 'Lautsprecher', end: 'Beenden',
  connected: 'Netzwerk verfügbar', offline: 'Offline · lokale Prüfung verfügbar',
  hint_idle: 'Zum Starten auf die Kugel tippen. Tippen und Touch-Eingabe sind ebenfalls möglich.',
  hint_listening: 'Sprechen Sie natürlich. Nach Ihrer Antwort wird die Aufnahme beendet.',
  hint_thinking: 'Ihre Antwort wird mit den Sicherheitsregeln geprüft.',
  hint_speaking: 'Sprechen Sie, um mich zu unterbrechen. Sie können auch auf die Kugel tippen.',
  hint_error: 'Bitte Mikrofonberechtigung oder Verbindung prüfen. Text und Touch bleiben verfügbar.',
  hint_ended: 'Das Gespräch und der lokale Verlauf wurden gelöscht.',
  label_idle: 'Bereit', label_listening: 'Ich höre Ihnen zu', label_thinking: 'Ihre Antwort wird geprüft',
  label_speaking: 'MedAssist spricht', label_error: 'Bitte prüfen', label_ended: 'Gespräch beendet',
};
Object.assign(STRINGS.en.premium, {
  noMatch: 'I did not understand that answer.', missingAnswer: 'I still need this answer to complete the safety assessment.',
  privateTranscript: 'Private session transcript', conversation: 'Conversation', textFallback: 'Text fallback',
  typeAnswer: 'Type your answer', ended: 'Conversation ended', cleared: 'Your private session has been cleared',
  privacy: 'The browser transcript is cleared when this session ends. This assistant does not replace medical care.',
  newConversation: 'Start a new conversation', startTalking: 'Start talking', stopListening: 'Stop listening',
  interrupt: 'Interrupt assistant and speak', closeTranscript: 'Close transcript', closeText: 'Close text input',
});
Object.assign(STRINGS.de.premium, {
  noMatch: 'Ich habe diese Antwort nicht verstanden.', missingAnswer: 'Für die Sicherheitsprüfung benötige ich noch diese Antwort.',
  privateTranscript: 'Privater Gesprächsverlauf', conversation: 'Gespräch', textFallback: 'Texteingabe als Alternative',
  typeAnswer: 'Antwort eingeben', ended: 'Gespräch beendet', cleared: 'Ihre private Sitzung wurde gelöscht',
  privacy: 'Der Verlauf im Browser wird am Sitzungsende gelöscht. Dieser Assistent ersetzt keine medizinische Betreuung.',
  newConversation: 'Neues Gespräch starten', startTalking: 'Gespräch starten', stopListening: 'Aufnahme beenden',
  interrupt: 'Assistenten unterbrechen und sprechen', closeTranscript: 'Verlauf schließen', closeText: 'Texteingabe schließen',
});
STRINGS.en.result.message.incomplete = 'The safety assessment is incomplete. Please restart or ask a pharmacist.';
STRINGS.de.result.message.incomplete = 'Die Sicherheitsprüfung ist unvollständig. Bitte starten Sie neu oder fragen Sie in einer Apotheke nach.';

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
  const raw = String(code || '').toLowerCase();
  const base = raw === 'auto' ? 'auto' : raw.split('-')[0];
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

export function optionSubtitle(questionId, value, lang) {
  return tn(`option_subtitle.${questionId}.${value}`, lang, null);
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
    red_flags: Array.isArray(screen.red_flags)
      ? screen.red_flags.map(flag => RED_FLAG_TRANSLATIONS[languageByCode(lang)?.code]?.[flag] || flag)
      : screen.red_flags,
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

// Translate the exact engine items; never replace a pathway list with generic text.
const RED_FLAG_TRANSLATIONS = {
  de: {
    'stiff neck with sensitivity to light, or a rash that does not fade when you press a glass on it': 'Nackensteifigkeit mit Lichtempfindlichkeit oder ein Hautausschlag, der beim Drücken eines Glases nicht verblasst',
    'confusion, fainting, or difficulty staying awake': 'Verwirrtheit, Ohnmacht oder Schwierigkeiten, wach zu bleiben',
    'trouble breathing, chest pain or pressure': 'Atemnot, Brustschmerzen oder Druck auf der Brust',
    'a sudden severe headache unlike any you have had before': 'Plötzliche starke Kopfschmerzen, wie Sie sie noch nie zuvor hatten',
    'fever above 39.5 C, or fever that does not come down after medicine': 'Fieber über 39,5 °C oder Fieber, das nach der Einnahme eines fiebersenkenden Mittels nicht sinkt',
    'you are immunosuppressed (chemotherapy, transplant, long-term steroids) or pregnant': 'Ihr Immunsystem ist geschwächt (Chemotherapie, Transplantation, langfristige Steroidbehandlung) oder Sie sind schwanger',
  },
};

const REASON_MESSAGE_KEYS = {
  incomplete_safety_assessment: 'result.message.incomplete',
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
    message: (messageKey ? t(messageKey, lang) : entry?.message || '')
      + (outcome === 'IMMEDIATE_MEDICAL_CARE' && entry?.state?.country_code === 'DE'
        ? (languageByCode(lang)?.code === 'de' ? ' Bei einem Notfall wählen Sie 112.' : ' In an emergency in Germany, call 112.') : ''),
  };
}

export function summaryValue(key, value, lang) {
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
  'gestern', 'vorgestern', 'jahre', 'jahren', 'stunde', 'stunden',
  'schlecht', 'krank', 'grippe', 'tablette', 'tabletten',
  'kopf', 'hals', 'bauch', 'magen', 'weh', 'deutsch', 'deutsches',
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
  if (!text) return null;
  const raw = String(text);

  // Unicode script detection
  if (/[\u0C00-\u0C7F]/.test(raw)) return 'te'; // Telugu
  if (/[\u0900-\u097F]/.test(raw)) return 'hi'; // Hindi / Devanagari
  if (/[\u0600-\u06FF]/.test(raw)) return 'ar'; // Arabic

  // Explicit language requests (e.g. "talk in telugu", "speak in telugu", "telugu lo matladu")
  if (/\b(?:talk|speak|in)\s+telugu\b|\btelugu\s+(?:lo|me|lo\s+matladu)\b|\btelugu\b/i.test(raw)) return 'te';
  if (/\b(?:talk|speak|in)\s+hindi\b|\bhindi\s+me\b/i.test(raw)) return 'hi';
  if (/\b(?:talk|speak|in)\s+french\b|\bparlez\s+francais\b/i.test(raw)) return 'fr';
  if (/\b(?:talk|speak|in)\s+german\b|\bauf\s+deutsch\b/i.test(raw)) return 'de';

  const normalized = normalizeText(raw);
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
