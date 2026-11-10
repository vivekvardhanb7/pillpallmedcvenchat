/**
 * Import the Morocco medicine screening reference as non-operational research
 * records. The source expressly forbids autonomous recommendation or vending,
 * so every imported row remains disabled and in review.
 *
 * Usage:
 *   node scripts/import-morocco-reference.mjs --file V:\\reference.json
 *   node scripts/import-morocco-reference.mjs --file V:\\reference.json --apply
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import './load-env.mjs';

const DEFAULT_REFERENCE = 'V:\\morocco_medicine_patient_screening_reference_RECHECKED.json';
const args = process.argv.slice(2);
const fileFlag = args.indexOf('--file');
const referencePath = resolve(fileFlag >= 0 ? args[fileFlag + 1] || '' : DEFAULT_REFERENCE);
const apply = args.includes('--apply');
const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

if (!baseUrl || !serviceKey || serviceKey.startsWith('YOUR_')) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in .env.');
}

const reference = JSON.parse(await readFile(referencePath, 'utf8'));
const products = Array.isArray(reference.products) ? reference.products : [];
const referenceIds = new Set(products.map(product => product.id));
const expectedIds = new Set(Array.from({ length: 30 }, (_, index) => `P${String(index + 1).padStart(3, '0')}`));

if (reference.document_title !== 'Morocco Medical Vending Machine - Medicine Use, Ingredient and Patient Screening Reference') {
  throw new Error('The file is not the expected Morocco medicine screening reference.');
}
if (products.length !== expectedIds.size || [...expectedIds].some(id => !referenceIds.has(id))) {
  throw new Error('The reference must contain one unique record for each id from P001 through P030.');
}
if (products.some(product => !String(product.vending_decision || '').includes('NOT APPROVED FOR AUTONOMOUS RECOMMENDATION OR DISPENSING'))) {
  throw new Error('Refusing import: every reference record must explicitly remain non-operational.');
}

function marketStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('retir')) return 'retired';
  if (normalized.includes('non commercial')) return 'noncommercialised';
  if (normalized.includes('commercialis')) return 'commercialised';
  return 'unknown';
}

function sourceUrl(product) {
  const links = product.official_or_authoritative_reference_links || {};
  return links.morocco_exact_product_search_result
    || links.morocco_authorisation_database
    || reference.official_and_authoritative_sources?.morocco_amm_database
    || null;
}

function sku(product) {
  return `MA-REFERENCE-${product.id}`;
}

function productPayload(product) {
  return {
    country_code: 'MA',
    sku: sku(product),
    product_name: product.exact_moroccan_product,
    active_ingredients: [{ name: product.ingredient_or_product_family }],
    market_status: marketStatus(product.ammps_status),
    sale_classification: product.ammps_status,
    source_document: `${reference.document_title}, version ${reference.version}`,
    source_page: Array.isArray(product.source_pages) ? product.source_pages.join(', ') : null,
    source_checked_at: reference.created_date || null,
    research_notes: JSON.stringify({
      reference_id: product.id,
      source_report: reference.based_on?.source_report || null,
      source_evidence_cutoff: reference.based_on?.source_evidence_cutoff || null,
      product,
    }),
    clinical_status: 'in_review',
    legal_status: 'in_review',
    chatbot_enabled: false,
  };
}

function safetyPayload(product, productId) {
  return {
    product_id: productId,
    // The reference describes general use only. An empty list ensures that no
    // draft wording can act as an approved indication in a future matcher.
    allowed_indications: [],
    minimum_age_months: null,
    maximum_age_years: null,
    pregnancy_rule: 'refer',
    breastfeeding_rule: 'refer',
    contraindications: [],
    allergy_terms: [],
    interaction_rules: [],
    dose_instructions: {
      status: 'not_assessed',
      message: 'No exact Moroccan leaflet/RCP or dose was validated by this reference.',
      patient_screening_questions: product.patient_screening_questions || [],
    },
    maximum_duration_days: null,
    warnings: [
      product.safety_limits,
      product.storage_evidence,
      product.who_should_not_take_or_requires_professional_review,
      product.source_and_limitations,
    ].filter(Boolean),
    referral_triggers: [product.stop_and_refer_rules, product.vending_decision].filter(Boolean),
    storage_requirements: { status: 'not_assessed', evidence: product.storage_evidence || null },
    clinical_source_url: sourceUrl(product),
    clinical_source_version: `${reference.document_title}, version ${reference.version}, record ${product.id}`,
    reviewer_name: null,
    reviewer_role: null,
    reviewed_at: null,
    review_status: 'in_review',
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed: HTTP ${response.status} ${(await response.text()).slice(0, 400)}`);
  return response.status === 204 ? null : response.json();
}

console.log(`Validated ${products.length} records from ${referencePath}.`);
console.log(`Import mode: ${apply ? 'APPLY — disabled research records only' : 'DRY RUN — no database changes'}.`);
console.log('Clinical gate: verify the exact Moroccan pack and current RCP/leaflet with a pharmacist or qualified clinical reviewer before any record is approved or enabled.');
const statusTotals = products.reduce((totals, product) => {
  const status = marketStatus(product.ammps_status);
  totals[status] = (totals[status] || 0) + 1;
  return totals;
}, {});
console.log(`Status totals: ${JSON.stringify(statusTotals)}.`);

if (!apply) process.exit(0);

const productRows = await request('products?on_conflict=country_code,sku', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(products.map(productPayload)),
});
if (productRows.length !== products.length) throw new Error(`Expected ${products.length} imported product rows, received ${productRows.length}.`);

const bySku = new Map(productRows.map(row => [row.sku, row]));
const safetyRows = products.map(product => {
  const row = bySku.get(sku(product));
  if (!row?.id) throw new Error(`Supabase did not return an id for ${sku(product)}.`);
  return safetyPayload(product, row.id);
});
const savedSafety = await request('product_safety?on_conflict=product_id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(safetyRows),
});
if (savedSafety.length !== products.length) throw new Error(`Expected ${products.length} imported safety rows, received ${savedSafety.length}.`);

const verification = await request('products?country_code=eq.MA&sku=like.MA-REFERENCE-*&select=sku,market_status,clinical_status,legal_status,chatbot_enabled&order=sku');
if (verification.length !== products.length) throw new Error(`Verification found ${verification.length}, not ${products.length}, imported reference products.`);
if (verification.some(row => row.chatbot_enabled || row.clinical_status === 'approved' || row.legal_status === 'approved')) {
  throw new Error('Safety check failed: an imported research product is enabled or approved.');
}
console.log(`Imported and verified ${verification.length} disabled, in-review MA reference products and safety records.`);
