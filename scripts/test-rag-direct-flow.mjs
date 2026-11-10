import assert from 'node:assert/strict';
import { processChatTurn } from '../web/local-engine.mjs';

console.log('Testing Direct Free-Form RAG Consultation Flow...\n');

// 1. Initial Greeting Screen in RAG Mode
console.log('>>> [1. Initial RAG Greeting Screen]');
{
  const greetingTurn = await processChatTurn({
    reset: true,
    mode: 'rag',
    language_code: 'de',
  });

  assert.equal(greetingTurn.outcome, 'IN_PROGRESS');
  assert.equal(greetingTurn.screen.question_id, 'rag_consultation');
  assert.equal(greetingTurn.mode, 'rag_direct');
  assert.ok(greetingTurn.screen.options.length >= 4);
  console.log('✔ Direct RAG greeting screen initialized without 11-step questionnaire.');
}

// 2. Direct Symptom Query -> RAG SmPC Recommendation (DE)
console.log('\n>>> [2. German Headache Query -> SmPC Guidance]');
{
  const turn = await processChatTurn({
    mode: 'rag',
    language_code: 'de',
    query: 'Ich habe seit heute Morgen Kopfschmerzen und leichtes Fieber.',
  });

  assert.equal(turn.outcome, 'PRODUCT_ELIGIBLE');
  assert.ok(turn.product);
  assert.ok(
    turn.product.brand_name.includes('DOLIPRANE') ||
    turn.product.brand_name.includes('BRUFEN') ||
    turn.product.product_name.toLowerCase().includes('paracetamol') ||
    turn.product.product_name.toLowerCase().includes('ibuprofen')
  );
  assert.ok(turn.product.dose_instructions);
  assert.ok(turn.product.citations.length > 0);
  assert.ok(turn.message.includes('Fachinformation'));
  console.log(`✔ Recommended: ${turn.product.brand_name} with ${turn.product.citations.length} verified SmPC citations.`);
}

// 3. Direct Symptom Query -> RAG SmPC Recommendation (EN)
console.log('\n>>> [3. English Headache Query -> SmPC Guidance]');
{
  const turn = await processChatTurn({
    mode: 'rag',
    language_code: 'en',
    query: 'What is the dosage of paracetamol for tension headache?',
  });

  assert.equal(turn.outcome, 'PRODUCT_ELIGIBLE');
  assert.ok(turn.product);
  assert.ok(turn.product.citations.length > 0);
  assert.ok(turn.message.includes('SmPC') || turn.message.includes('guidance'));
  console.log(`✔ Recommended: ${turn.product.brand_name} with citations: ${turn.product.citations.map(c => c.title).join(', ')}`);
}

// 4. Emergency Red-Flag Triage
console.log('\n>>> [4. Emergency Red-Flag Triage Guardrail]');
{
  const emergencyTurn = await processChatTurn({
    mode: 'rag',
    language_code: 'en',
    query: 'I have severe chest pain and trouble breathing',
  });

  assert.equal(emergencyTurn.outcome, 'IMMEDIATE_MEDICAL_CARE');
  assert.equal(emergencyTurn.dispense_authorized, false);
  assert.equal(emergencyTurn.screen.question_id, 'emergency_referral');
  console.log('✔ Red-flag emergency words trigger immediate referral without delay.');
}

console.log('\n================================================================');
console.log(' DIRECT RAG CONSULTATION TESTS PASSED (100% SUCCESS)!           ');
console.log('================================================================\n');
