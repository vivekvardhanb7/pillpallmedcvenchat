-- Research-only seed records.
-- Run after 001_medical_chatbot_schema.sql.
-- These records are deliberately disabled and are not dispensing approvals.

begin;

insert into public.countries (code, name, default_language_code, currency_code)
values ('MA', 'Morocco', 'en', 'MAD')
on conflict (code) do update set
  name = excluded.name,
  default_language_code = excluded.default_language_code,
  currency_code = excluded.currency_code;

insert into public.products (
  country_code,
  sku,
  product_name,
  brand_name,
  active_ingredients,
  strength_label,
  dosage_form,
  market_status,
  source_document,
  research_notes,
  clinical_status,
  legal_status,
  chatbot_enabled
)
values
  (
    'MA',
    'MA-RESEARCH-DOLIPRANE-500-EFF',
    'DOLIPRANE 500 mg effervescent',
    'DOLIPRANE',
    '[{"name":"paracetamol","strength":"500","unit":"mg"}]'::jsonb,
    '500 mg',
    'effervescent tablet',
    'commercialised',
    'Morocco Medical Vending Machine Report - Final Edition',
    'Research shortlist only. Verify barcode, pack, local leaflet, sale class, dosing, contraindications and vending eligibility.',
    'draft', 'draft', false
  ),
  (
    'MA',
    'MA-RESEARCH-BRUFEN-400',
    'BRUFEN 400 mg coated tablet',
    'BRUFEN',
    '[{"name":"ibuprofen","strength":"400","unit":"mg"}]'::jsonb,
    '400 mg',
    'coated tablet',
    'commercialised',
    'Morocco Medical Vending Machine Report - Final Edition',
    'Research shortlist only. Verify barcode, pack, local leaflet, sale class, dosing, contraindications and vending eligibility.',
    'draft', 'draft', false
  ),
  (
    'MA',
    'MA-RESEARCH-IMODIUM-2',
    'IMODIUM 2 mg capsule',
    'IMODIUM',
    '[{"name":"loperamide","strength":"2","unit":"mg"}]'::jsonb,
    '2 mg',
    'capsule',
    'commercialised',
    'Morocco Medical Vending Machine Report - Final Edition',
    'Research shortlist only. Verify barcode, pack, local leaflet, sale class, dosing, contraindications and vending eligibility.',
    'draft', 'draft', false
  ),
  (
    'MA',
    'MA-RESEARCH-ZYRTEC-10',
    'ZYRTEC 10 mg',
    'ZYRTEC',
    '[{"name":"cetirizine","strength":"10","unit":"mg"}]'::jsonb,
    '10 mg',
    null,
    'commercialised',
    'Morocco Medical Vending Machine Report - Final Edition',
    'Research shortlist only. Verify dosage form, barcode, pack, local leaflet, sale class, dosing, contraindications and vending eligibility.',
    'draft', 'draft', false
  )
on conflict (country_code, sku) do update set
  product_name = excluded.product_name,
  brand_name = excluded.brand_name,
  active_ingredients = excluded.active_ingredients,
  strength_label = excluded.strength_label,
  dosage_form = excluded.dosage_form,
  market_status = excluded.market_status,
  source_document = excluded.source_document,
  research_notes = excluded.research_notes;

-- Touchscreen categories for building the English UI. They remain disabled
-- until a clinician approves the corresponding questions and rules.
insert into public.symptom_pathways (
  country_code,
  language_code,
  code,
  display_name,
  description,
  icon_name,
  display_order,
  enabled,
  clinical_status
)
values
  ('MA', 'en', 'pain_fever', 'Headache, pain or fever', 'Research pathway', 'thermometer', 10, false, 'draft'),
  ('MA', 'en', 'cold_cough', 'Cold or cough', 'Research pathway', 'lungs', 20, false, 'draft'),
  ('MA', 'en', 'allergy', 'Allergy', 'Research pathway', 'allergy', 30, false, 'draft'),
  ('MA', 'en', 'diarrhoea', 'Diarrhoea', 'Research pathway', 'stomach', 40, false, 'draft'),
  ('MA', 'en', 'heartburn', 'Heartburn or stomach discomfort', 'Research pathway', 'digestive', 50, false, 'draft'),
  ('MA', 'en', 'skin_minor_wound', 'Skin or minor wound', 'Research pathway', 'bandage', 60, false, 'draft'),
  ('MA', 'en', 'other', 'Other symptom', 'Free-text intake followed by controlled routing', 'chat', 70, false, 'draft')
on conflict (country_code, language_code, code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  icon_name = excluded.icon_name,
  display_order = excluded.display_order;

-- Controlled English outcome text. Messages remain inactive until the project
-- owner approves the wording for the intended deployment.
insert into public.ui_messages (
  country_code, language_code, code, message_text, active
)
values
  ('MA', 'en', 'MORE_INFORMATION',
   'I need a little more information before checking whether a product may be suitable.', false),
  ('MA', 'en', 'NO_SUITABLE_PRODUCT',
   'No suitable product is available from this machine for the information provided. Please visit a nearby clinic, doctor or pharmacy for advice.', false),
  ('MA', 'en', 'CLINIC_REFERRAL',
   'This machine cannot recommend a medicine for these symptoms. Please visit a nearby clinic or doctor.', false),
  ('MA', 'en', 'IMMEDIATE_MEDICAL_CARE',
   'This may require immediate medical attention. Please seek care at the nearest emergency department or clinic.', false)
on conflict (country_code, language_code, code, version) do update set
  message_text = excluded.message_text;

commit;


