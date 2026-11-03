export function normalizeSpeech(value) {
  return String(value ?? '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
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
    if (/\b(headache|head pain|pain|fever|temperature|kopfschmerzen|kopfschmerz|schmerzen|schmerz|fieber)\b/.test(spoken)) value = 'pain_fever';
    else if (/\b(cold|cough|sore throat|runny nose|erkaltung|husten|halsschmerzen|schnupfen)\b/.test(spoken)) value = 'cold_cough';
    else if (/\b(allergy|allergies|hay fever|sneezing|allergie|allergien|heuschnupfen|niesen)\b/.test(spoken)) value = 'allergy';
    else if (/\b(diarrhea|diarrhoea|loose stool|loose stools|durchfall|dunnfluss)\b/.test(spoken)) value = 'diarrhoea';
    else if (/\b(heartburn|acid reflux|stomach discomfort|indigestion|sodbrennen|magenbeschwerden|verdauungsstorungen|magendruck)\b/.test(spoken)) value = 'heartburn';
    else if (/\b(skin|wound|cut|scrape|rash|haut|wunde|schnitt|schurfwunde|ausschlag)\b/.test(spoken)) value = 'skin_minor_wound';
    else if (/\b(other|something else|none of these|andere|anderes|etwas anderes|keines davon|sonstiges)\b/.test(spoken)) value = 'other';
  } else if (q === 'duration') {
    if (/\b(today|this morning|few hours|hours|heute|heute morgen|ein paar stunden|stunden)\b/.test(spoken)) value = 'today';
    else if (/\b(one|two|couple|1|2)\s*(day|days|tag|tage)?\b/.test(spoken) || /\b(ein|eine|einen|zwei)\s+(tag|tage)\b/.test(spoken)) value = '1_to_2_days';
    else if (/\b(more than|over|longer than|mehr als|langer als|uber)\s*(a|one|1|eine|einer)?\s*(week|woche|wochen)\b/.test(spoken) || /\b(weeks|wochen)\b/.test(spoken)) value = 'more_than_7_days';
    else if (/\b(three|four|five|six|seven|3|4|5|6|7|drei|vier|funf|sechs|sieben)\s*(day|days|tag|tage)?\b/.test(spoken) || /\b(week|woche)\b/.test(spoken)) value = '3_to_7_days';
  } else if (q === 'severity') {
    if (/\b(severe|very bad|extreme|schwer|sehr stark|extrem|stark)\b/.test(spoken)) value = 'severe';
    else if (/\b(moderate|medium|mittel|massig|moderat)\b/.test(spoken)) value = 'moderate';
    else if (/\b(mild|slight|small|leicht|gering|etwas)\b/.test(spoken)) value = 'mild';
  } else if (q === 'pregnancy_breastfeeding') {
    if (/\b(keine angabe|mochte nicht sagen|moechte nicht sagen|will nicht sagen|prefer not|rather not)\b/.test(spoken)) value = 'prefer_not_to_say';
    else if (/\b(both|beides|beide)\b/.test(spoken)) value = 'both';
    else if (/\b(not pregnant|not breastfeeding|not breast feeding|no|none|nicht schwanger|nicht stillend|nicht stillen|nein|keine)\b/.test(spoken)) value = 'no';
    else if (/\b(breastfeeding|breast feeding|nursing|stillend|stillen|stille)\b/.test(spoken)) value = 'breastfeeding';
    else if (/\b(pregnant|pregnancy|schwanger|schwangerschaft)\b/.test(spoken)) value = 'pregnant';
    else if (/\b(not applicable|does not apply|nicht zutreffend|trifft nicht zu)\b/.test(spoken)) value = 'not_applicable';
  } else if (q === 'confirm') {
    if (/\b(no|restart|start again|change|incorrect|nein|neu starten|neu beginnen|andern|falsch|nicht richtig)\b/.test(spoken)) value = 'no';
    else if (/\b(yes|confirm|correct|continue|okay|ok|ja|bestatigen|richtig|weiter)\b/.test(spoken)) value = 'yes';
  } else if (['warning_signs', 'allergy_status', 'medication_status', 'condition_status'].includes(q)) {
    if (/\b(not sure|unsure|do not know|dont know|don t know|maybe|nicht sicher|unsicher|weiss nicht|weiss es nicht|keine ahnung|vielleicht)\b/.test(spoken)) value = 'not_sure';
    else if (/\b(no|none|negative|do not have|dont have|don t have|nein|keine|keinen|negativ|habe ich nicht|habe keine)\b/.test(spoken)) value = 'no';
    else if (/\b(yes|yeah|correct|i do|one or more|ja|richtig|habe ich|eines oder mehrere)\b/.test(spoken)) value = 'yes';
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

