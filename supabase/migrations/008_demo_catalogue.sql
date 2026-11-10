-- Synthetic DEMO catalogue for the reserved test country ZZ.
-- Run after migrations 000-005. Nothing here is a medicine.
--
-- Purpose: let a demonstration show the complete flow for every symptom
-- category - interview, red-flag screening, product recommendation, allergy
-- blocking, age substitution, duration refusal and referral - without touching
-- the Morocco (MA) catalogue, which stays exactly as clinical and legal review
-- left it.
--
-- 15 synthetic products cover the six demo pathways. Each pathway carries 2-3
-- rows at different display_priority values, and the rows differ on purpose in
-- minimum_age_months, maximum_age_years and maximum_duration_days, so the
-- matcher's "first row with zero blocking reasons" substitution is visible on
-- screen instead of hidden behind a single always-matching product. ORS sachets,
-- plasters, gauze, antiseptic and saline spray are the non-medicine usage
-- products a real counter would sell alongside them.
--
-- The kiosk reaches these rows only when web/config.js sets countryCode: 'ZZ'.
-- A real MA session can never see them: the matcher filters by country code,
-- and the engine's clinical scope stays pain_fever-only for every real country.
--
-- This file deliberately does not create, correct or enable any MA product.

begin;

-- 1. Country row already exists from 005; re-assert it so this file is safe to
--    run on its own.
insert into public.countries (code, name, default_language_code, currency_code)
values ('ZZ', 'Test Fixture (not a real country)', 'en', 'XXX')
on conflict (code) do update set
  name = excluded.name,
  default_language_code = excluded.default_language_code,
  currency_code = excluded.currency_code;

-- 2. One demo pathway per symptom category except "other", which stays outside
--    scope on purpose so a demo can show the refusal. pain_fever is re-asserted
--    here so the demo menu is complete even on a database where 005 was not run.
insert into public.symptom_pathways (
  country_code, language_code, code, display_name, description,
  icon_name, display_order, enabled, clinical_status, reviewer_name, reviewed_at
)
select
  'ZZ', 'en', r.code, r.display_name,
  'Synthetic demo pathway. Exercises the interview and product-result flow only. Not clinical guidance.',
  r.icon_name, r.display_order, true, 'approved',
  'Synthetic demo data - NOT clinical approval', now()
from (values
  ('pain_fever',         'DEMO pathway: Headache, pain or fever',    'thermometer', 10),
  ('cold_cough',         'DEMO pathway: Cold or cough',              'lungs',       20),
  ('allergy',            'DEMO pathway: Allergy',                     'allergy',    30),
  ('diarrhoea',          'DEMO pathway: Diarrhoea',                  'stomach',     40),
  ('heartburn',          'DEMO pathway: Heartburn or stomach upset',  'digestive',  50),
  ('skin_minor_wound',   'DEMO pathway: Skin or minor wound',        'bandage',     60)
) as r(code, display_name, icon_name, display_order)
on conflict (country_code, language_code, code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  icon_name = excluded.icon_name,
  display_order = excluded.display_order,
  enabled = excluded.enabled,
  clinical_status = excluded.clinical_status,
  reviewer_name = excluded.reviewer_name,
  reviewed_at = excluded.reviewed_at;

-- 3a. Four products from the first version of this file were renamed below. If
--     they are still present they would sit in the same pathway at the same
--     priority as their replacements, so remove them. Cascades take their safety
--     and mapping rows with them.
delete from public.products
where country_code = 'ZZ'
  and sku in ('ZZ-DEMO-COUGH-5', 'ZZ-DEMO-ALLERGY-10', 'ZZ-DEMO-ORS-1', 'ZZ-DEMO-PLASTER-1');

-- 3b. Synthetic products. Every name carries DEMO and (synthetic) so a screenshot
--     cannot be mistaken for a real speciality, and every ingredient is a made-up
--     term so an allergy check can only ever match another demo row.
insert into public.products (
  country_code, sku, product_name, brand_name, active_ingredients, strength_label,
  dosage_form, route, pack_size, market_status, label_url, label_version,
  source_document, research_notes, clinical_status, legal_status, chatbot_enabled
)
select
  'ZZ', r.sku, r.product_name, 'DEMO SYNTHETIC',
  jsonb_build_array(jsonb_build_object('name', r.ingredient, 'strength', r.strength, 'unit', r.unit)),
  r.strength || ' ' || r.unit, r.dosage_form, r.route, r.pack_size,
  'commercialised', 'https://example.invalid/pillpal-demo-' || r.code, 'demo-1',
  'PILLPAL synthetic demo catalogue',
  'Synthetic demo record. Not a medicine, not a dose, not a clinical or legal approval. Must never be copied into a real country.',
  'approved', 'approved', false
from (values
  -- pain_fever: an adult tablet, a broader tablet, a children's syrup.
  ('ZZ-DEMO-PAINFEVER-500',   'DEMO PAIN & FEVER TABLET (synthetic)',        'pain_fever',       'demo analgesic ingredient',           '500', 'mg',       'tablet',           'oral',      '16 tablets'),
  ('ZZ-DEMO-PAINFEVER-650',   'DEMO PAIN & FEVER TABLET FORTE (synthetic)',  'pain_fever',       'demo analgesic ingredient',           '650', 'mg',       'tablet',           'oral',      '12 tablets'),
  ('ZZ-DEMO-PAINFEVER-SYRP',  'DEMO PAIN & FEVER SYRUP (synthetic)',         'pain_fever',       'demo liquid analgesic ingredient',      '120', 'mg/5 mL',  'oral liquid',      'oral',      '120 mL'),
  -- cold_cough: syrup, lozenge, and a saline spray that is not a medicine.
  ('ZZ-DEMO-COUGH-SYRUP-5',   'DEMO COUGH SYRUP (synthetic)',                'cold_cough',       'demo cough ingredient',               '5',   'mg/mL',    'oral liquid',      'oral',      '120 mL'),
  ('ZZ-DEMO-LOZENGE-1',       'DEMO THROAT LOZENGE (synthetic)',             'cold_cough',       'demo soothing lozenge ingredient',    '1',   'unit',     'lozenge',          'oral',      '24 lozenges'),
  ('ZZ-DEMO-SALINE-NASAL',    'DEMO SALINE NASAL SPRAY (synthetic)',         'cold_cough',       'demo sterile salt solution',          '0.9', '% w/v',    'nasal spray',      'nasal',     '15 mL'),
  -- allergy: a tablet and a nasal spray.
  ('ZZ-DEMO-ANTIHISTAMINE-10','DEMO ALLERGY TABLET (synthetic)',             'allergy',          'demo antihistamine ingredient',       '10',  'mg',       'tablet',           'oral',      '10 tablets'),
  ('ZZ-DEMO-ALLERGY-SPRAY',   'DEMO ALLERGY NASAL SPRAY (synthetic)',        'allergy',          'demo nasal antihistamine ingredient', '50',  'mcg/spray','nasal spray',      'nasal',     '120 sprays'),
  -- diarrhoea: a short-window antidiarrhoeal and the ORS sachet that takes over.
  ('ZZ-DEMO-ANTIDIARR-2',     'DEMO ANTI-DIARRHOEAL TABLET (synthetic)',     'diarrhoea',        'demo antidiarrhoeal ingredient',      '2',   'mg',       'tablet',           'oral',      '12 tablets'),
  ('ZZ-DEMO-ORS-SACHET',      'DEMO ORAL REHYDRATION SACHET (synthetic)',    'diarrhoea',        'demo rehydration salts',              '1',   'sachet',   'oral powder',      'oral',      '10 sachets'),
  -- heartburn: chewable tablet and a suspension.
  ('ZZ-DEMO-ANTACID-800',     'DEMO ANTACID TABLET (synthetic)',             'heartburn',        'demo antacid ingredient',             '800', 'mg',       'chewable tablet',  'oral',      '24 tablets'),
  ('ZZ-DEMO-ANTACID-SUSP',    'DEMO ANTACID SUSPENSION (synthetic)',         'heartburn',        'demo alginate ingredient',            '500', 'mg/5 mL',  'oral liquid',      'oral',      '200 mL'),
  -- skin_minor_wound: dressing, antiseptic and sterile gauze - usage products.
  ('ZZ-DEMO-PLASTER-10',      'DEMO WOUND PLASTER (synthetic)',              'skin_minor_wound', 'demo wound dressing',                 '1',   'unit',     'adhesive dressing','external',  '10 plasters'),
  ('ZZ-DEMO-ANTISEPTIC-100',  'DEMO ANTISEPTIC LIQUID (synthetic)',          'skin_minor_wound', 'demo antiseptic ingredient',          '100', 'mg/mL',    'topical solution', 'cutaneous', '100 mL'),
  ('ZZ-DEMO-GAUZE-10',        'DEMO STERILE GAUZE PAD (synthetic)',          'skin_minor_wound', 'demo sterile gauze',                  '1',   'unit',     'wound dressing',   'external',  '10 pads')
) as r(sku, product_name, code, ingredient, strength, unit, dosage_form, route, pack_size)
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

-- 4. Safety rows. The dose text says it is not a dose; the reviewer says it is
--    not an approval. Pregnancy and breastfeeding refer, so a demo can show the
--    referral path on any category.
--
--    The limits are uneven on purpose, and every row has a customer who can
--    actually reach it. The interview engine refuses anyone under 18, so no row
--    here is gated on a child:
--      PAINFEVER-500 caps at 65 years and 3 days, so an older customer or a week
--        of fever falls through to PAINFEVER-650.
--      PAINFEVER-SYRP carries a different ingredient, so a customer allergic to
--        the tablets still gets a product instead of a refusal.
--      ANTIDIARR-2 allows 2 days, so a longer report lands on the ORS sachet.
--      ANTIHISTAMINE-10, ANTACID-800 and COUGH-SYRUP are the first-choice rows an
--        adult with today's symptom sees; their partners take over on age or
--        duration.
insert into public.product_safety (
  product_id, allowed_indications, minimum_age_months, maximum_age_years,
  pregnancy_rule, breastfeeding_rule, contraindications, allergy_terms,
  interaction_rules, dose_instructions, maximum_duration_days, warnings,
  clinical_source_url, clinical_source_version, reviewer_name, reviewer_role,
  reviewed_at, review_status, version
)
select
  p.id,
  r.indications::jsonb,
  r.min_age_months,
  r.max_age_years,
  'refer',
  'refer',
  jsonb_build_array('demo contraindicated condition'),
  jsonb_build_array(r.ingredient),
  jsonb_build_array('demo interacting medicine'),
  jsonb_build_object('display_text', 'Synthetic demo instructions only. Not a real dose. Do not dispense and do not treat as medical advice.'),
  r.max_days,
  jsonb_build_array('Synthetic demo product. Not a medicine. Not medical advice.'),
  'https://example.invalid/pillpal-demo-' || r.code,
  'demo-1',
  'Synthetic demo data - NOT clinical approval',
  'demo_fixture',
  now(),
  'approved',
  1
from public.products p
join (values
  ('ZZ-DEMO-PAINFEVER-500',   'pain_fever',       'demo analgesic ingredient',          '["headache","pain","fever"]',                    36,  65,  3),
  ('ZZ-DEMO-PAINFEVER-650',   'pain_fever',       'demo analgesic ingredient',          '["headache","pain","fever"]',                    72, 100,  7),
  ('ZZ-DEMO-PAINFEVER-SYRP',  'pain_fever',       'demo liquid analgesic ingredient',   '["headache","pain","fever"]',                     3, 100,  7),
  ('ZZ-DEMO-COUGH-SYRUP-5',   'cold_cough',       'demo cough ingredient',              '["cough","cold","sore throat"]',                 72, 100,  7),
  ('ZZ-DEMO-LOZENGE-1',       'cold_cough',       'demo soothing lozenge ingredient',   '["sore throat","cough","dry throat"]',          144, 100, 14),
  ('ZZ-DEMO-SALINE-NASAL',    'cold_cough',       'demo sterile salt solution',         '["cold","blocked nose","runny nose"]',             1, 100, 30),
  ('ZZ-DEMO-ANTIHISTAMINE-10','allergy',          'demo antihistamine ingredient',      '["allergy","hay fever","urticaria"]',             24,  65, 14),
  ('ZZ-DEMO-ALLERGY-SPRAY',   'allergy',          'demo nasal antihistamine ingredient','["hay fever","allergic rhinitis"]',               72, 100, 30),
  ('ZZ-DEMO-ANTIDIARR-2',     'diarrhoea',        'demo antidiarrhoeal ingredient',     '["diarrhoea"]',                                  144,  65,  2),
  ('ZZ-DEMO-ORS-SACHET',      'diarrhoea',        'demo rehydration salts',             '["diarrhoea","dehydration"]',                      3, 100, 10),
  ('ZZ-DEMO-ANTACID-800',     'heartburn',        'demo antacid ingredient',            '["heartburn","acid reflux","indigestion"]',      144,  65,  7),
  ('ZZ-DEMO-ANTACID-SUSP',    'heartburn',        'demo alginate ingredient',           '["heartburn","indigestion","reflux"]',            12, 100, 14),
  ('ZZ-DEMO-PLASTER-10',      'skin_minor_wound', 'demo wound dressing',                '["minor wound","cut","graze","blister"]',          1, 100, 30),
  ('ZZ-DEMO-ANTISEPTIC-100',  'skin_minor_wound', 'demo antiseptic ingredient',         '["minor wound","cut","graze","insect bite"]',     12, 100, 14),
  ('ZZ-DEMO-GAUZE-10',        'skin_minor_wound', 'demo sterile gauze',                 '["minor wound","burn","cut"]',                     1, 100, 30)
) as r(sku, code, ingredient, indications, min_age_months, max_age_years, max_days)
  on p.sku = r.sku
where p.country_code = 'ZZ'
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

-- 5. Pathway mappings. display_priority is the matcher's ordering: it walks the
--    list and takes the first product with no blocking reason, so the priority
--    10 row is what a plain adult demo sees and the higher numbers are what
--    appear after an age or duration refusal.
insert into public.product_pathways (
  product_id, pathway_id, approval_status, display_priority, reviewer_name, reviewed_at
)
select
  p.id, sp.id, 'approved', r.priority, 'Synthetic demo data - NOT clinical approval', now()
from public.products p
join (values
  ('ZZ-DEMO-PAINFEVER-500',   'pain_fever',        10),
  ('ZZ-DEMO-PAINFEVER-650',   'pain_fever',        20),
  ('ZZ-DEMO-PAINFEVER-SYRP',  'pain_fever',        30),
  ('ZZ-DEMO-COUGH-SYRUP-5',   'cold_cough',        10),
  ('ZZ-DEMO-LOZENGE-1',       'cold_cough',        20),
  ('ZZ-DEMO-SALINE-NASAL',    'cold_cough',        30),
  ('ZZ-DEMO-ANTIHISTAMINE-10','allergy',           10),
  ('ZZ-DEMO-ALLERGY-SPRAY',   'allergy',           20),
  ('ZZ-DEMO-ANTIDIARR-2',     'diarrhoea',         10),
  ('ZZ-DEMO-ORS-SACHET',      'diarrhoea',         20),
  ('ZZ-DEMO-ANTACID-800',     'heartburn',         10),
  ('ZZ-DEMO-ANTACID-SUSP',    'heartburn',         20),
  ('ZZ-DEMO-PLASTER-10',      'skin_minor_wound',  10),
  ('ZZ-DEMO-ANTISEPTIC-100',  'skin_minor_wound',  20),
  ('ZZ-DEMO-GAUZE-10',        'skin_minor_wound',  30)
) as r(sku, code, priority) on p.sku = r.sku
join public.symptom_pathways sp
  on sp.country_code = 'ZZ' and sp.language_code = 'en' and sp.code = r.code
where p.country_code = 'ZZ'
on conflict (product_id, pathway_id) do update set
  approval_status = excluded.approval_status,
  display_priority = excluded.display_priority,
  reviewer_name = excluded.reviewer_name,
  reviewed_at = excluded.reviewed_at;

-- 6. The 005 automated-test fixture also sits on pain_fever. Push it behind the
--    demo rows so the demo shows a DEMO product name, while the fixture stays
--    recommendable for the engine tests.
update public.product_pathways pp
set display_priority = 40,
    reviewer_name = 'Synthetic demo ordering - NOT clinical approval',
    reviewed_at = now()
from public.products p
join public.symptom_pathways sp
  on sp.country_code = 'ZZ' and sp.language_code = 'en' and sp.code = 'pain_fever'
where pp.product_id = p.id and pp.pathway_id = sp.id
  and p.country_code = 'ZZ' and p.sku = 'ZZ-FIXTURE-TEST-500';

-- 7. Enable last, so the products trigger sees the safety and mapping rows.
update public.products
set chatbot_enabled = true
where country_code = 'ZZ'
  and sku like 'ZZ-DEMO-%';

commit;

-- Expected: sixteen recommendable rows for country ZZ, language en - the fifteen
-- ZZ-DEMO-% products above plus the 005 fixture on pain_fever.
select pathway_code, display_priority, sku, product_name
from public.recommendable_product_pathways
where country_code = 'ZZ' and language_code = 'en'
order by pathway_code, display_priority;

-- Expected: pain_fever rows in priority order 10, 20, 30, 40.
select display_priority, sku
from public.recommendable_product_pathways
where country_code = 'ZZ' and language_code = 'en' and pathway_code = 'pain_fever'
order by display_priority;

-- Expected: zero rows. This demo must not enable anything in a real country.
select sku, product_name, chatbot_enabled
from public.products
where country_code <> 'ZZ' and chatbot_enabled = true;

-- Teardown (run manually when the demo is finished):
-- delete from public.products where country_code = 'ZZ' and sku like 'ZZ-DEMO-%';
-- delete from public.symptom_pathways where country_code = 'ZZ' and code <> 'pain_fever';
