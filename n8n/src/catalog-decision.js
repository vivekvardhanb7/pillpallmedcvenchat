/**
 * PILLPAL MedAssist - deterministic product matcher.
 * n8n Code node: Run Once for All Items.
 */

const intake = $('Intake and Safety Engine').first().json;
const items = typeof $input.all === 'function' ? $input.all() : [$input.first()];
const firstJson = items[0]?.json || {};
const state = intake.state || {};

let rows = [];
let catalogError = null;

if (firstJson.error) {
  catalogError = typeof firstJson.error === 'object' ? (firstJson.error.message || JSON.stringify(firstJson.error)) : String(firstJson.error);
} else if (Array.isArray(firstJson.body)) {
  rows = firstJson.body;
  if (Number(firstJson.statusCode || 200) >= 400) {
    catalogError = `Supabase REST status ${firstJson.statusCode}`;
  }
} else if (Array.isArray(firstJson)) {
  rows = firstJson;
} else {
  rows = items.map(item => item?.json).filter(r => r && (r.id || r.product_name || r.sku));
}

function cleanText(value, maxLength = 240) {
  return String(value ?? '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalize(value) {
  return cleanText(value, 300).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function termsFromRules(value) {
  if (!Array.isArray(value)) return [];
  const output = [];
  for (const item of value) {
    if (typeof item === 'string') output.push(item);
    else if (item && typeof item === 'object') {
      for (const key of ['term', 'name', 'label']) if (typeof item[key] === 'string') output.push(item[key]);
      for (const key of ['terms', 'keywords', 'aliases']) {
        if (Array.isArray(item[key])) output.push(...item[key].filter(v => typeof v === 'string'));
      }
    }
  }
  return [...new Set(output.map(normalize).filter(Boolean))];
}

function conflicts(patientTerms, ruleTerms) {
  const patient = (Array.isArray(patientTerms) ? patientTerms : []).map(normalize).filter(Boolean);
  const rules = termsFromRules(ruleTerms);
  return patient.some(p => rules.some(r => p.includes(r) || r.includes(p)));
}

function timing() {
  const started = Number(state.started_at_ms);
  const now = Date.now();
  return { elapsed_ms: Number.isFinite(started) && started > 0 && started <= now ? now - started : 0 };
}

function noProduct(message, reasonCodes, detail = null) {
  return [{
    json: {
      ...intake,
      ...timing(),
      needs_catalog: false,
      outcome: 'NO_SUITABLE_PRODUCT',
      message,
      reason_codes: reasonCodes,
      dispense_authorized: false,
      product: null,
      screen: {
        question_id: 'complete',
        type: 'result',
        title: 'No suitable approved product',
        options: [{ value: 'restart', label: 'Start a new assessment' }],
      },
      system_detail: detail,
    },
  }];
}

if (catalogError) {
  return noProduct(
    'The approved product catalogue is temporarily unavailable. No medicine can be recommended. Please visit a nearby clinic, doctor or pharmacy for advice.',
    ['catalog_unavailable'],
    catalogError,
  );
}

const stateLanguage = String(state.language_code || '').split('-')[0];
const filteredRows = rows.filter(r =>
  (!r.pathway_code || r.pathway_code === state.pathway_code) &&
  (!r.country_code || r.country_code === state.country_code) &&
  (!r.language_code || !stateLanguage || r.language_code === stateLanguage)
);

if (!filteredRows.length) {
  return noProduct(
    'No clinically and legally approved product is currently enabled for this symptom pathway. Please visit a nearby clinic, doctor or pharmacy for advice.',
    ['no_approved_product_for_pathway'],
  );
}

const evaluated = filteredRows
  .sort((a, b) => Number(a.display_priority || 100) - Number(b.display_priority || 100))
  .map(product => {
    const reasons = [];
    const ageMonths = Number(state.age_years) * 12;
    if (product.minimum_age_months != null && ageMonths < Number(product.minimum_age_months)) reasons.push('below_minimum_age');
    if (product.maximum_age_years != null && Number(state.age_years) > Number(product.maximum_age_years)) reasons.push('above_maximum_age');
    if (conflicts(state.allergy_terms, product.allergy_terms)) reasons.push('allergy_conflict');
    if (conflicts(state.condition_terms, product.contraindications)) reasons.push('contraindication_conflict');
    if (conflicts(state.medication_terms, product.interaction_rules)) reasons.push('medicine_interaction_conflict');
    if (!product.dose_instructions || typeof product.dose_instructions !== 'object' || !Object.keys(product.dose_instructions).length) reasons.push('missing_approved_dose');
    return { product, reasons };
  });

const selected = evaluated.find(result => result.reasons.length === 0);
if (!selected) {
  const ageReasons = new Set(['below_minimum_age', 'above_maximum_age']);
  const blockedByAgeOnly = evaluated.every(r => r.reasons.length > 0 && r.reasons.every(x => ageReasons.has(x)));
  return noProduct(
    blockedByAgeOnly
      ? 'The approved products for this symptom are suitable for a different age range than the age you entered. Please visit a nearby clinic, doctor or pharmacy for advice.'
      : 'The available approved products did not pass all safety checks. Please visit a nearby clinic, doctor or pharmacy for advice.',
    blockedByAgeOnly ? ['age_outside_supported_range', 'all_products_blocked'] : ['all_products_blocked'],
    evaluated.map(v => ({ product_id: v.product.id, reasons: v.reasons })),
  );
}

const product = selected.product;
return [{
  json: {
    ...intake,
    needs_catalog: false,
    outcome: 'PRODUCT_ELIGIBLE',
    message: 'An approved product matched the completed safety assessment. Review the product information before continuing.',
    reason_codes: ['approved_product_match'],
    dispense_authorized: false,
    product: {
      id: product.id,
      sku: product.sku,
      name: product.product_name,
      brand_name: product.brand_name,
      active_ingredients: product.active_ingredients,
      strength: product.strength_label,
      dosage_form: product.dosage_form,
      route: product.route,
      pack_size: product.pack_size,
      instructions: product.dose_instructions,
      warnings: product.warnings,
      maximum_duration_days: product.maximum_duration_days,
      label_url: product.label_url,
      label_version: product.label_version,
      product_version: product.product_version,
      safety_version: product.safety_version,
    },
    screen: {
      question_id: 'complete',
      type: 'product_result',
      title: product.product_name,
      options: [{ value: 'restart', label: 'Start a new assessment' }],
    },
    evaluated_products: evaluated.map(v => ({
      product_id: v.product.id,
      result: v.product.id === product.id ? 'eligible' : 'not_selected',
      reasons: v.reasons,
    })),
  },
}];

