-- Anonymised decision log for the touchscreen assistant.
-- Run after migrations 000 through 006.
--
-- Today the workflow leaves no trace: chat_sessions, session_answers,
-- chat_events, decisions and decision_products all exist (migration 001) but
-- nothing writes to them, so a kiosk in the field cannot answer "how many
-- people were referred today" or "where do customers give up".
--
-- This table is deliberately narrow. It stores the shape of a decision, never
-- the content: no free-text allergy, medicine or condition terms, no exact
-- age (bands only), and no symptom text. session_key is the same opaque
-- identifier the browser already uses, which is enough to follow one customer
-- journey without identifying a person.
--
-- The existing decisions table is NOT reused: its outcome check constraint
-- lists five values and does not allow CATALOG_CHECK_REQUIRED, and its
-- input_snapshot / response_snapshot jsonb columns invite storing the whole
-- conversation, which is exactly what this table must not do.

begin;

create table if not exists public.kiosk_outcome_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- Opaque per-customer session key from the touchscreen. Not a person id.
  session_key text not null,

  country_code text not null default 'MA',
  language_code text not null default 'en',

  -- Coarse inputs, banded so the log cannot become a health record.
  pathway_code text not null default 'none',
  age_band text not null default 'unknown',
  duration_code text not null default 'unknown',
  severity text not null default 'unknown',

  -- Decision, reported as the engine produced it.
  outcome text not null,
  reasons text not null default '',
  turns integer not null default 0,
  elapsed_ms integer not null default 0,

  constraint kiosk_outcome_log_reasons_length_check
    check (char_length(reasons) <= 500),
  constraint kiosk_outcome_log_turns_range_check
    check (turns between 0 and 40),
  constraint kiosk_outcome_log_elapsed_range_check
    check (elapsed_ms between 0 and 86400000),
  constraint kiosk_outcome_log_age_band_check
    check (age_band in ('unknown', 'under_18', '18_30', '31_45', '46_65', 'over_65')),
  constraint kiosk_outcome_log_language_code_check
    check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint kiosk_outcome_log_country_code_check
    check (country_code ~ '^[A-Z]{2}$')
);

comment on table public.kiosk_outcome_log is
  'Anonymised outcome counters for the touchscreen assistant. No free-text medical history, no exact age. Read for a fixed window, then pruned.';

create index if not exists kiosk_outcome_log_created_at_idx
  on public.kiosk_outcome_log (created_at desc);

create index if not exists kiosk_outcome_log_outcome_time_idx
  on public.kiosk_outcome_log (outcome, created_at desc);

create index if not exists kiosk_outcome_log_pathway_time_idx
  on public.kiosk_outcome_log (pathway_code, created_at desc);

-- Same posture as every other table in this schema: RLS enabled, no policies,
-- so only service_role (the n8n Supabase credential) can read or write it.
alter table public.kiosk_outcome_log enable row level security;

revoke all on table public.kiosk_outcome_log from anon, authenticated;

grant select, insert on table public.kiosk_outcome_log to service_role;

-- The n8n workflow only inserts. Nothing in the workflow may delete, so
-- pruning is an operator action run from the SQL editor, or by a scheduled
-- workflow that uses this function.
create or replace function public.prune_kiosk_outcome_log(retention_days integer default 90)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  if retention_days is null or retention_days < 7 then
    raise exception 'retention_days must be at least 7';
  end if;

  delete from public.kiosk_outcome_log
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_kiosk_outcome_log(integer) is
  'Deletes outcome log rows older than retention_days (default 90). Returns the number of rows removed.';

revoke execute on function public.prune_kiosk_outcome_log(integer) from public, anon, authenticated;
grant execute on function public.prune_kiosk_outcome_log(integer) to service_role;

commit;

-- ui_messages (migration 001) is still unused: every screen string lives in
-- the engine and in web/i18n.js. It is left in place rather than dropped so a
-- later editor-driven copy pipeline can adopt it; nothing depends on it today.
