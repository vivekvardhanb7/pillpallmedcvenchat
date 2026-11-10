export function normalizeSpeech(value) {
  return String(value ?? '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SMALL_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6,
  sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwolf: 12, dreizehn: 13,
  vierzehn: 14, funfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
};
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  zwanzig: 20, dreissig: 30, vierzig: 40, funfzig: 50, sechzig: 60, siebzig: 70,
  achtzig: 80, neunzig: 90,
};
const HUNDRED_WORDS = new Set(['hundred', 'hundert']);

function germanCompound(word) {
  const match = word.match(/^([a-z]+)und([a-z]+)$/);
  if (!match) return null;
  const unit = SMALL_NUMBERS[match[1]];
  const ten = TENS[match[2]];
  if (unit == null || ten == null || unit >= 10) return null;
  return ten + unit;
}

export function spokenNumber(text) {
  const normalized = normalizeSpeech(text);
  const digit = normalized.match(/\b(?:120|1[01][0-9]|[1-9]?[0-9])\b/);
  if (digit) return Number(digit[0]);
  const words = normalized.split(' ');
  let total = 0;
  let found = false;
  for (const word of words) {
    const compound = germanCompound(word);
    if (compound != null) { total += compound; found = true; }
    else if (Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, word)) { total += SMALL_NUMBERS[word]; found = true; }
    else if (Object.prototype.hasOwnProperty.call(TENS, word)) { total += TENS[word]; found = true; }
    else if (HUNDRED_WORDS.has(word) && found) total *= 100;
  }
  return found && total <= 120 ? total : null;
}

function optionByValue(screen, value) {
  return (screen.options || []).find(option => option.value === value) || null;
}

// Spoken replies to a read-back confirmation. Kept deliberately narrow: an
// affirmation must consist of nothing but affirmation words, so a sentence that
// carries new content is never spent as a "yes". A bare denial re-opens the
// question, which is the safe direction to be wrong in.
const AFFIRMATION_WORDS = new Set([
  'yes', 'yeah', 'yep', 'yup', 'correct', 'right', 'true', 'ok', 'okay', 'okey', 'sure',
  'fine', 'good', 'confirm', 'confirmed', 'approve', 'approved', 'approval', 'proceed',
  'check', 'products', 'product', 'go', 'ahead', 'continue', 'please', 'perfect',
  'absolutely', 'exactly', 'done', 'accept', 'accepted', 'agree', 'agreed', 'show',
  'now', 'definitely', 'sounds', 'great', 'thats', 'that', 'is', 'it', 'all',
  'oui', 'ouais', 'daccord', 'valider', 'valide', 'bon', 'exact', 'parfait', 'verifie', 'verifier',
  'ja', 'jawohl', 'genau', 'richtig', 'stimmt', 'das', 'ist', 'bestatigt', 'einverstanden', 'gerne', 'super', 'weiter', 'prufen',
  'wakha', 'safi', 'naam', 'na\'am', 'iyah', 'tamam', 'sahih', 'mzyan', 'mezyan', 'aywa',
  'haan', 'ha', 'sahi', 'theek', 'thik', 'accha', 'karo',
  'avunu', 'sare', 'alage', 'nijam',
]);
const DENIAL_WORDS = new Set([
  'no', 'nope', 'wrong', 'incorrect', 'not', 'again', 'change', 'restart', 'different',
  'cancel', 'stop', 'back', 'never', 'refuse',
  'non', 'faux', 'pas', 'changer', 'recommencer', 'annuler', 'jamais', 'retour',
  'nein', 'falsch', 'nicht', 'anders', 'anderes', 'nocheinmal', 'abbrechen', 'zuruck',
  'la', 'laa', 'khatie', 'baddel', 'lao', 'rejea',
  'nahi', 'na', 'galat', 'badlo', 'roko', 'wapas',
  'kaadu', 'ledu', 'oddu', 'malli', 'venakki',
]);

export function resolveConfirmationReply(text) {
  const normalized = normalizeSpeech(text);
  if (!normalized) return null;
  const words = normalized.split(' ').filter(Boolean);
  if (!words.length) return null;

  // Explicit denial or restart intent
  if (/\b(no|nope|wrong|incorrect|restart|again|change|different|cancel|stop|recommencer|non|faux|annuler|nein|falsch|nicht|anders|abbrechen|la|laa|khatie|baddel|nahi|galat|kaadu|ledu|oddu)\b/.test(normalized)) {
    return 'no';
  }

  // Explicit approval, confirmation, or affirmation phrase
  if (/\b(ok approve|approve|approved|proceed|check products|check|go ahead|sounds good|looks good|all good|yes please|confirm|confirmed|oui|d\s*accord|daccord|valider|c\s*est\s*bon|wakha|safi|tamam|na\s*am|naam|haan|theek|avunu|sare|correct|right)\b/.test(normalized)) {
    return 'yes';
  }

  if (words.every(word => AFFIRMATION_WORDS.has(word))) return 'yes';
  if (words.some(word => DENIAL_WORDS.has(word))) return 'no';
  return null;
}

export function resolveVoiceAnswer(text, screen) {
  const spoken = normalizeSpeech(text);
  if (!spoken || !screen) return null;
  if (screen.type === 'text') return { value: text, label: text };
  if (screen.type === 'number') {
    const number = spokenNumber(spoken);
    return number == null ? null : { value: number, label: String(number) };
  }

  const q = screen.question_id;
  let value = null;
  if (q === 'symptom') {
    if (/(?:^|[^\p{L}\p{N}])(headache|headaches|head\s*(?:ache|deck|pain|hurts?|pounding)|migraine|migrane|pain|fever|favor|fevor|faver|fevr|feber|temperature|toothache|tooth\s*pain|teeth|earache|ear\s*pain|backache|back\s*pain|muscle\s*pain|body\s*(?:ache|pain|pains)|joint\s*pain|neck\s*pain|period\s*pain|menstrual\s*cramps?|shivering|chills|feverish|body\s*ache|body\s*pains|kopfschmerzen|kopfschmerz|kopfweh|schmerzen|schmerz|fieber|zahnschmerzen|zahnweh|ohrenschmerzen|ohrenweh|ruckenschmerzen|muskelschmerzen|regelschmerzen|mal\s+(?:a\s+la\s+|de\s+)?tete|fievre|douleur|courbatures?|maux\s+de\s+tete|rasi\s+kaydarni|skhana|hriq|berd|sar\s*dard|सरदर्द|सिर\s*दर्द|bukhar|बुखार|thala\s*noppi|తలనెప్పి|తల\s*నొప్పి|తలపోటు|jwaram|జ్వరం)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'pain_fever';
    else if (/(?:^|[^\p{L}\p{N}])(allergy|allergies|hay\s*fever|itchy\s*eyes|watery\s*eyes|hives|urticaria|allergic|allergie|allergien|heuschnupfen|juckende\s*augen|allergique|dammou|एलर्जी|అలెర్జీ)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'allergy';
    else if (/(?:^|[^\p{L}\p{N}])(cold|cough|sore\s*throat|throat\s*pain|throat\s*irritation|runny\s*nose|running\s*nose|sinus|sinuses|congestion|congested|stuffy\s*nose|blocked\s*nose|phlegm|mucus|flu|sneezing|erkaltung|husten|halsschmerzen|halsweh|schnupfen|verstopfte\s*nase|nasennebenhohlen|rhume|toux|mal\s+de\s+gorge|nez\s+bouche|lahlaqem|khasi|खांसी|zukam|जुकाम|gala\s*kharab|daggu|దగ్గు|jalubu|జలుబు|గొంతు\s*నొప్పి)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'cold_cough';
    else if (/(?:^|[^\p{L}\p{N}])(diarrhea|diarrhoea|loose\s*(?:motion|motions|stool|stools)|motions|upset\s*(?:bowel|stomach)|stomach\s*flu|food\s*poisoning|watery\s*stool|cramps?\s*(?:in|and)\s*diarrhoea|durchfall|dunnfluss|diarrhee|mal\s+au\s+ventre|kerchi|dast|दस्त|విరేచనాలు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'diarrhoea';
    else if (/(?:^|[^\p{L}\p{N}])(heartburn|acid\s*reflux|stomach\s*discomfort|indigestion|acid\s*stomach|acidity|gas|gas\s*trouble|chest\s*burning|burning\s*sensation|sour\s*burps?|bloating|upset\s*stomach|sodbrennen|magenbeschwerden|verdauungsstorungen|magendruck|bauchschmerzen|bauchweh|magenschmerzen|brulure\s*d\s*estomac|reflux|acidite|hmoeda|pet\s*dard|पेट\s*दर्द|kadupu\s*noppi|కడుపు\s*నొప్పి)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'heartburn';
    else if (/(?:^|[^\p{L}\p{N}])(skin|wound|cut|scrape|scratch|abrasion|minor\s*burn|blister|insect\s*bite|rash|antiseptic|haut|wunde|schnitt|schurfwunde|kratzer|insektenstich|ausschlag|peau|blessure|coupure|brulure|jarh|घाव|चोट|గాయం)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'skin_minor_wound';
    else if (/(?:^|[^\p{L}\p{N}])(other|something else|none of these|andere|anderes|etwas anderes|keines davon|sonstiges|autre|ghirha|kuch\s*aur|వేరే)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'other';
  } else if (q === 'duration') {
    if (/(?:^|[^\p{L}\p{N}])(today|this\s*morning|this\s*afternoon|this\s*evening|since\s*morning|since\s*this\s*morning|few\s*hours|a\s*few\s*hours|couple\s*(?:of\s*)?hours|last\s*night|from\s*last\s*night|since\s*last\s*night|just\s*now|heute|heute\s*morgen|heute\s*mittag|seit\s*heute|seit\s*heute\s*morgen|ein\s*paar\s*stunden|vor\s*ein\s*paar\s*stunden|gerade\s*eben|aujourd\s*hui|ce\s*matin|hier\s*soir|lyoum|aaj\s*se|आज|eroju|ఈరోజు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'today';
    else if (/(?:^|[^\p{L}\p{N}])(yesterday|since\s*yesterday|from\s*yesterday|one\s*day|two\s*days|a\s*day|a\s*couple\s*(?:of\s*)?days|couple\s*(?:of\s*)?days|1\s*day|2\s*days|from\s*2\s*days|since\s*2\s*days|2\s*days\s*ago|seit\s*gestern|gestern|vorgestern|einen\s*tag|zwei\s*tage|zwei\s*tagen|hier|depuis\s*hier|un\s*jour|deux\s*jours|lbarah|men\s*lbarah|yawmayn|kal\s*se|do\s*din|कल\s*से|दो\s*दिन|ninna|నిన్న|rendu\s*rojulu|రెండు\s*రోజులు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = '1_to_2_days';
    else if (/(?:^|[^\p{L}\p{N}])(more\s*than|over|longer\s*than|mehr\s*als|langer\s*als|uber|plus\s*d\s*une)\s+(?:a|one|1|eine|einer|two|2|zwei)?\s*(?:week|weeks|woche|wochen|semaine|semaines)(?=[^\p{L}\p{N}]|$)/u.test(spoken) || /(?:^|[^\p{L}\p{N}])(more\s*than|over|plus\s*de)\s+(?:7|seven|sept)\s+days?(?=[^\p{L}\p{N}]|$)/u.test(spoken) || /(?:^|[^\p{L}\p{N}])(weeks|wochen|a\s*month|one\s*month|months|monat|monate|semaines|un\s*mois|mois|seit\s*wochen|hafto\s*se|हफ्तों\s*से|chala\s*rojulu|చాలా\s*రోజులు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'more_than_7_days';
    else if (/(?:^|[^\p{L}\p{N}])(three|four|five|six|seven|3|4|5|6|7|drei|vier|funf|sechs|sieben|trois|quatre|cinq|six|sept|teen|char|panch|chah|saat|moodu|nalugu|aidu|aaru|yedu)\s+(?:days?|tage?|tagen?|jours?|din|दिन|rojulu|రోజులు)(?=[^\p{L}\p{N}]|$)/u.test(spoken) || /(?:^|[^\p{L}\p{N}])(several|a\s*few|couple\s*(?:of\s*)?|few)\s+days?(?=[^\p{L}\p{N}]|$)/u.test(spoken) || /(?:^|[^\p{L}\p{N}])(a|one|1|eine|une)\s+(?:week|woche|semaine|hafta|వారం)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = '3_to_7_days';
  } else if (q === 'severity') {
    if (/(?:^|[^\p{L}\p{N}])(severe|very\s*bad|really\s*bad|extremely|extreme|unbearable|unberable|worst|intense|strong|killing\s*me|high|too\s*much|schwer|sehr\s*stark|extrem|stark|unertraglich|grave|tres\s*fort|insupportable|qwi|bzaf|bahut\s*jyada|बहुत\s*ज्यादा|ekkuva|ఎక్కువ)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'severe';
    else if (/(?:^|[^\p{L}\p{N}])(moderate|medium|mittel|massig|moderat|uncomfortable|quite\s*bad|fairly\s*bad|ziemlich|average|normal|okay|modere|moyen|chwia|madhyam|मध्यम|parledu|పర్లేదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'moderate';
    else if (/(?:^|[^\p{L}\p{N}])(mild|slight|light|little|minor|barely|not\s*too\s*bad|not\s*bad|manageable|bearable|low|a\s*little\s*bit|just\s*a\s*little|leicht|gering|etwas|kaum|leger|un\s*peu|pas\s*trop|thoda|kam|थोड़ा|कम|chinna|చిన్న|తక్కువ)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'mild';
  } else if (q === 'pregnancy_breastfeeding') {
    if (/(?:^|[^\p{L}\p{N}])(keine angabe|mochte nicht sagen|moechte nicht sagen|will nicht sagen|prefer not|rather not)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'prefer_not_to_say';
    else if (/(?:^|[^\p{L}\p{N}])(both|beides|beide|రెండు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'both';
    else if (/(?:^|[^\p{L}\p{N}])(not pregnant|not breastfeeding|not breast feeding|no|none|nicht schwanger|nicht stillend|nicht stillen|nein|keine|కాదు|లేదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'no';
    else if (/(?:^|[^\p{L}\p{N}])(breastfeeding|breast feeding|nursing|stillend|stillen|stille|పాలివ్వడం)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'breastfeeding';
    else if (/(?:^|[^\p{L}\p{N}])(pregnant|pregnancy|schwanger|schwangerschaft|गर्भवती|గర్భవతి)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'pregnant';
    else if (/(?:^|[^\p{L}\p{N}])(not applicable|does not apply|nicht zutreffend|trifft nicht zu|వర్తించదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'not_applicable';
  } else if (q === 'safety_background_status') {
    if (/(?:^|[^\p{L}\p{N}])(not sure|unsure|do not know|dont know|don t know|maybe|nicht sicher|unsicher|pas sur|ma arftch|pata nahi|पता\s*नहीं|theliyadu|తెలియదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'not_sure';
    else if (/(?:^|[^\p{L}\p{N}])(both|both groups|beides|beide gruppen|les deux|dono|दोनों|iddaru|ఇద్దరూ|రెండు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'both';
    else if (/(?:^|[^\p{L}\p{N}])(pregnant|pregnancy|breastfeeding|breast feeding|nursing|schwanger|stillend|enceinte|allaitement|hamel|gardhavathi|గర్భవతి)(?=[^\p{L}\p{N}]|$)/u.test(spoken)
      && /(?:^|[^\p{L}\p{N}])(allergy|medicine|medication|condition|allergie(?:n)?|medikament(?:e|en)?|erkrankung(?:en)?|medicament|dawa|दवा|mandhu|మందు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'both';
    else if (/(?:^|[^\p{L}\p{N}])(pregnant|pregnancy|breastfeeding|breast feeding|nursing|schwanger|stillend|enceinte|allaitement|hamel|gardhavathi|గర్భవతి)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'pregnancy';
    else if (/(?:^|[^\p{L}\p{N}])(allergy|allergies|medicine|medicines|medication|medications|condition|conditions|allergie(?:n)?|medikament(?:e|en)?|erkrankung(?:en)?|medicament|maladie|dawa|bimari|mandhu|మందులు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)
      ) value = 'history';
    else if (/(?:^|[^\p{L}\p{N}])(no|none|none\s*of\s*these|nothing|do\s*not\s*have|dont\s*have|don\s*t\s*have|not\s*applicable|clean|healthy|no\s*allergies|no\s*medicine|nein|keine|keines\s*davon|nichts\s*davon|non|aucun|aucune|rien|rien\s*a\s*signaler|walou|walo|makan|kuch\s*nahi|कुछ\s*नहीं|nahi|नहीं|ledu|లేదు|kaadu|కాదు|em\s*ledu|ఏం\s*లేదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) value = 'none';
  } else if (q === 'confirm') {
    // "Not sure" must never match the affirmative word "sure".
    if (/(?:^|[^\p{L}\p{N}])(not\s*sure|unsure|dont\s*know|do\s*not\s*know|don\s*t\s*know|maybe|nicht\s*sicher|unsicher|weiss(?:\s*ich|\s*es)?\s*nicht)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) return null;
    if (/(?:^|[^\p{L}\p{N}])(no|restart|start\s*again|change|incorrect|wrong|different|cancel|stop|recommencer|non|faux|annuler|nein|neu\s*starten|neu\s*beginnen|andern|falsch|nicht\s*richtig|abbrechen|la|laa|khatie|baddel|nahi|नहीं|galat|गलत|phir\s*se|kaadu|కాదు|ledu|లేదు|oddu|వద్దు|malli|మళ్ళీ)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) {
      value = 'no';
    } else if (/(?:^|[^\p{L}\p{N}])(yes|yeah|yep|yup|confirm|confirmed|approve|approved|proceed|check|products?|go\s*ahead|ahead|okay|ok|sure|continue|correct|right|good|done|accept|agree|show|now|please|oui|ouais|d\s*accord|daccord|valider|valide|c\s*est\s*bon|verifie|ja|bestatigen|richtig|weiter|wakha|safi|tamam|na\s*am|naam|iyah|haan|ha|हाँ|हां|theek|thik|ठीक|avunu|అవును|sare|సరే)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) {
      value = 'yes';
    }
  } else if (['warning_signs', 'medical_history_status', 'allergy_status', 'medication_status', 'condition_status'].includes(q)) {
    if (/(?:^|[^\p{L}\p{N}])(not\s*sure|unsure|do\s*not\s*know|dont\s*know|don\s*t\s*know|maybe|nicht\s*sicher|unsicher|weiss\s*nicht|weiss\s*es\s*nicht|keine\s*ahnung|vielleicht|pas\s*sur|je\s*sais\s*pas|ma\s*arftch|pata\s*nahi|पता\s*नहीं|theliyadu|తెలియదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) {
      value = 'not_sure';
    } else if (/(?:^|[^\p{L}\p{N}])(no|none|negative|do\s*not\s*have|dont\s*have|don\s*t\s*have|nothing|neither|no\s*warning|no\s*other|no\s*problem|all\s*good|fine|i\s*am\s*fine|i\s*dont|only\s*(?:headache|fever|cold|pain)|nein|keine|keinen|negativ|habe\s*ich\s*nicht|habe\s*keine|non|aucun|aucune|rien|pas\s*de|rien\s*de\s*tout\s*ca|la|laa|walou|walo|makan|nahi|na|नहीं|kuch\s*nahi|कुछ\s*नहीं|ledu|లేదు|kaadu|కాదు|em\s*ledu|ఏం\s*లేదు)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) {
      value = 'no';
    } else if (/(?:^|[^\p{L}\p{N}])(yes|yeah|yep|correct|i\s*do|one\s*or\s*more|have|positive|i\s*have|ja|richtig|habe\s*ich|eines\s*oder\s*mehrere|oui|ouais|j\s*ai|wakha|naam|iyah|haan|ha|हाँ|हां|avunu|అవును|undhi|ఉంది)(?=[^\p{L}\p{N}]|$)/u.test(spoken)) {
      value = 'yes';
    }
  }

  if (!value) {
    const exact = (screen.options || []).find(option => {
      const label = normalizeSpeech(option.label);
      const optionValue = normalizeSpeech(option.value);
      return spoken === label || spoken === optionValue || (label.length > 3 && spoken.includes(label));
    });
    value = exact?.value || null;
  }

  const matched = optionByValue(screen, value);
  return matched ? { value: matched.value, label: matched.label } : null;
}

