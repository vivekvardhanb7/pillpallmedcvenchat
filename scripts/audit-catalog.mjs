import { join } from 'node:path';
import { LANGUAGES } from '../web/i18n.js';

try {
  process.loadEnvFile(join(process.cwd(), '.env'));
} catch (_) {
  console.error('Missing .env — copy .env.example to .env and fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const strict = process.argv.includes('--strict');
const baseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey || serviceKey.startsWith('YOUR_')) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before running the audit.');
  process.exit(2);
}

async function fetchAll(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?select=${select}&limit=1000&offset=${offset}`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) throw new Error(`Fetching ${table} failed: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

const PRODUCT_COLUMNS = 'id,country_code,sku,product_name,market_status,label_url,clinical_status,legal_status,chatbot_enabled';
let products;
try {
  products = await fetchAll('products', `${PRODUCT_COLUMNS},data_origin,is_fixture`);
} catch (_) {
  // Migration 010 has not been applied yet; provenance is inferred from the row.
  products = await fetchAll('products', PRODUCT_COLUMNS);
}
const safetyRows = await fetchAll(
  'product_safety',
  'product_id,review_status,minimum_age_months,maximum_age_years,dose_instructions,maximum_duration_days,reviewer_name,reviewer_role,clinical_source_url,clinical_source_version,allergy_terms,contraindications,interaction_rules',
);
const pathwayRows = await fetchAll('product_pathways', 'product_id,approval_status');
const countries = await fetchAll('countries', 'code');

const safetyByProduct = new Map(safetyRows.map(row => [row.product_id, row]));
const pathwaysByProduct = new Map();
for (const row of pathwayRows) {
  const list = pathwaysByProduct.get(row.product_id) || [];
  list.push(row);
  pathwaysByProduct.set(row.product_id, list);
}
const countryCodes = new Set(countries.map(row => row.code));

const PLACEHOLDER_TERM = /(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)/i;
const PLACEHOLDER_REVIEWER = /(synthetic|demo|test|placeholder)/i;

function doseText(instructions) {
  if (!instructions) return '';
  if (typeof instructions === 'string') return instructions;
  return Object.values(instructions).join(' ');
}

function placeholderTerms(safety) {
  if (!safety) return [];
  const found = [];
  for (const field of ['allergy_terms', 'contraindications', 'interaction_rules']) {
    for (const term of Array.isArray(safety[field]) ? safety[field] : []) {
      if (PLACEHOLDER_TERM.test(String(term))) found.push(`${field}: "${term}"`);
    }
  }
  return found;
}

function leafletIssue(labelUrl) {
  if (!labelUrl) return 'no label_url — the leaflet link is hidden in the kiosk UI';
  let host;
  try {
    host = new URL(labelUrl).host;
  } catch (_) {
    return `invalid label_url "${labelUrl}"`;
  }
  if (/example\.invalid$/i.test(host)) return `unreachable leaflet host ${host}`;
  if (/\.supabase\.(co|in)$/i.test(host)) return null;
  return `external leaflet host ${host} can become unavailable (like the AMMPS timeout) — prefer Supabase Storage`;
}

function fixtureLike(product) {
  return product.is_fixture === true
    || /(^|[-_])(fixture|test)([-_]|$)/i.test(product.sku)
    || /test fixture/i.test(product.product_name);
}

function demoLike(product, safety) {
  if (product.data_origin === 'synthetic') return true;
  if (product.country_code === 'ZZ' && /^ZZ-DEMO-/i.test(product.sku)) return true;
  return Boolean(safety && safety.reviewer_name && PLACEHOLDER_REVIEWER.test(safety.reviewer_name));
}

const blockers = [];
const warnings = [];
let enabledCount = 0;
let disabledCount = 0;
let demoCount = 0;

for (const product of products) {
  const name = `${product.country_code}/${product.sku} ${product.product_name}`;
  const safety = safetyByProduct.get(product.id);
  const pathways = pathwaysByProduct.get(product.id) || [];

  if (!product.chatbot_enabled) {
    disabledCount += 1;
    continue;
  }
  enabledCount += 1;

  const demo = demoLike(product, safety);
  const demoSandbox = demo && product.country_code === 'ZZ';
  if (demo) demoCount += 1;

  if (fixtureLike(product)) blockers.push(`${name}: fixture or test row is enabled — automated fixtures must never be customer-reachable`);
  if (product.clinical_status !== 'approved') blockers.push(`${name}: clinical_status is "${product.clinical_status}", not approved`);
  if (product.legal_status !== 'approved') blockers.push(`${name}: legal_status is "${product.legal_status}", not approved`);
  if (product.market_status !== 'commercialised') blockers.push(`${name}: market_status is "${product.market_status}", not commercialised`);

  if (!safety) {
    blockers.push(`${name}: no product_safety row`);
  } else {
    if (safety.review_status !== 'approved') blockers.push(`${name}: safety review_status is "${safety.review_status}", not approved`);
    if (!doseText(safety.dose_instructions).trim()) blockers.push(`${name}: missing approved dose instructions`);
    if (safety.maximum_duration_days == null) blockers.push(`${name}: maximum_duration_days is missing — the matcher cannot enforce a self-treatment window`);
    if (!safety.clinical_source_url) blockers.push(`${name}: clinical_source_url is missing — approval has no provenance`);
    if (!safety.clinical_source_version) blockers.push(`${name}: clinical_source_version is missing — approval cannot be reproduced`);
    if (!safety.reviewer_name) {
      (demoSandbox ? warnings : blockers).push(`${name}: no named reviewer — this is demo data, not a clinical approval`);
    } else if (PLACEHOLDER_REVIEWER.test(safety.reviewer_name)) {
      (demoSandbox ? warnings : blockers).push(`${name}: reviewer "${safety.reviewer_name}" is not a named human approval`);
    }
    if (!safety.reviewer_role) warnings.push(`${name}: reviewer_role missing`);
    if (safety.minimum_age_months == null) warnings.push(`${name}: minimum_age_months missing — age gating falls back to the global under-18 rule only`);
    if (safety.maximum_age_years == null) warnings.push(`${name}: maximum_age_years missing`);

    const placeholders = placeholderTerms(safety);
    if (placeholders.length) blockers.push(`${name}: placeholder matching terms (${placeholders.join('; ')}) — a customer could see or match nonsense`);
    if (safety.clinical_source_url && /example\.invalid/i.test(safety.clinical_source_url)) {
      (demoSandbox ? warnings : blockers).push(`${name}: clinical_source_url points at example.invalid — approval evidence is unreachable`);
    }
  }

  if (!pathways.some(row => row.approval_status === 'approved')) blockers.push(`${name}: no approved pathway mapping — the product can never match a symptom`);

  const leaflet = leafletIssue(product.label_url);
  if (leaflet) {
    if (/unreachable leaflet|invalid label_url/i.test(leaflet)) (demoSandbox ? warnings : blockers).push(`${name}: ${leaflet}`);
    else warnings.push(`${name}: ${leaflet}`);
  }
  if (!countryCodes.has(product.country_code)) warnings.push(`${name}: unknown country code "${product.country_code}"`);
}

// The matcher compares language_code against the language the touchscreen is
// in, so a pathway can look populated in Supabase and still be invisible in
// the kiosk. This checks coverage the way the workflow actually sees it.
const kioskLanguages = LANGUAGES.map(language => language.code.split('-')[0]);
const visibleRows = await fetchAll(
  'recommendable_product_pathways',
  'id,product_name,country_code,pathway_code,language_code',
);
const coverageByPathway = new Map();
for (const row of visibleRows) {
  if (!row.pathway_code) continue;
  const key = `${row.country_code}/${row.pathway_code}`;
  const languages = coverageByPathway.get(key) || new Set();
  languages.add(String(row.language_code || 'any'));
  coverageByPathway.set(key, languages);
}

console.log(`Products: ${products.length} total, ${enabledCount} chatbot-enabled, ${disabledCount} disabled.`);
if (enabledCount && demoCount === enabledCount) {
  console.log(`Catalogue status: DEMO SANDBOX ONLY (${demoCount}/${enabledCount} enabled rows are synthetic). Not releasable for a real market.`);
} else if (demoCount) {
  console.log(`Catalogue status: MIXED (${demoCount}/${enabledCount} enabled rows are synthetic). Demo provenance must stay inside ZZ.`);
}

console.log(`\nLANGUAGE COVERAGE (kiosk languages: ${kioskLanguages.join(', ')}):`);
if (!coverageByPathway.size) {
  console.log('  none — no pathway returns a product to the matcher, so every completed assessment ends in NO_SUITABLE_PRODUCT.');
}
for (const [key, languages] of [...coverageByPathway.entries()].sort()) {
  const served = [...languages].filter(code => code === 'any' || kioskLanguages.includes(code));
  const missing = [...languages].filter(code => code !== 'any' && !kioskLanguages.includes(code));
  console.log(`  ${key}: ${[...languages].sort().join(', ')}${served.length ? '' : '  <-- visible in no kiosk language'}`);
  if (!served.length) {
    warnings.push(`${key}: ${[...languages].sort().join(', ')} only — the touchscreen cannot show these products in ${kioskLanguages.join('/')}`);
  } else if (missing.length) {
    warnings.push(`${key}: visible only in ${[...languages].sort().join(', ')}; ${missing.join(', ')} customers get no product`);
  }
}

if (strict && demoCount) {
  blockers.push(`catalogue contains ${demoCount} synthetic row(s); --strict treats demo data as a release blocker`);
}

if (blockers.length) {
  console.log(`\nBLOCKERS (${blockers.length}) — enabled products that must not be live:`);
  for (const line of blockers) console.log(`  - ${line}`);
} else {
  console.log('\nNo structural blockers: every chatbot-enabled product is approved, mapped and has complete safety data.');
  if (demoCount) console.log('This is still demo data: provenance and reviewer fields say so. Run with --strict before a release.');
}

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  for (const line of warnings) console.log(`  - ${line}`);
} else {
  console.log('No warnings.');
}

process.exit(blockers.length ? 1 : 0);
