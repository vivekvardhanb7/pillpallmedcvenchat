-- Medical chatbot / smart vending machine schema for Supabase Postgres.
-- Run this file first in the Supabase SQL Editor.
--
-- Safety model:
--   * The kiosk talks to n8n, not directly to these tables.
--   * n8n uses the Supabase service-role key only on the server.
--   * A medicine cannot be enabled until its market, clinical, legal and
--     product-safety records are approved.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  default_language_code text not null default 'en',
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code),
  sku text not null,
  barcode text,
  product_name text not null,
  brand_name text,
  active_ingredients jsonb not null default '[]'::jsonb
    check (jsonb_typeof(active_ingredients) = 'array'),
  strength_label text,
  dosage_form text,
  route text,
  pack_size text,
  manufacturer text,
  market_status text not null default 'unknown'
    check (market_status in ('unknown', 'commercialised', 'retired', 'noncommercialised')),
  sale_classification text,
  price numeric(12,2) check (price is null or price >= 0),
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  label_url text,
  label_version text,
  source_document text,
  source_page text,
  source_checked_at date,
  research_notes text,
  clinical_status text not null default 'draft'
    check (clinical_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  legal_status text not null default 'draft'
    check (legal_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  chatbot_enabled boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, sku),
  unique (country_code, barcode),
  constraint product_enable_requires_approval check (
    not chatbot_enabled
    or (
      market_status = 'commercialised'
      and clinical_status = 'approved'
      and legal_status = 'approved'
      and label_url is not null
      and label_version is not null
    )
  )
);

create table if not exists public.product_safety (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  allowed_indications jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allowed_indications) = 'array'),
  minimum_age_months integer check (minimum_age_months is null or minimum_age_months >= 0),
  maximum_age_years integer check (maximum_age_years is null or maximum_age_years > 0),
  pregnancy_rule text not null default 'refer'
    check (pregnancy_rule in ('allow', 'block', 'refer', 'not_assessed')),
  breastfeeding_rule text not null default 'refer'
    check (breastfeeding_rule in ('allow', 'block', 'refer', 'not_assessed')),
  contraindications jsonb not null default '[]'::jsonb
    check (jsonb_typeof(contraindications) = 'array'),
  allergy_terms jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allergy_terms) = 'array'),
  interaction_rules jsonb not null default '[]'::jsonb
    check (jsonb_typeof(interaction_rules) = 'array'),
  dose_instructions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(dose_instructions) = 'object'),
  maximum_duration_days integer check (maximum_duration_days is null or maximum_duration_days > 0),
  referral_triggers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(referral_triggers) = 'array'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  storage_requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(storage_requirements) = 'object'),
  clinical_source_url text,
  clinical_source_version text,
  reviewer_name text,
  reviewer_role text,
  reviewed_at timestamptz,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_approval_requires_evidence check (
    review_status <> 'approved'
    or (
      clinical_source_url is not null
      and clinical_source_version is not null
      and reviewer_name is not null
      and reviewer_role is not null
      and reviewed_at is not null
    )
  )
);

create table if not exists public.symptom_pathways (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code),
  language_code text not null default 'en',
  code text not null,
  display_name text not null,
  description text,
  icon_name text,
  display_order integer not null default 100,
  enabled boolean not null default false,
  clinical_status text not null default 'draft'
    check (clinical_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  version integer not null default 1 check (version > 0),
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, language_code, code),
  constraint pathway_enable_requires_approval check (
    not enabled
    or (clinical_status = 'approved' and reviewer_name is not null and reviewed_at is not null)
  )
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid references public.symptom_pathways(id) on delete cascade,
  code text not null,
  language_code text not null default 'en',
  question_text text not null,
  help_text text,
  input_type text not null
    check (input_type in (
      'single_select', 'multi_select', 'boolean', 'number', 'text', 'date', 'confirmation'
    )),
  options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(options) = 'array'),
  validation_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation_rules) = 'object'),
  show_if jsonb not null default '{}'::jsonb
    check (jsonb_typeof(show_if) = 'object'),
  display_order integer not null default 100,
  required boolean not null default true,
  active boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pathway_id, language_code, code, version)
);

create table if not exists public.ui_messages (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code),
  language_code text not null default 'en',
  code text not null,
  message_text text not null,
  active boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, language_code, code, version)
);

create table if not exists public.clinical_rules (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid references public.symptom_pathways(id) on delete cascade,
  code text not null,
  name text not null,
  priority integer not null default 100,
  rule_type text not null
    check (rule_type in (
      'immediate_medical_care',
      'clinic_referral',
      'block_product',
      'request_information',
      'allow_product'
    )),
  conditions jsonb not null
    check (jsonb_typeof(conditions) = 'object'),
  action jsonb not null default '{}'::jsonb
    check (jsonb_typeof(action) = 'object'),
  user_message text,
  active boolean not null default false,
  clinical_status text not null default 'draft'
    check (clinical_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  source_url text,
  source_version text,
  reviewer_name text,
  reviewer_role text,
  reviewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pathway_id, code, version),
  constraint rule_enable_requires_approval check (
    not active
    or (
      clinical_status = 'approved'
      and source_url is not null
      and source_version is not null
      and reviewer_name is not null
      and reviewer_role is not null
      and reviewed_at is not null
    )
  )
);

create table if not exists public.product_pathways (
  product_id uuid not null references public.products(id) on delete cascade,
  pathway_id uuid not null references public.symptom_pathways(id) on delete cascade,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  display_priority integer not null default 100,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, pathway_id),
  constraint product_pathway_approval_has_reviewer check (
    approval_status <> 'approved'
    or (reviewer_name is not null and reviewed_at is not null)
  )
);

create table if not exists public.rule_products (
  rule_id uuid not null references public.clinical_rules(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  effect text not null check (effect in ('allow', 'block')),
  primary key (rule_id, product_id)
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_key text not null unique,
  country_code text not null references public.countries(code),
  language_code text not null default 'en',
  current_pathway_id uuid references public.symptom_pathways(id),
  status text not null default 'active'
    check (status in ('active', 'completed', 'referred', 'abandoned', 'expired')),
  channel text not null default 'kiosk'
    check (channel in ('kiosk', 'web', 'test')),
  ruleset_version text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  raw_answer jsonb not null,
  normalized_answer jsonb,
  answer_source text not null default 'touch'
    check (answer_source in ('touch', 'typed', 'voice', 'system')),
  created_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table if not exists public.chat_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'user_message', 'assistant_message', 'pathway_selected', 'question_shown',
      'answer_received', 'decision_created', 'system_error'
    )),
  content_text text,
  content_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content_json) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  pathway_id uuid references public.symptom_pathways(id),
  outcome text not null
    check (outcome in (
      'MORE_INFORMATION',
      'PRODUCT_ELIGIBLE',
      'NO_SUITABLE_PRODUCT',
      'CLINIC_REFERRAL',
      'IMMEDIATE_MEDICAL_CARE'
    )),
  user_message text not null,
  reason_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reason_codes) = 'array'),
  input_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_snapshot) = 'object'),
  response_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(response_snapshot) = 'object'),
  ruleset_version text not null,
  model_name text,
  model_prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_products (
  decision_id uuid not null references public.decisions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  result text not null check (result in ('eligible', 'blocked', 'not_selected')),
  rank integer check (rank is null or rank > 0),
  reason_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reason_codes) = 'array'),
  product_version integer not null,
  safety_version integer,
  primary key (decision_id, product_id)
);

create table if not exists public.decision_rule_results (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  rule_id uuid not null references public.clinical_rules(id),
  rule_version integer not null,
  matched boolean not null,
  result_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result_payload) = 'object'),
  evaluated_at timestamptz not null default now(),
  unique (decision_id, rule_id)
);

-- Prevent a product from being enabled without a separately approved safety record.
create or replace function public.enforce_product_safety_before_enable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.chatbot_enabled and not exists (
    select 1
    from public.product_safety ps
    where ps.product_id = new.id
      and ps.review_status = 'approved'
      and jsonb_array_length(ps.allowed_indications) > 0
      and ps.dose_instructions <> '{}'::jsonb
      and ps.clinical_source_url is not null
  ) then
    raise exception 'Product % cannot be enabled: complete approved product_safety data is missing', new.id;
  end if;
  if new.chatbot_enabled and not exists (
    select 1
    from public.product_pathways pp
    where pp.product_id = new.id
      and pp.approval_status = 'approved'
  ) then
    raise exception 'Product % cannot be enabled: approved product_pathways mapping is missing', new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_require_approved_safety on public.products;
create trigger products_require_approved_safety
before insert or update of chatbot_enabled on public.products
for each row execute function public.enforce_product_safety_before_enable();

-- Configuration-table updated_at triggers.
drop trigger if exists countries_set_updated_at on public.countries;
create trigger countries_set_updated_at before update on public.countries
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists product_safety_set_updated_at on public.product_safety;
create trigger product_safety_set_updated_at before update on public.product_safety
for each row execute function public.set_updated_at();

drop trigger if exists symptom_pathways_set_updated_at on public.symptom_pathways;
create trigger symptom_pathways_set_updated_at before update on public.symptom_pathways
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists ui_messages_set_updated_at on public.ui_messages;
create trigger ui_messages_set_updated_at before update on public.ui_messages
for each row execute function public.set_updated_at();

drop trigger if exists clinical_rules_set_updated_at on public.clinical_rules;
create trigger clinical_rules_set_updated_at before update on public.clinical_rules
for each row execute function public.set_updated_at();

drop trigger if exists product_pathways_set_updated_at on public.product_pathways;
create trigger product_pathways_set_updated_at before update on public.product_pathways
for each row execute function public.set_updated_at();

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at before update on public.chat_sessions
for each row execute function public.set_updated_at();

-- Common lookup indexes used by n8n.
create index if not exists products_catalog_lookup_idx
  on public.products (country_code, chatbot_enabled, market_status);
create index if not exists pathways_menu_lookup_idx
  on public.symptom_pathways (country_code, language_code, enabled, display_order);
create index if not exists questions_next_lookup_idx
  on public.questions (pathway_id, active, display_order);
create index if not exists clinical_rules_eval_lookup_idx
  on public.clinical_rules (pathway_id, active, priority);
create index if not exists sessions_status_idx
  on public.chat_sessions (status, created_at desc);
create index if not exists answers_session_idx
  on public.session_answers (session_id, created_at);
create index if not exists events_session_idx
  on public.chat_events (session_id, created_at);
create index if not exists decisions_session_idx
  on public.decisions (session_id, created_at desc);

-- n8n should query this view rather than the raw products table.
create or replace view public.recommendable_products
with (security_invoker = true)
as
select
  p.id,
  p.country_code,
  p.sku,
  p.barcode,
  p.product_name,
  p.brand_name,
  p.active_ingredients,
  p.strength_label,
  p.dosage_form,
  p.route,
  p.pack_size,
  p.manufacturer,
  p.label_url,
  p.label_version,
  p.version as product_version,
  ps.id as safety_id,
  ps.allowed_indications,
  ps.minimum_age_months,
  ps.maximum_age_years,
  ps.pregnancy_rule,
  ps.breastfeeding_rule,
  ps.contraindications,
  ps.allergy_terms,
  ps.interaction_rules,
  ps.dose_instructions,
  ps.maximum_duration_days,
  ps.referral_triggers,
  ps.warnings,
  ps.version as safety_version
from public.products p
join public.product_safety ps on ps.product_id = p.id
where p.chatbot_enabled = true
  and p.market_status = 'commercialised'
  and p.clinical_status = 'approved'
  and p.legal_status = 'approved'
  and ps.review_status = 'approved';

-- The kiosk is intentionally denied direct database access. Only n8n's
-- server-side service-role connection should read or write these objects.
alter table public.countries enable row level security;
alter table public.products enable row level security;
alter table public.product_safety enable row level security;
alter table public.symptom_pathways enable row level security;
alter table public.questions enable row level security;
alter table public.ui_messages enable row level security;
alter table public.clinical_rules enable row level security;
alter table public.product_pathways enable row level security;
alter table public.rule_products enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.session_answers enable row level security;
alter table public.chat_events enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_products enable row level security;
alter table public.decision_rule_results enable row level security;

revoke all on table
  public.countries,
  public.products,
  public.product_safety,
  public.symptom_pathways,
  public.questions,
  public.ui_messages,
  public.clinical_rules,
  public.product_pathways,
  public.rule_products,
  public.chat_sessions,
  public.session_answers,
  public.chat_events,
  public.decisions,
  public.decision_products,
  public.decision_rule_results,
  public.recommendable_products
from anon, authenticated;

grant select, insert, update, delete on table
  public.countries,
  public.products,
  public.product_safety,
  public.symptom_pathways,
  public.questions,
  public.ui_messages,
  public.clinical_rules,
  public.product_pathways,
  public.rule_products,
  public.chat_sessions,
  public.session_answers,
  public.chat_events,
  public.decisions,
  public.decision_products,
  public.decision_rule_results
to service_role;

grant select on table public.recommendable_products to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_product_safety_before_enable() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.enforce_product_safety_before_enable() to service_role;

commit;

