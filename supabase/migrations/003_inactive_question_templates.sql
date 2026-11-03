-- Development templates only. These are deliberately inactive.
-- A clinician must approve ordering, wording, show_if logic and pathway-specific
-- warning-sign questions before any pathway is enabled.

begin;

insert into public.questions (
  pathway_id,
  code,
  language_code,
  question_text,
  help_text,
  input_type,
  options,
  validation_rules,
  show_if,
  display_order,
  required,
  active
)
select
  sp.id,
  q.code,
  'en',
  q.question_text,
  q.help_text,
  q.input_type,
  q.options,
  q.validation_rules,
  q.show_if,
  q.display_order,
  q.required,
  false
from public.symptom_pathways sp
cross join (
  values
    (
      'age_years',
      'What is your age?',
      'Enter age in completed years.',
      'number',
      '[]'::jsonb,
      '{"minimum":0,"maximum":120,"integer":true}'::jsonb,
      '{}'::jsonb,
      10,
      true
    ),
    (
      'symptom_duration',
      'How long have you had this symptom?',
      null,
      'single_select',
      '[
        {"value":"today","label":"Started today"},
        {"value":"1_to_2_days","label":"1–2 days"},
        {"value":"3_to_7_days","label":"3–7 days"},
        {"value":"more_than_7_days","label":"More than 7 days"}
      ]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      20,
      true
    ),
    (
      'severity',
      'How severe is the symptom right now?',
      'Choose the answer that best matches how you feel.',
      'single_select',
      '[
        {"value":"mild","label":"Mild"},
        {"value":"moderate","label":"Moderate"},
        {"value":"severe","label":"Severe"}
      ]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      30,
      true
    ),
    (
      'pregnancy_breastfeeding',
      'Are you pregnant or breastfeeding?',
      null,
      'single_select',
      '[
        {"value":"pregnant","label":"Pregnant"},
        {"value":"breastfeeding","label":"Breastfeeding"},
        {"value":"both","label":"Both"},
        {"value":"no","label":"No"},
        {"value":"not_applicable","label":"Not applicable"},
        {"value":"prefer_not_to_say","label":"Prefer not to say"}
      ]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      40,
      true
    ),
    (
      'medicine_allergies',
      'Do you have any medicine allergies?',
      'If yes, enter or select the medicine or ingredient.',
      'single_select',
      '[
        {"value":"yes","label":"Yes"},
        {"value":"no","label":"No"},
        {"value":"not_sure","label":"Not sure"}
      ]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      50,
      true
    ),
    (
      'current_medicines',
      'Are you currently taking any medicines?',
      'This includes prescription and non-prescription medicines.',
      'single_select',
      '[
        {"value":"yes","label":"Yes"},
        {"value":"no","label":"No"},
        {"value":"not_sure","label":"Not sure"}
      ]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      60,
      true
    ),
    (
      'relevant_conditions',
      'Do you have any ongoing medical conditions?',
      'The next screen can collect only conditions relevant to the selected pathway.',
      'single_select',
      '[
        {"value":"yes","label":"Yes"},
        {"value":"no","label":"No"},
        {"value":"not_sure","label":"Not sure"}
      ]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      70,
      true
    )
) as q(
  code,
  question_text,
  help_text,
  input_type,
  options,
  validation_rules,
  show_if,
  display_order,
  required
)
where sp.country_code = 'MA'
  and sp.language_code = 'en'
on conflict (pathway_id, language_code, code, version) do update set
  question_text = excluded.question_text,
  help_text = excluded.help_text,
  input_type = excluded.input_type,
  options = excluded.options,
  validation_rules = excluded.validation_rules,
  show_if = excluded.show_if,
  display_order = excluded.display_order,
  required = excluded.required;

commit;

