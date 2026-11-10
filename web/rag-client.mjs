/**
 * Internal Node-to-Flask RAG Client for PillPal.
 *
 * Provides bounded-timeout, authenticated retrieval of clinically approved passages.
 * Follows minimal assessment summary guidelines (no PII or raw conversation histories).
 */

const DEFAULT_RAG_URL = process.env.PILLPAL_RAG_URL || 'http://127.0.0.1:5001';
const RAG_SERVICE_TOKEN = process.env.PILLPAL_RAG_TOKEN || 'pillpal-internal-rag-secret';
const RAG_TIMEOUT_MS = Number(process.env.PILLPAL_RAG_TIMEOUT_MS || 2500);

/**
 * Format minimal assessment context safely without PII or raw transcripts.
 *
 * @param {object} context
 * @returns {object} Sanitized minimal payload
 */
export function buildMinimalRagPayload(context = {}) {
  let query = String(context.query || '').trim();
  // Strip prompt injection prefixes and system tags
  query = query.replace(/<\s*\/?(?:system|assistant|user|instructions?|prompt)[^>]*>/gi, '');
  query = query.replace(/\s+/g, ' ').trim().slice(0, 500);
  const language = context.language === 'de' ? 'de' : 'en';

  const symptoms = Array.isArray(context.symptoms)
    ? context.symptoms.map(s => String(s).trim().slice(0, 50)).filter(Boolean).slice(0, 10)
    : [];

  const confirmedFacts = {};
  if (context.confirmedFacts && typeof context.confirmedFacts === 'object') {
    for (const [k, v] of Object.entries(context.confirmedFacts)) {
      if (['age_years', 'age_bracket', 'duration_days', 'fever', 'severity', 'pain_location'].includes(k)) {
        confirmedFacts[k] = v;
      }
    }
  }

  const productIds = Array.isArray(context.productIds)
    ? context.productIds.map(p => String(p).trim().slice(0, 50)).filter(Boolean).slice(0, 10)
    : [];

  const topK = Math.max(1, Math.min(10, Number(context.topK) || 3));

  return {
    query: query || 'General pain and symptom self-care guidance',
    language,
    symptoms,
    confirmed_facts: confirmedFacts,
    product_ids: productIds,
    top_k: topK,
    ...(context.collection ? { collection: context.collection } : {}),
  };
}

/**
 * Retrieve approved evidence passages from the Python RAG service.
 *
 * @param {object} params
 * @returns {Promise<{ available: boolean, passages: Array, disclaimer: string, retrieval_mode?: string, error?: string }>}
 */
export async function retrieveEvidence(params = {}, ragUrl = DEFAULT_RAG_URL) {
  const payload = buildMinimalRagPayload(params);

  try {
    const response = await fetch(`${ragUrl}/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAG_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RAG_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        available: false,
        passages: [],
        disclaimer: 'Evidence retrieval service returned non-200 status.',
        error: `http_${response.status}`,
      };
    }

    const data = await response.json();
    return {
      available: true,
      query: data.query,
      language: data.language,
      passages: Array.isArray(data.passages) ? data.passages : [],
      total_found: data.total_found || 0,
      retrieval_mode: data.retrieval_mode || 'offline_local',
      disclaimer: data.disclaimer || 'Retrieval scores reflect text matching relevance only, not clinical safety.',
    };
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      available: false,
      passages: [],
      disclaimer: isTimeout
        ? 'Evidence retrieval timed out; falling back to core approved catalog information.'
        : 'Evidence retrieval service unreachable; falling back to core approved catalog information.',
      error: isTimeout ? 'rag_timeout' : 'rag_unreachable',
    };
  }
}

/**
 * Check liveness of RAG microservice.
 */
export async function checkRagLiveness(ragUrl = DEFAULT_RAG_URL) {
  try {
    const res = await fetch(`${ragUrl}/health/live`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Check readiness and approved index status of RAG microservice.
 */
export async function checkRagReadiness(ragUrl = DEFAULT_RAG_URL) {
  try {
    const res = await fetch(`${ragUrl}/health/ready`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return { ready: false, status: 'unavailable', count: 0 };
    const data = await res.json();
    return {
      ready: data.status === 'ready',
      status: data.status,
      mode: data.mode,
      index_type: data.index_type,
      approved_passages_count: data.approved_passages_count || 0,
      collections: data.collections || [],
      dimension: data.dimension || 384,
    };
  } catch (error) {
    return {
      ready: false,
      status: 'unreachable',
      approved_passages_count: 0,
      error: error?.message || 'Connection failed',
    };
  }
}
