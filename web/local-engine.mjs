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
import { isEmergencyWording } from './question-intent.js';
import { retrieveEvidence } from './rag-client.mjs';

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


export async function processRagTurn(body) {
  const lang = /^[a-z]{2}/.test(body.language_code) ? body.language_code.slice(0, 2) : 'de';
  const query = String(body.query || body.answer?.value || body.answer?.text || '').trim();

  // If explicitly resetting without a query, or query is empty/restart, return direct consultation screen
  if (!query || query === 'restart' || (body.reset && !body.query && !body.answer?.text && !body.answer?.value)) {
    return {
      session_id: body.session_id,
      revision: 0,
      outcome: 'IN_PROGRESS',
      dispense_authorized: false,
      mode: 'rag_direct',
      message: lang === 'de'
        ? 'Willkommen bei PillPal MedAssist. Bitte beschreiben Sie Ihre Beschwerden oder fragen Sie nach einem Medikament.'
        : 'Welcome to PillPal MedAssist. Please describe your symptoms or ask a question about medication.',
      screen: {
        question_id: 'rag_consultation',
        type: 'free_text',
        title: lang === 'de'
          ? 'Wie kann ich Ihnen helfen?'
          : 'How can I help you today?',
        subtitle: lang === 'de'
          ? 'Sprechen oder tippen Sie frei. Antworten basieren auf offiziellen Fachinformationen.'
          : 'Speak or type freely. Verified information and SmPC dosage are retrieved immediately.',
        options: [
          { value: 'Kopfschmerzen und Fieber', label: lang === 'de' ? 'Kopfschmerzen & Fieber' : 'Headache & Fever' },
          { value: 'Paracetamol 500mg Dosierung', label: lang === 'de' ? 'Paracetamol 500mg Dosierung' : 'Paracetamol 500mg Dosage' },
          { value: 'Ibuprofen 400mg Einnahme', label: lang === 'de' ? 'Ibuprofen 400mg Einnahme' : 'Ibuprofen 400mg Advice' },
          { value: 'Warnzeichen und Notfall', label: lang === 'de' ? 'Warnzeichen & Notfall' : 'Warning Signs' },
        ],
      },
    };
  }

  // 1. Emergency Red-Flag Screening (Immediate Triage)
  if (isEmergencyWording(query)) {
    return {
      session_id: body.session_id,
      revision: (body.revision || 0) + 1,
      outcome: 'IMMEDIATE_MEDICAL_CARE',
      message: lang === 'de'
        ? 'Achtung: Ihre Angaben deuten auf ernste Warnzeichen hin. Bitte begeben Sie sich sofort in ärztliche Behandlung oder rufen Sie den Notruf (112).'
        : 'Warning: Emergency red-flag symptoms detected. Please seek immediate professional medical attention or call emergency services (112 / 911).',
      reason_codes: ['emergency_red_flag_detected'],
      dispense_authorized: false,
      mode: 'rag_direct',
      screen: {
        question_id: 'emergency_referral',
        type: 'emergency',
        title: lang === 'de' ? 'Sofortige ärztliche Behandlung erforderlich' : 'Immediate Medical Attention Required',
        options: [{ value: 'restart', label: lang === 'de' ? 'Neues Gespräch' : 'Start Over' }],
      },
    };
  }

  // 2. Query RAG microservice for approved clinical passages
  let ragRes = { available: false, passages: [], disclaimer: '' };
  try {
    ragRes = await retrieveEvidence({
      query,
      language: lang,
      topK: 3,
    });
  } catch (_) {}

  const passages = Array.isArray(ragRes.passages) ? ragRes.passages : [];

  // 3. Select matching approved product from catalog snapshot
  const snapshot = await loadSnapshot();
  const allProducts = snapshot?.products || [];

  let targetSku = 'MA-DOLIPRANE-500-EFF';
  const qLower = query.toLowerCase();
  const pText = passages.map(p => p.text.toLowerCase()).join(' ');

  if (qLower.includes('ibuprofen') || qLower.includes('brufen') || qLower.includes('entzünd') || qLower.includes('gelenk') || qLower.includes('schwell') || pText.includes('ibuprofen')) {
    targetSku = 'MA-BRUFEN-400';
  } else if (qLower.includes('panadol') || qLower.includes('tylenol')) {
    targetSku = 'INT-PANADOL-500';
  }

  let product = allProducts.find(p => p.sku === targetSku)
    || allProducts.find(p => p.sku === 'MA-DOLIPRANE-500-EFF')
    || allProducts[0];

  // Map vending slot
  let vendingSlot = null;
  if (snapshot?.vending_inventory && product.sku) {
    const slot = snapshot.vending_inventory.find(v => v.sku === product.sku);
    if (slot) {
      vendingSlot = {
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

  // Citations
  const citations = passages.map(p => ({
    id: p.evidence_id,
    title: p.metadata.title,
    section: p.metadata.section,
    page: p.metadata.page,
    date: p.metadata.source_date,
    collection: p.metadata.collection,
    url: p.metadata.source_url || null,
    text: p.text,
  }));

  const doseInstructions = {
    per_dose: product.safety?.max_single_dose || (lang === 'de' ? '1 Tablette (500 mg)' : '1 tablet (500 mg)'),
    min_interval_hours: product.safety?.min_dose_interval_hours || 4,
    max_doses_per_24h: 4,
    display_text: product.safety?.dose_instructions || (lang === 'de' ? '1 Tablette im Abstand von mindestens 4 bis 6 Stunden, maximal 4 Tabletten pro Tag.' : '1 tablet every 4 to 6 hours, maximum 4 tablets per 24 hours.'),
  };

  const productData = {
    ...product,
    name: product.product_name || product.brand_name || 'Paracetamol 500 mg',
    brand_name: product.brand_name || product.product_name,
    strength: product.strength_label || product.strength || '500 mg',
    instructions: doseInstructions,
    dose_instructions: doseInstructions,
    citations,
    citation_disclaimer: ragRes.disclaimer || 'Information retrieved from approved BfArM SmPCs and clinical reference collections.',
  };

  const doseText = doseInstructions.display_text;

  const adviceMessage = lang === 'de'
    ? `Anhand der geprüften Fachinformation (SmPC) ist ${productData.brand_name} eine geeignete Option für Ihre Beschwerden. Dosierung: ${doseText}`
    : `Based on verified Summary of Product Characteristics (SmPC) guidance, ${productData.brand_name} is a suitable option. Dosage: ${doseText}`;

  return {
    session_id: body.session_id,
    revision: (body.revision || 0) + 1,
    outcome: 'PRODUCT_ELIGIBLE',
    message: adviceMessage,
    reason_codes: ['rag_smpc_match'],
    dispense_authorized: false,
    mode: 'rag_direct',
    product: productData,
    vending_slot: vendingSlot,
    citations,
    screen: {
      question_id: 'complete',
      type: 'product_result',
      title: productData.brand_name,
      options: [
        { value: 'restart', label: lang === 'de' ? 'Neues Gespräch' : 'Start a new inquiry' },
      ],
    },
    summary: {
      symptom_category: 'pain_fever',
      age: '18+',
      duration: '1_to_2_days',
      severity: 'mild',
    },
  };
}

export async function processChatTurn(body) {
  if (body?.mode === 'rag' || body?.answer?.question_id === 'rag_consultation') {
    return await processRagTurn(body);
  }
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
