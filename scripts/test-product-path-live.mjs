/**
 * Live product-result check. Requires migration 005 to be applied.
 *
 * Usage:
 *   node scripts/test-product-path-live.mjs [webhook-url]
 *
 * The default URL is the local n8n production webhook. This script never
 * authorizes dispensing; it only verifies the catalogue outcome and blocking.
 */

const webhookUrl = process.argv[2]
  || process.env.PILLPAL_WEBHOOK_URL
  || 'http://localhost:5678/webhook/pillpal-chat-turn';

// Set this when the webhook node uses Header Auth, as the generated workflow does.
const webhookSecret = process.env.PILLPAL_WEBHOOK_SECRET || '';

const COUNTRY = 'ZZ';
const SESSION_PREFIX = `fixture_check_${Date.now()}`;

async function post(body) {
  const headers = { 'Content-Type': 'text/plain' };
  if (webhookSecret) headers['X-PILLPAL-Auth'] = webhookSecret;
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new Error(`HTTP ${response.status}: the webhook rejected the auth header. Set PILLPAL_WEBHOOK_SECRET to the Header Auth credential value.`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Workflow returned non-JSON: ${text.slice(0, 300)}`);
  }
}

async function runSession(name, answers) {
  let result = await post({ session_id: `${SESSION_PREFIX}_${name}`, country_code: COUNTRY, language_code: 'en', reset: true });
  for (const value of answers) {
    if (!result.screen) break;
    result = await post({
      session_id: `${SESSION_PREFIX}_${name}`,
      country_code: COUNTRY,
      language_code: 'en',
      state: result.state,
      answer: { question_id: result.screen.question_id, value },
    });
    if (result.screen?.question_id === 'complete') break;
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const eligible = await runSession('eligible', [
  'pain_fever', 30, 'today', 'mild', 'no', 'not_applicable',
  'no', 'no', 'no', 'yes',
]);
assert(eligible.outcome === 'PRODUCT_ELIGIBLE', `Expected PRODUCT_ELIGIBLE, received ${eligible.outcome} (${JSON.stringify(eligible.reason_codes)})`);
assert(eligible.product?.name === 'TEST FIXTURE PRODUCT', `Unexpected product: ${eligible.product?.name}`);
assert(eligible.dispense_authorized === false, 'dispense_authorized must remain false');
console.log(`Eligible path OK: ${eligible.product.name} (${eligible.outcome})`);

const blocked = await runSession('allergy_block', [
  'pain_fever', 30, 'today', 'mild', 'no', 'not_applicable',
  'yes', ['test ingredient'], 'no', 'no', 'yes',
]);
assert(blocked.outcome === 'NO_SUITABLE_PRODUCT', `Expected NO_SUITABLE_PRODUCT, received ${blocked.outcome}`);
assert(blocked.reason_codes?.includes('all_products_blocked'), `Missing all_products_blocked: ${JSON.stringify(blocked.reason_codes)}`);
const blockers = blocked.system_detail?.[0]?.reasons || [];
assert(blockers.includes('allergy_conflict'), `Missing allergy_conflict: ${JSON.stringify(blocked.system_detail)}`);
assert(blocked.dispense_authorized === false, 'dispense_authorized must remain false');
console.log(`Safety-blocked path OK: ${blocked.outcome} (${blockers.join(', ')})`);

console.log(`Live product-result checks passed against ${webhookUrl}`);
