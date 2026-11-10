import { randomUUID } from 'node:crypto';

// Clinical state is owned by the server. Client state is never used as evidence.
export function createSessionManager(processTurn, { country = 'DE', ttlMs = 120000, maxSessions = 1000, now = Date.now } = {}) {
  const sessions = new Map();
  const busy = new Set();
  return async function chat(body) {
    const time = now();
    for (const [id, session] of sessions) if (session.expires <= time) sessions.delete(id);
    const previous = sessions.get(body.session_id);
    const reset = body.reset === true || body.answer?.value === 'restart';
    const fresh = reset || !previous;
    if (!fresh && busy.has(body.session_id)) {
      return { status: 409, result: { error: 'A turn is already being processed.', code: 'turn_in_progress', dispense_authorized: false } };
    }
    if (!fresh && body.revision !== previous.result.revision) {
      return { status: 409, result: { error: 'This answer is stale. Restart the assessment.', code: 'stale_turn', dispense_authorized: false } };
    }
    if (fresh && sessions.size >= maxSessions) {
      return { status: 503, result: { error: 'Please try again shortly.', code: 'session_capacity', dispense_authorized: false } };
    }
    const id = fresh ? randomUUID() : body.session_id;
    busy.add(id);
    try {
      const result = await processTurn({
        session_id: id,
        country_code: country,
        language_code: /^[a-z]{2}(?:-[A-Z]{2})?$/.test(body.language_code) ? body.language_code : 'de',
        reset: fresh,
        mode: body.mode,
        query: body.query || body.answer?.text || (typeof body.answer?.value === 'string' ? body.answer.value : undefined),
        state: fresh ? null : structuredClone(previous.result.state),
        answer: fresh ? null : body.answer,
      });
      result.revision = fresh ? 0 : previous.result.revision + 1;
      sessions.set(id, { result: structuredClone(result), expires: time + ttlMs });
      if (reset && body.session_id !== id) sessions.delete(body.session_id);
      return { status: 200, result };
    } finally {
      busy.delete(id);
    }
  };
}
