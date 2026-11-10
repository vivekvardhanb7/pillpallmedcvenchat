import { loadEngineSource } from '../n8n/load-engine-source.mjs';
/**
 * web/local-engine.mjs — Standalone Offline Clinical Triage & Medicine Engine
 * 
 * Local assessment and reference catalogue adapter. Clinical recommendations
 * require an authenticated, unexpired release and explicit product approvals.
 * Provides:
 * 1. 11-step clinical triage intake
 * 2. Deterministic catalogue matching
 * 3. Broader medicine search (Morocco, India, International)
 * 4. Fail-closed alternative referral
 * 5. Conservative ingredient-conflict screening (not complete eligibility)
 * 6. Local outcome queueing
 */

import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectSnapshot } from './catalog-snapshot.mjs';
import { medicineTermsConflict, productApprovalReasons } from './safety-policy.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const intakeSource = await readFile(resolve(projectRoot, 'n8n/src/intake-and-safety-engine.js'), 'utf8');
const catalogSource = await loadEngineSource(resolve(projectRoot, 'n8n/src/catalog-decision.js'));

const runIntakeCode = new Function('$input', intakeSource);
const runCatalogCode = new Function('$input', '$', catalogSource);
const runOutcomeCode = new Function('$input', await readFile(resolve(projectRoot, 'n8n/src/outcome-log-payload.js'), 'utf8'));

let catalogSnapshot = null;
let snapshotTrust = { trusted: false, expires_at: null, reason: "not_loaded" };

async function loadSnapshot() {
  if (catalogSnapshot) return catalogSnapshot;
  const snapshotPath = resolve(projectRoot, process.env.PILLPAL_CATALOG_FILE || 'data/local_catalog_snapshot.json');
  if (existsSync(snapshotPath)) {
    try {
      const data = await readFile(snapshotPath, 'utf8');
      const publicKey = process.env.PILLPAL_CATALOG_PUBLIC_KEY_FILE
        ? await readFile(resolve(projectRoot, process.env.PILLPAL_CATALOG_PUBLIC_KEY_FILE), 'utf8') : null;
      snapshotTrust = inspectSnapshot(JSON.parse(data), publicKey);
      catalogSnapshot = snapshotTrust.snapshot;
    } catch (e) {
      snapshotTrust = { trusted: false, expires_at: null, reason: 'invalid_catalogue' };
      console.error('Failed to load local catalogue snapshot:', e);
    }
  }
  return catalogSnapshot;
}

export async function processChatTurn(body) {
  const inputForIntake = { first: () => ({ json: { body } }) };
  const intakeResult = runIntakeCode(inputForIntake)[0]?.json || {};

  if (!intakeResult.needs_catalog) {
    if (intakeResult.screen?.question_id === 'complete') {
      await recordOutcome(intakeResult);
    }
    return intakeResult;
  }

  // Load products for catalogue decision
  const snapshot = await loadSnapshot();
  const countryCode = intakeResult.state?.country_code || 'DE';
  const pathway = intakeResult.state?.pathway_code || 'pain_fever';

  // Reference JSON is searchable, but cannot become a clinical release by setting flags.
  const releaseTrusted = snapshotTrust.trusted && snapshotTrust.expires_at > Date.now();
  const candidateProducts = releaseTrusted ? (snapshot?.products || [])
    .filter(p => p.country_code === countryCode && p.pathway_code === pathway)
    .map(p => ({ ...p })) : [];

  const inputForCatalog = {
    all: () => candidateProducts.map(p => ({ json: p })),
    first: () => ({ json: candidateProducts[0] || {} })
  };

  const fakeScope = {
    'Intake and Safety Engine': {
      first: () => ({ json: intakeResult })
    }
  };

  const getScope = (name) => fakeScope[name] || { first: () => ({ json: {} }) };

  const catalogDecision = runCatalogCode(inputForCatalog, getScope)[0]?.json || {};

  if (catalogDecision.product?.sku && snapshot?.vending_inventory) {
    const slot = snapshot.vending_inventory.find(v => v.sku === catalogDecision.product.sku);
    if (slot) {
      catalogDecision.vending_slot = {
        slot_number: slot.slot,
        stock_count: slot.stock_count,
        max_capacity: slot.max_capacity,
        in_stock: slot.stock_count > 0,
        price: slot.price,
        currency: slot.currency,
        status: slot.status,
      };
    }
  }
  if (catalogDecision.screen?.question_id === 'complete' || catalogDecision.state?.completed) {
    await recordOutcome(catalogDecision);
  }

  return catalogDecision;
}

export async function searchCatalog({ query = '', country = 'ALL', pathway = null }) {
  const snapshot = await loadSnapshot();
  if (!snapshot?.products) return { results: [], total: 0 };

  const q = String(query || '').toLowerCase().trim();
  const vMap = new Map((snapshot.vending_inventory || []).map(v => [v.sku, v]));

  const results = snapshot.products.filter(p => {
    if (country !== 'ALL' && p.country_code !== country) return false;
    if (pathway && p.pathway !== pathway) return false;
    if (!q) return true;

    const matchName = (p.product_name || '').toLowerCase().includes(q);
    const matchBrand = (p.brand_name || '').toLowerCase().includes(q);
    const matchIngredient = (p.active_ingredients || []).some(i => (i.name || '').toLowerCase().includes(q));
    const matchAtc = (p.atc_code || '').toLowerCase().includes(q);
    return matchName || matchBrand || matchIngredient || matchAtc;
  }).map(p => {
    const vStock = vMap.get(p.sku);
    return {
      recommendation_authorized: false,
      reference_only: true,
      sku: p.sku,
      product_name: p.product_name,
      brand_name: p.brand_name,
      country_code: p.country_code,
      pathway: p.pathway,
      active_ingredients: p.active_ingredients,
      atc_code: p.atc_code,
      dosage_form: p.dosage_form,
      pack_size: p.pack_size,
      regulatory: p.regulatory,
      safety: {
        max_duration_days: p.safety?.maximum_duration_days,
        warnings: p.safety?.warnings,
        // Unreviewed reference records do not provide customer dose instructions.
      },
      vending: vStock ? {
        in_stock: vStock.stock_count > 0,
        slot: vStock.slot,
        stock_count: vStock.stock_count,
        price: vStock.price,
        currency: vStock.currency
      } : {
        in_stock: false,
        slot: null,
        stock_count: 0,
        status: 'CATALOGUE_ONLY'
      }
    };
  });

  return { results, total: results.length };
}

export async function findAlternatives(sku) {
  const snapshot = await loadSnapshot();
  const requested = snapshot?.products?.find(p => p.sku === sku);
  // The current mapping data has no approved equivalence evidence or patient context.
  return {
    requested: requested ? { sku: requested.sku, brand_name: requested.brand_name,
      product_name: requested.product_name, country_code: requested.country_code } : null,
    alternatives: [],
    reason: 'pharmacist_review_required',
    recommendation_authorized: false,
    dispense_authorized: false,
  };
}

export async function validateCombination(productSku, currentMedications = [], patientAllergies = [], country = 'DE') {
  const snapshot = await loadSnapshot();
  const blocked = (reason, extra = {}) => ({ valid: false, blocked: true, reason,
    recommendation_authorized: false, dispense_authorized: false, ...extra });
  if (![currentMedications, patientAllergies].every(terms => Array.isArray(terms)
      && terms.length <= 50 && terms.every(term => typeof term === 'string' && term.trim().length > 0 && term.length <= 240))) {
    return blocked('invalid_medication_history');
  }
  const product = snapshot?.products?.find(p => p.sku === productSku);
  if (!product) return blocked('product_not_found');
  if (['withdrawn', 'retired', 'recalled'].includes(product.market_status || product.regulatory?.market_status)) {
    return blocked('regulatory_alert_withdrawn');
  }
  const ingredients = (product.active_ingredients || []).map(i => i.name).filter(Boolean);
  if (medicineTermsConflict(patientAllergies, ingredients)) return blocked('allergy_conflict');
  const medicationIngredients = currentMedications.flatMap(term => {
    const matches = (snapshot.products || []).filter(p => p.sku === term
      || (p.brand_name && p.brand_name.toLowerCase() === term.toLowerCase())
      || (p.product_name && p.product_name.toLowerCase() === term.toLowerCase()));
    return [term, ...matches.flatMap(p => (p.active_ingredients || []).map(i => i.name))];
  });
  if (medicineTermsConflict(medicationIngredients, ingredients)) return blocked('duplicate_active_ingredient');
  if (!snapshotTrust.trusted || snapshotTrust.expires_at <= Date.now()) return blocked('untrusted_catalogue');
  const reasons = productApprovalReasons(product, country);
  if (reasons.length) return blocked('product_not_approved', { reason_codes: reasons });
  // Ingredient checks alone cannot establish overall patient eligibility or dose safety.
  return blocked('complete_assessment_required');
}

export async function catalogReadiness(country = 'DE') {
  const snapshot = await loadSnapshot();
  const trusted = snapshotTrust.trusted && snapshotTrust.expires_at > Date.now();
  return { available: Boolean(snapshot), trusted, reason: trusted ? 'verified_release' : snapshotTrust.reason,
    version: snapshot?.snapshot_version || null,
    jurisdictions: [...new Set((snapshot?.products || []).map(p => p.country_code))],
    approved_product_count: trusted ? snapshot.products.filter(p => productApprovalReasons(p, country).length === 0).length : 0 };
}

async function recordOutcome(decision) {
  try {
    const queueDir = resolve(projectRoot, 'tmp');
    if (!existsSync(queueDir)) await mkdir(queueDir, { recursive: true });
    const logPath = join(queueDir, 'offline_outcome_queue.jsonl');
    
    const record = {
      schema_version: 2,
      event_id: randomUUID(),
      payload: runOutcomeCode({ first: () => ({ json: decision }) })[0].json,
      timestamp: new Date().toISOString(),
      synced: false
    };

    await appendFile(logPath, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to append to offline outcome queue:', err);
  }
}
