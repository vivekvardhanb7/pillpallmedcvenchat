// Decides whether a transcript is a question or a help request about the
// current screen, rather than an answer to it.
//
// This guard is deliberately strict. An answer such as "It was started today"
// contains a question-shaped word ("was"), and "no, none of these" contains
// "no"; neither may be mistaken for a question. Only a trailing question mark,
// a question word at the start of the sentence, or an explicit request for
// help counts. Everything else is treated as an answer and goes through the
// normal mapper / AI understanding path.

import { spokenNumber } from './voice-input-mapper.js';

const QUESTION_START = new RegExp(
  '^(?:' + [
    // English
    'what', 'whats', 'why', 'when', 'where', 'which', 'who', 'whom', 'whose',
    'how', 'hows', 'can', 'could', 'would', 'should', 'shall', 'do', 'does',
    'did', 'is', 'are', 'am', 'was', 'were', 'will', 'may', 'might', 'must',
    'have', 'has', 'had',
    // German (umlauts are folded by normalizeIntentText)
    'bitte', 'warum', 'wieso', 'weshalb', 'wie', 'wann', 'wo', 'wer', 'welche',
    'welcher', 'welches', 'ist', 'sind', 'kann', 'konnen', 'soll', 'sollen',
    'darf', 'durfen', 'muss', 'mussen', 'habe', 'haben', 'hat',
    // French (accented letters are folded by normalizeIntentText)
    'quel', 'quelle', 'quels', 'quelles', 'combien', 'pourquoi', 'comment',
    'quand', 'est', 'sont', 'puis', 'peut', 'dois', 'doit', 'avez',
    'quest', 'qu est',
  ].join('|') + ')\\b',
);

const HELP_PHRASE = /\b(?:explain|repeat(?:\s+(?:that|it|the question|please|once more))?|say\s+(?:that|it)\s+again|what\s+do\s+you\s+mean|what\s+does\s+.{1,60}?\s+mean|i\s+(?:do\s+not|don\s*t|dont)\s+understand|not\s+sure\s+what\s+you\s+mean|help\s+me|erklar|wiederhol|was\s+bedeutet|was\s+heisst|ich\s+verstehe\s+nicht|hilfe|je\s+ne\s+comprends\s+pas|qu\s*est\s+ce\s+que\s+ca\s+veut\s+dire|repete|repeter)\b/;

export function normalizeIntentText(value) {
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

export function isQuestionByWording(value) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  return QUESTION_START.test(normalized) || HELP_PHRASE.test(normalized);
}

export function looksLikeQuestion(value) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  return /\?$/.test(raw) || isQuestionByWording(raw);
}

const EMERGENCY_PATTERNS = [
  /\b(?:chest\s+pain|pain\s+in\s+(?:the\s+)?chest|tightness\s+in\s+(?:the\s+)?chest|radiat(?:ing|es?)\s+to\s+(?:the\s+)?(?:left\s+)?(?:arm|jaw|neck))\b/,
  /\b(?:cough(?:ing)?\s+(?:up\s+)?blood|vomit(?:ing)?\s+blood|blood\s+in\s+(?:my\s+)?(?:vomit|stool|urine|spit))\b/,
  /\b(?:cannot\s+breathe|hard\s+to\s+breathe|severe\s+(?:shortness\s+of\s+breath|breathlessness)|choking|gasping\s+for\s+air)\b/,
  /\b(?:sudden(?:ly)?\s+(?:cannot\s+see|blind|lost\s+speech|cannot\s+speak|paraly[sz]ed|droop(?:ing)?\s+face|weakness\s+on\s+one\s+side))\b/,
  /\b(?:stiff\s+neck\s+(?:and|with)\s+(?:high\s+)?fever|thunderclap\s+headache|worst\s+headache\s+of\s+my\s+life)\b/,
  /\b(?:throat\s+(?:is\s+)?closing(?:\s+up)?|swelling\s+in\s+(?:the\s+)?throat|(?:swollen|swelling)\s+(?:of\s+)?(?:the\s+)?(?:throat|lips|tongue|face)|(?:throat|lips|tongue|face)\s+(?:is|are)?\s*(?:swollen|swelling)|anaphylax(?:is|tic))\b/,
  /\b(?:fainted|fainting|passed\s+out|blacked\s+out|lost\s+consciousness|unconscious|bewusstlos|ohnmacht|syncope)\b/,
  // German emergency phrases
  /\b(?:brustschmerz(?:en)?|enge\s+in\s+der\s+brust|blut\s+husten|blut\s+im\s+stuhl|blut\s+im\s+urin|schwere\s+atemnot|keine\s+luft)\b/,
  /\b(?:plotzlich(?:er)?\s+(?:sehverlust|lahmung|sprachverlust)|herzinfarkt|schlaganfall)\b/,
  // French emergency phrases (critical for Morocco kiosk deployments)
  /\b(?:douleur\s+thoracique|crise\s+cardiaque|difficulte\s+a\s+respirer|etouffement|avc|perte\s+de\s+connaissance|crachat\s+de\s+sang|saignement\s+grave|gonflement\s+de\s+la\s+gorge|choc\s+anaphylactique)\b/,
];

export function isEmergencyWording(value) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  return EMERGENCY_PATTERNS.some(pattern => pattern.test(normalized));
}

const MEDICINE_REQUEST_PATTERNS = [
  /\b(?:what\s+(?:medicine|pill|pills|tablet|tablets|medication|drug|drugs|product|products|can\s+i\s+take|should\s+i\s+take|do\s+you\s+have|is\s+there))\b/,
  /\b(?:which\s+(?:medicine|tablet|tablets|pill|pills|is\s+better|is\s+good|is\s+best))\b/,
  /\b(?:do\s+you\s+have\s+(?:anything|something|medicine|tablets?|pills?|syrup))\b/,
  /\b(?:i\s+need\s+(?:a\s+)?(?:medicine|pill|pills|tablet|tablets|syrup|spray|something\s+for))\b/,
  // German medicine inquiry phrases
  /\b(?:welche\s+(?:tablette|tabletten|medikament|medikamente|ist\s+besser|hilft|helfen))\b/,
  /\b(?:was\s+(?:kann\s+ich\s+nehmen|haben\s+sie|gibt\s+es|hilft\s+gegen))\b/,
  /\b(?:haben\s+sie\s+(?:etwas|medikamente|tabletten|paracetamol|ibuprofen|aspirin))\b/,
  /\b(?:ich\s+brauche\s+(?:ein\s+)?(?:medikament|tablette|etwas\s+gegen))\b/,
];

export function isMedicineRequest(value) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  return MEDICINE_REQUEST_PATTERNS.some(pattern => pattern.test(normalized));
}

export function socialIntent(value) {
  const normalized = normalizeIntentText(value);
  if (/^(?:hi|hello|hey|hi there|hello there|good morning|good afternoon|good evening)$/.test(normalized)) return 'greeting';
  if (/^(?:thanks|thank you|thank you very much|okay thanks|ok thanks)$/.test(normalized)) return 'thanks';
  if (/^(?:can you help me|please help me|help me|how are you)$/.test(normalized)) return 'help';
  return null;
}

export function extractVolunteeredContext(value) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return {};
  const context = {};

  // Duration
  if (/\b(?:more\s+than\s+(?:a\s+)?week|(?:[89]|\d{2,})\s+days|weeks|wochen|month|monat|plus\s+d\s*une\s+semaine)\b/.test(normalized)) {
    context.duration = 'more_than_7_days';
  } else if (/\b(?:yesterday|gestern|hier|(?:1|2|one|two)\s+days?|since\s+yesterday)\b/.test(normalized)) {
    context.duration = '1_to_2_days';
  } else if (/\b(?:today|heute|aujourdhui|this\s+morning|diesen\s+morgen|ce\s+matin|last\s+night|from\s+last\s+night|since\s+last\s+night)\b/.test(normalized)) {
    context.duration = 'today';
  } else if (/\b(?:(?:[3-7]|three|four|five|six|seven)\s+days|few\s+days|a?\s*week|einige\s+tage|woche|quelques\s+jours)\b/.test(normalized)) {
    context.duration = '3_to_7_days';
  } else if (/\b(?:more\s+than\s+(?:a\s+)?week|(?:[89]|\d{2,})\s+days|weeks|wochen|month|monat|plus\s+d\s*une\s+semaine)\b/.test(normalized)) {
    context.duration = 'more_than_7_days';
  }

  // Age
  const ageMatch = normalized.match(/\b(?:(?:my\s+)?age(?:\s+is)?|i\s+am|i\s*m|ich\s+bin|jai|age\s+de|vayasu|umra)\s+(\d{1,3})\b/) ||
                   normalized.match(/\b(\d{1,3})\s+(?:years?\s+old|jahre?\s+alt|ans|varsh|ellu|samvatsaralu)\b/);
  if (ageMatch) {
    const ageNum = parseInt(ageMatch[1], 10);
    if (ageNum >= 0 && ageNum <= 120) {
      context.age = ageNum;
    }
  }
  if (context.age == null) {
    const ageWords = normalized.match(/\b(?:i am|i m|im|ich bin|my age is)\s+([\p{L}\s-]+?)(?=\s+(?:years|jahre|and|und)\b|[.,;!?]|$)/u);
    if (ageWords) {
      const age = spokenNumber(ageWords[1]);
      if (age != null) context.age = age;
    }
  }

  // Severity
  if (/\b(?:not too bad|not very bad|nicht so schlimm)\b/.test(normalized)) {
    context.severity = 'mild';
  } else if (/\b(?:not|nicht|kein|keine)\s+(?:mild|leicht|severe|schwer)\b/.test(normalized)) {
    // A negated severity is not evidence for another severity category.
  } else if (/\b(?:severe|schwer|grave|unbearable|unertraglich)\b/.test(normalized)) {
    context.severity = 'severe';
  } else if (/\b(?:mild|leicht|leichte|leger)\b/.test(normalized)) {
    context.severity = 'mild';
  } else if (/\b(?:moderate|mittel|modere)\b/.test(normalized)) {
    context.severity = 'moderate';
  } else if (/\b(?:severe|schwer|grave)\b/.test(normalized)) {
    context.severity = 'severe';
  }

  return context;
}

// Capture only explicit negative safety statements volunteered out of order.
// These facts can be offered back for confirmation on their own later screen;
// they must never be used as the answer to an unrelated current question.
export function extractVolunteeredSafetyContext(value) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return {};
  const context = {};

  const negativeAllergy = /\b(?:no|none|without|(?:dont|don\s+t|do\s+not|odont)\s+have|never\s+had|keine?|aucune?|pas\s+d)\b[^.!?]{0,90}\b(?:medicine\s+|drug\s+)?(?:allerg(?:y|ies|ie|ien)|alerg(?:y|ies)|allearg(?:y|ies))\b/.test(normalized);
  const negativeCondition = /\b(?:no|none|without|(?:dont|don\s+t|do\s+not|odont)\s+have|keine?|aucune?|pas\s+de)\b[^.!?]{0,110}\b(?:medical\s+|health\s+|ongoing\s+)?(?:conditio(?:n|ns|s)|health\s+issues?|illness|illnesses|disease|diseases|erkrankung|erkrankungen|maladie|maladies)\b/.test(normalized);
  const negativeMedication = /\b(?:(?:not\s+taking|dont\s+take|don\s+t\s+take|do\s+not\s+take|not\s+on)\b[^.!?]{0,35}\b(?:medicine|medicines|medication|medications|drug|drugs|tablets)|no\s+(?:current\s+)?(?:medicines?|medications?|tablets?)|nehme\s+keine\s+medikamente|kein(?:e|en)?\s+medikamente|aucun(?:e)?\s+(?:medicament|traitement)|pas\s+de\s+(?:medicament|traitement))\b/.test(normalized);
  const pregnancyNotApplicable = /\b(?:not\s+pregnant|pregnancy\s+(?:does\s+not|doesnt)\s+apply|not\s+breastfeeding|neither\s+pregnant\s+nor\s+breastfeeding|nicht\s+schwanger|pas\s+enceinte)\b/.test(normalized);

  if (negativeAllergy) context.allergy_status = 'no';
  if (negativeCondition) context.condition_status = 'no';
  if (negativeMedication) context.medication_status = 'no';
  if (pregnancyNotApplicable) context.pregnancy_breastfeeding = 'not_applicable';
  return context;
}

export function detectDetailedSymptomContext(value) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return null;
  if (/(?:^|[^\p{L}\p{N}])(period\s+pain|period\s+cramps?|menstrual\s+(?:pain|cramps?)|on\s+(?:my|her|the)\s+period|having\s+(?:my|her|a)\s+period|regelschmerzen)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'period_pain';
  if (/(?:^|[^\p{L}\p{N}])(stomach\s+pain|abdominal\s+pain|tummy\s+pain|belly\s+pain|pelvic\s+pain|lower\s+(?:stomach|abdomen|tummy)\s+pain|pain\s+(?:is\s+)?(?:in|around)\s+(?:my\s+|the\s+)?(?:lower\s+)?(?:stomach|abdomen|tummy|belly|pelvis)|bauchschmerzen|bauchweh|magenschmerzen|douleur\s+abdominale)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'abdominal_pain';
  if (/(?:^|[^\p{L}\p{N}])(toothache|tooth\s*pain|teeth\s*pain|dental\s*pain|gum\s*pain|zahnschmerzen|zahnschmerz|zahnweh|douleur\s*dentaire)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'toothache';
  if (/(?:^|[^\p{L}\p{N}])(backache|back\s*pain|lower\s*back\s*pain|spine\s*pain|muscle\s*pain|muskelschmerzen|ruckenschmerzen|douleur\s*au\s*dos)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'back_pain';
  if (/(?:^|[^\p{L}\p{N}])(earache|ear\s*pain|sore\s*ear|ohrenschmerzen|ohrenschmerz|ohrenweh|mal\s*aux?\s*oreilles)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'earache';
  if (/(?:^|[^\p{L}\p{N}])(sinus|sinuses|sinus\s*pressure|sinus\s*headache|nasennebenhohlen|nasennebenhohlenentzundung)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'sinus';
  if (/(?:^|[^\p{L}\p{N}])(heartburn|acid\s*reflux|indigestion|acid\s*stomach|sodbrennen|reflux|acidite\s*gastrique)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'heartburn';
  if (/(?:^|[^\p{L}\p{N}])(headache|head\s+(?:ache|pain|hurts?)|migraine|kopfschmerzen|kopfschmerz|kopfweh|mal\s+a\s+la\s+tete|thala\s*noppi|తలనెప్పి|తల\s*నొప్పి|sar\s*dard|सरदर्द)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'headache';
  if (/(?:^|[^\p{L}\p{N}])(fever|favor|fevor|faver|fevr|feber|high\s+temperature|temperature|fieber|fievre|jwaram|జ్వరం|bukhar|बुखार)(?=[^\p{L}\p{N}]|$)/u.test(normalized)) return 'fever';
  return null;
}

