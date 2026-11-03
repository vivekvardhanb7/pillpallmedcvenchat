-- Optional synthetic fixture for exercising the product-result path.
-- Run after migrations 000 through 004.
--
-- This record is NOT a medicine and NOT a clinical or legal approval. It lives
-- in the reserved test country ZZ, so the Morocco (MA) kiosk catalogue is never
-- affected. Never copy this fixture into a real country or enable a real product
-- this way.

begin;

insert into public.countries (code, name, default_language_code, currency_code)
values ('ZZ', 'Test Fixture (not a real country)', 'en', 'XXX')
on conflict (code) do update set
  name = excluded.name,
  default_language_code = excluded.default_language_code,
  currency_code = excluded.currency_code;

insert into public.symptom_pathways (
  country_code,
  language_code,
  code,
  display_name,
  description,
  icon_name,
  display_order,
  enabled,
  clinical_status,
  reviewer_name,
  reviewed_at
)
values (
  'ZZ',
  'en',
  'pain_fever',
  'TEST FIXTURE pathway',
  'Synthetic pathway used only to exercise product-result logic. Not clinical guidance.',
  'thermometer',
  10,
  true,
  'approved',
  'Automated test fixture - NOT clinical approval',
  now()
)
on conflict (country_code, language_code, code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  enabled = excluded.enabled,
  clinical_status = excluded.clinical_status,
  reviewer_name = excluded.reviewer_name,
  reviewed_at = excluded.reviewed_at;

insert into public.products (
  country_code,
  sku,
  product_name,
  brand_name,
  active_ingredients,
  strength_label,
  dosage_form,
  route,
  pack_size,
  market_status,
  label_url,
  label_version,
  source_document,
  research_notes,
  clinical_status,
  legal_status,
  chatbot_enabled
)
values (
  'ZZ',
  'ZZ-FIXTURE-TEST-500',
  'TEST FIXTURE PRODUCT',
  'TEST FIXTURE',
  '[{"name":"test ingredient","strength":"500","unit":"mg"}]'::jsonb,
  '500 mg',
  'tablet',
  'oral',
  '10 tablets',
  'commercialised',
  'https://example.invalid/pillpal-test-fixture',
  'fixture-1',
  'PILLPAL synthetic test fixture',
  'Synthetic record for exercising product-result logic. Not a medicine. Must never be used for real dispensing.',
  'approved',
  'approved',
  false
)
on conflict (country_code, sku) do update set
  product_name = excluded.product_name,
  brand_name = excluded.brand_name,
  active_ingredients = excluded.active_ingredients,
  strength_label = excluded.strength_label,
  dosage_form = excluded.dosage_form,
  route = excluded.route,
  pack_size = excluded.pack_size,
  market_status = excluded.market_status,
  label_url = excluded.label_url,
  label_version = excluded.label_version,
  source_document = excluded.source_document,
  research_notes = excluded.research_notes,
  clinical_status = excluded.clinical_status,
  legal_status = excluded.legal_status,
  chatbot_enabled = false;

insert into public.product_safety (
  product_id,
  allowed_indications,
  minimum_age_months,
  maximum_age_years,
  pregnancy_rule,
  breastfeeding_rule,
  contraindications,
  allergy_terms,
  interaction_rules,
  dose_instructions,
  maximum_duration_days,
  warnings,
  clinical_source_url,
  clinical_source_version,
  reviewer_name,
  reviewer_role,
  reviewed_at,
  review_status,
  version
)
select
  p.id,
  '["headache","pain","fever"]'::jsonb,
  216,
  65,
  'refer',
  'refer',
  '["example condition"]'::jsonb,
  '["test ingredient"]'::jsonb,
  '["example interacting medicine"]'::jsonb,
  '{"display_text":"Synthetic test instructions only. Not a real dose. Do not dispense."}'::jsonb,
  3,
  '["Synthetic test fixture. Not medical advice."]'::jsonb,
  'https://example.invalid/pillpal-test-fixture',
  'fixture-1',
  'Automated test fixture - NOT clinical approval',
  'test_fixture',
  now(),
  'approved',
  1
from public.products p
where p.country_code = 'ZZ'
  and p.sku = 'ZZ-FIXTURE-TEST-500'
on conflict (product_id) do update set
  allowed_indications = excluded.allowed_indications,
  minimum_age_months = excluded.minimum_age_months,
  maximum_age_years = excluded.maximum_age_years,
  pregnancy_rule = excluded.pregnancy_rule,
  breastfeeding_rule = excluded.breastfeeding_rule,
  contraindications = excluded.contraindications,
  allergy_terms = excluded.allergy_terms,
  interaction_rules = excluded.interaction_rules,
  dose_instructions = excluded.dose_instructions,
  maximum_duration_days = excluded.maximum_duration_days,
  warnings = excluded.warnings,
  clinical_source_url = excluded.clinical_source_url,
  clinical_source_version = excluded.clinical_source_version,
  reviewer_name = excluded.reviewer_name,
  reviewer_role = excluded.reviewer_role,
  reviewed_at = excluded.reviewed_at,
  review_status = excluded.review_status,
  version = excluded.version;

insert into public.product_pathways (
  product_id,
  pathway_id,
  approval_status,
  display_priority,
  reviewer_name,
  reviewed_at
)
select
  p.id,
  sp.id,
  'approved',
  10,
  'Automated test fixture - NOT clinical approval',
  now()
from public.products p
join public.symptom_pathways sp
  on sp.country_code = 'ZZ'
 and sp.language_code = 'en'
 and sp.code = 'pain_fever'
where p.country_code = 'ZZ'
  and p.sku = 'ZZ-FIXTURE-TEST-500'
on conflict (product_id, pathway_id) do update set
  approval_status = excluded.approval_status,
  display_priority = excluded.display_priority,
  reviewer_name = excluded.reviewer_name,
  reviewed_at = excluded.reviewed_at;

-- Enable last so the products trigger sees the approved safety and mapping rows.
update public.products
set chatbot_enabled = true
where country_code = 'ZZ'
  and sku = 'ZZ-FIXTURE-TEST-500';

commit;

-- Expected: one eligible row for country ZZ, language en, pathway pain_fever.
select country_code, language_code, pathway_code, sku, product_name, display_priority
from public.recommendable_product_pathways
where country_code = 'ZZ'
  and language_code = 'en'
  and pathway_code = 'pain_fever';

-- Teardown (run manually when finished):
-- delete from public.products where country_code = 'ZZ';
-- delete from public.symptom_pathways where country_code = 'ZZ';
-- delete from public.countries where code = 'ZZ';
