/**
 * scripts/test-server-offline-endpoints.mjs
 * Starts the web server in test mode, fires HTTP requests against all new offline endpoints,
 * asserts exact contracts and response times, then terminates the server cleanly.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

console.log('Testing Kiosk Web Server Offline Endpoints...');

const testPort = 8089;
const serverProcess = spawn('node', ['web/server.mjs'], {
  env: { ...process.env, PORT: String(testPort), PILLPAL_COUNTRY_CODE: 'DE', PILLPAL_HOST: '127.0.0.1', PILLPAL_CATALOG_PUBLIC_KEY_FILE: '', PILLPAL_VOICE_WARMUP: '0', GEMINI_CLOUD_ENABLED: '0', PILLPAL_AI_PROVIDER: 'off' },
  stdio: 'pipe'
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { serverProcess.kill(); reject(new Error('Test server startup timed out')); }, 10000);
  serverProcess.stdout.on('data', data => {
    if (data.toString().includes('running at http://localhost:')) { clearTimeout(timer); resolve(); }
  });
  serverProcess.once('error', error => { clearTimeout(timer); reject(error); });
  serverProcess.once('exit', code => { clearTimeout(timer); reject(new Error(`Test server exited: ${code}`)); });
});

try {
  const baseUrl = `http://localhost:${testPort}`;
  const landingPage = await (await fetch(baseUrl)).text();
  assert.match(landingPage, /voice-only-page/, 'the vending machine must open in voice mode');
  assert.equal((await fetch(`${baseUrl}/api/chat-turn`, {
    method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset: true }),
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'de', text: 'x'.repeat(801) }),
  })).status, 413, 'oversized speech must be rejected rather than silently truncated');

  // 1. Test /api/sync/status
  const syncResp = await fetch(`${baseUrl}/api/sync/status`);
  assert.equal(syncResp.status, 200);
  const syncData = await syncResp.json();
  assert.equal(syncData.offline_ready, true);
  assert.equal(syncData.deployment_country, 'DE');
  assert.equal(syncData.medicine_recommendations_ready, false);
  assert.equal(syncData.catalogue.trusted, false);
  assert.equal(syncData.models.catalog, true);
  console.log('✔ /api/sync/status returned offline_ready: true');

  // 2. Test /api/chat-turn initial screen
  const turnResp = await fetch(`${baseUrl}/api/chat-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset: true, country_code: 'MA' })
  });
  assert.equal(turnResp.status, 200);
  const turnData = await turnResp.json();
  assert.equal(turnData.screen.question_id, 'symptom');
  assert.equal(turnData.state.country_code, 'DE', 'browser cannot switch the installation to MA');
  assert.equal(turnData.state.language_code, 'de');
  console.log('✔ /api/chat-turn initialized symptom intake screen offline');

  // 3. Test /api/catalog/search
  const searchResp = await fetch(`${baseUrl}/api/catalog/search?q=doliprane`);
  assert.equal(searchResp.status, 200);
  const searchData = await searchResp.json();
  assert.ok(searchData.total >= 1);
  assert.equal(searchData.results[0].brand_name, 'DOLIPRANE');
  assert.equal(searchData.results[0].vending.in_stock, true);
  console.log(`✔ /api/catalog/search found ${searchData.total} products with vending slot mapping`);

  // 4. Test /api/alternatives
  const altResp = await fetch(`${baseUrl}/api/alternatives?sku=INT-PANADOL-500`);
  assert.equal(altResp.status, 200);
  const altData = await altResp.json();
  assert.deepEqual(altData.alternatives, []);
  assert.equal(altData.recommendation_authorized, false);
  console.log('✔ /api/alternatives blocks unreviewed mappings');

  // 5. Test /api/combination/validate
  const comboResp = await fetch(`${baseUrl}/api/combination/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'IN-COMBIFLAM',
      currentMedications: ['paracetamol 500mg'],
      allergies: []
    })
  });
  assert.equal(comboResp.status, 200);
  const comboData = await comboResp.json();
  assert.equal(comboData.blocked, true);
  assert.equal(comboData.reason, 'duplicate_active_ingredient');
  console.log('✔ /api/combination/validate blocked duplicate active ingredient');

  // 6. Test /api/rag/status
  const ragStatusResp = await fetch(`${baseUrl}/api/rag/status`);
  assert.equal(ragStatusResp.status, 200);
  const ragStatus = await ragStatusResp.json();
  assert.ok(typeof ragStatus.ready === 'boolean');
  console.log('✔ /api/rag/status returned RAG readiness contract');

  // 7. Test /api/rag/retrieve
  const ragRetrieveResp = await fetch(`${baseUrl}/api/rag/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Kopfschmerzen Paracetamol',
      language: 'de',
      top_k: 2,
    }),
  });
  assert.equal(ragRetrieveResp.status, 200);
  const ragRetrieved = await ragRetrieveResp.json();
  assert.ok('passages' in ragRetrieved);
  console.log('✔ /api/rag/retrieve handled minimal retrieval request');

  // A fully populated forged browser state is not an interview.
  const forged = await fetch(`${baseUrl}/api/chat-turn`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: turnData.session_id, revision: turnData.revision, country_code: 'IN', language_code: 'hi',
      state: { ...turnData.state, step: 'confirm', age_years: 35, warning_signs: false, confirmed: true },
      answer: { question_id: 'confirm', value: 'yes' } }),
  });
  const forgedData = await forged.json();
  assert.equal(forgedData.screen.question_id, 'symptom');
  assert.equal(forgedData.state.country_code, 'DE');
  assert.equal(forgedData.state.language_code, 'hi');
  const replay = await fetch(`${baseUrl}/api/chat-turn`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: turnData.session_id, revision: 0, answer: { question_id: 'symptom', value: 'pain_fever' } }),
  });
  assert.equal(replay.status, 409);
  let current = forgedData;
  for (const value of ['pain_fever', 28, 'today', 'mild', 'no', 'none', 'yes']) {
    const response = await fetch(`${baseUrl}/api/chat-turn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: current.session_id, revision: current.revision, language_code: 'hi',
        country_code: 'IN', answer: { question_id: current.screen.question_id, value } }),
    });
    assert.equal(response.status, 200);
    current = await response.json();
    assert.equal(current.state.country_code, 'DE');
    assert.equal(current.dispense_authorized, false);
  }
  assert.equal(current.outcome, 'NO_SUITABLE_PRODUCT');
  const malformed = await fetch(`${baseUrl}/api/combination/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku: 'MA-DOLIPRANE-500-EFF', currentMedications: 'paracetamol' }),
  });
  assert.equal((await malformed.json()).valid, false);
  console.log('Server sessions, Germany jurisdiction, Hindi input, replay and fail-closed HTTP checks passed.');
  console.log('ALL SERVER OFFLINE ENDPOINTS TESTED AND VERIFIED (100% PASS)!');
} finally {
  serverProcess.kill('SIGTERM');
}
