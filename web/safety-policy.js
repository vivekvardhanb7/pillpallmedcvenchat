// Pure, shared policy. The workflow builder embeds this module in n8n Code nodes.
export function normalizeMedicine(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\b(?:acetaminophen|acetaminofen|paracetamolum|panadol|tylenol|doliprane|dolo(?:\s*650)?)\b/gu, 'paracetamol')
    .replace(/\b(?:brufen|advil|nurofen|ibuprofenum)\b/gu, 'ibuprofen')
    .replace(/\b(?:aspirin|asprin|acetylsalicylic acid|acetylsalicylsaure|ass)\b/gu, 'acetylsalicylic acid')
    .replace(/\s+/g, ' ').trim();
}

export function medicineTermsConflict(patientTerms, ruleTerms) {
  const patient = (Array.isArray(patientTerms) ? patientTerms : []).map(normalizeMedicine).filter(Boolean);
  const rules = (Array.isArray(ruleTerms) ? ruleTerms : []).map(normalizeMedicine).filter(Boolean);
  return patient.some(p => rules.some(r => p.includes(r) || r.includes(p)));
}

export function productApprovalReasons(product, country) {
  const reasons = [];
  if (product.country_code !== country) reasons.push('country_not_approved');
  if (product.chatbot_enabled !== true) reasons.push('product_disabled');
  if (product.market_status !== 'commercialised') reasons.push('market_status_not_approved');
  for (const key of ['clinical_status', 'legal_status', 'review_status', 'pathway_approval_status']) {
    if (product[key] !== 'approved') reasons.push(`${key}_not_approved`);
  }
  if (product.is_fixture !== false) reasons.push('fixture_or_unknown_origin');
  const sandbox = country === 'ZZ' && product.data_origin === 'synthetic';
  if (!sandbox && product.data_origin !== 'reviewed') reasons.push('unreviewed_origin');
  const evidenceUrl = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.hostname.endsWith('.invalid'); }
    catch { return false; }
  };
  if (!sandbox && (!product.reviewer_name || !Number.isFinite(Date.parse(product.reviewed_at))
      || !evidenceUrl(product.clinical_source_url) || !evidenceUrl(product.label_url))) {
    reasons.push('missing_review_evidence');
  }
  if (!Array.isArray(product.active_ingredients) || !product.active_ingredients.length
      || product.active_ingredients.some(i => !i || typeof i.name !== 'string' || !i.name.trim())) {
    reasons.push('missing_active_ingredients');
  }
  if (!['allergy_terms', 'contraindications', 'interaction_rules'].every(key => Array.isArray(product[key]))) {
    reasons.push('missing_safety_rules');
  }
  if (!Array.isArray(product.allowed_indications) || !product.allowed_indications.includes(product.pathway_code)) {
    reasons.push('indication_not_approved');
  }
  if (!Number.isFinite(product.minimum_age_months) || product.minimum_age_months < 0
      || !Number.isFinite(product.maximum_duration_days) || product.maximum_duration_days <= 0) {
    reasons.push('missing_safety_limits');
  }
  if (!product.dose_instructions || typeof product.dose_instructions !== 'object'
      || Array.isArray(product.dose_instructions) || product.dose_instructions.status !== 'approved'
      || !['display_text', 'dose'].some(key => typeof product.dose_instructions[key] === 'string' && product.dose_instructions[key].trim())) {
    reasons.push('missing_approved_dose');
  }
  return reasons;
}
