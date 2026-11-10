-- 010 - catalogue data-integrity guard
--
-- Why: the live demo catalogue proved that approval flags alone are not enough
-- to keep placeholder data out of the product path. This migration gives every
-- row an explicit origin, blocks fixtures, requires the fields the matcher
-- depends on, and makes the demo sandbox impossible to mistake for a reviewed
-- catalogue outside ZZ.
--
-- Safe to re-run. No product, dose or warning text is invented here; only
-- provenance metadata and placeholder terms already present are touched.
--
-- Apply with the Supabase SQL editor (or any role that can alter tables), then
-- run the verification block at the bottom.

begin;

-- ---------------------------------------------------------------------------
-- 1. Provenance columns
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists data_origin text not null default 'imported';
alter table public.products
  add column if not exists is_fixture boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_data_origin_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_data_origin_check
      check (data_origin in ('reviewed', 'imported', 'synthetic'));
  end if;
end
$$;

-- Existing data: every ZZ row is the demo sandbox; anything else was imported.
update public.products
set data_origin = 'synthetic'
where country_code = 'ZZ'
  and data_origin <> 'synthetic';

update public.products
set data_origin = 'imported'
where country_code <> 'ZZ'
  and data_origin = 'reviewed'
  and sku like 'MA-%';

update public.products
set is_fixture = true
where sku ~* '(^|[-_])(fixture|test)([-_]|$)'
   or product_name ~* 'test fixture';

-- The automated fixture must never be reachable again.
update public.products
set chatbot_enabled = false
where is_fixture;

-- Enabled rows whose only leaflet link cannot resolve are not honest products.
update public.products
set chatbot_enabled = false
where chatbot_enabled
  and label_url ~* 'example\.invalid';

-- ---------------------------------------------------------------------------
-- 2. Remove placeholder matching terms from existing rows
-- ---------------------------------------------------------------------------

update public.product_safety ps
set allergy_terms = coalesce((
  select jsonb_agg(term)
  from jsonb_array_elements_text(ps.allergy_terms) as t(term)
  where term !~* '(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)'
), '[]'::jsonb)
where ps.allergy_terms::text ~* '(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)';

update public.product_safety ps
set contraindications = coalesce((
  select jsonb_agg(term)
  from jsonb_array_elements_text(ps.contraindications) as t(term)
  where term !~* '(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)'
), '[]'::jsonb)
where ps.contraindications::text ~* '(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)';

update public.product_safety ps
set interaction_rules = coalesce((
  select jsonb_agg(term)
  from jsonb_array_elements_text(ps.interaction_rules) as t(term)
  where term !~* '(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)'
), '[]'::jsonb)
where ps.interaction_rules::text ~* '(^|[^a-z])(demo|test|example|placeholder|synthetic)([^a-z]|$)';

-- ---------------------------------------------------------------------------
-- 3. Enable guard: fixtures, sandbox origin, reviewer and matcher fields
-- ---------------------------------------------------------------------------

create or replace function public.enforce_product_safety_before_enable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  safety public.product_safety%rowtype;
  demo_sandbox boolean;
begin
  if not new.chatbot_enabled then
    return new;
  end if;

  if new.is_fixture then
    raise exception 'Product % cannot be enabled: automated test fixtures are never customer-reachable', new.sku;
  end if;

  demo_sandbox := new.data_origin = 'synthetic' and new.country_code = 'ZZ';

  if new.data_origin = 'synthetic' and not demo_sandbox then
    raise exception 'Product % cannot be enabled: synthetic data is restricted to the ZZ sandbox', new.sku;
  end if;

  select * into safety
  from public.product_safety ps
  where ps.product_id = new.id;

  if not found then
    raise exception 'Product % cannot be enabled: product_safety is missing', new.sku;
  end if;

  if safety.review_status <> 'approved' then
    raise exception 'Product % cannot be enabled: safety review_status is %', new.sku, safety.review_status;
  end if;

  if jsonb_array_length(safety.allowed_indications) = 0
     or safety.dose_instructions = '{}'::jsonb
     or safety.clinical_source_url is null
     or safety.clinical_source_version is null
     or safety.maximum_duration_days is null then
    raise exception 'Product % cannot be enabled: approved indications, dose, source and maximum_duration_days are required', new.sku;
  end if;

  if not demo_sandbox then
    if safety.reviewer_name is null or safety.reviewer_name = ''
       or safety.reviewer_name ~* '(synthetic|demo|test|placeholder)'
       or safety.reviewer_role is null or safety.reviewer_role = ''
       or safety.reviewed_at is null then
      raise exception 'Product % cannot be enabled: a named reviewer and review date are required outside the ZZ sandbox', new.sku;
    end if;

    if new.label_url is null or new.label_url ~* 'example\.invalid'
       or safety.clinical_source_url ~* 'example\.invalid' then
      raise exception 'Product % cannot be enabled: a reachable leaflet and source URL are required', new.sku;
    end if;

    if (safety.allergy_terms::text || safety.contraindications::text || safety.interaction_rules::text)
         ~* '"(demo|test|example|placeholder|synthetic)[^"]*"' then
      raise exception 'Product % cannot be enabled: placeholder matching terms are present', new.sku;
    end if;
  end if;

  if not exists (
    select 1
    from public.product_pathways pp
    where pp.product_id = new.id
      and pp.approval_status = 'approved'
  ) then
    raise exception 'Product % cannot be enabled: approved product_pathways mapping is missing', new.sku;
  end if;

  return new;
end;
$$;

drop trigger if exists products_require_approved_safety on public.products;
create trigger products_require_approved_safety
before insert or update of chatbot_enabled on public.products
for each row execute function public.enforce_product_safety_before_enable();

-- ---------------------------------------------------------------------------
-- 4. Matcher view: expose provenance and never return a fixture
-- ---------------------------------------------------------------------------

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
  ps.version as safety_version,
  p.data_origin,
  p.is_fixture,
  ps.reviewer_name,
  ps.reviewer_role
from public.products p
join public.product_safety ps on ps.product_id = p.id
where p.chatbot_enabled = true
  and not p.is_fixture
  and (p.data_origin <> 'synthetic' or p.country_code = 'ZZ')
  and p.market_status = 'commercialised'
  and p.clinical_status = 'approved'
  and p.legal_status = 'approved'
  and ps.review_status = 'approved';

revoke all on table public.recommendable_products from anon, authenticated;
grant select on table public.recommendable_products to service_role;

-- `recommendable_product_pathways` selects rp.*, so the new provenance columns
-- flow through automatically. Recreate it to be explicit about that contract.
create or replace view public.recommendable_product_pathways
with (security_invoker = true)
as
select
  rp.*,
  pp.pathway_id,
  sp.code as pathway_code,
  sp.language_code,
  pp.display_priority
from public.recommendable_products rp
join public.product_pathways pp
  on pp.product_id = rp.id
 and pp.approval_status = 'approved'
join public.symptom_pathways sp
  on sp.id = pp.pathway_id
 and sp.enabled = true
 and sp.clinical_status = 'approved';

revoke all on table public.recommendable_product_pathways from anon, authenticated;
grant select on table public.recommendable_product_pathways to service_role;

-- ---------------------------------------------------------------------------
-- 5. Readiness view for operators and the audit script
-- ---------------------------------------------------------------------------

create or replace view public.catalogue_readiness
with (security_invoker = true)
as
select
  p.id,
  p.country_code,
  p.sku,
  p.product_name,
  p.data_origin,
  p.is_fixture,
  p.chatbot_enabled,
  ps.reviewer_name,
  ps.reviewer_role,
  ps.reviewed_at,
  ps.maximum_duration_days,
  ps.clinical_source_url,
  p.label_url,
  (p.data_origin = 'synthetic' and p.country_code = 'ZZ') as demo_sandbox,
  (p.sku ~* '(^|[-_])(fixture|test)([-_]|$)' or p.product_name ~* 'test fixture') as fixture_like,
  (coalesce(ps.reviewer_name, '') ~* '(synthetic|demo|test|placeholder)') as reviewer_is_placeholder,
  (coalesce(p.label_url, '') ~* 'example\.invalid'
    or coalesce(ps.clinical_source_url, '') ~* 'example\.invalid') as has_unreachable_url,
  (ps.maximum_duration_days is null) as missing_max_duration,
  ((ps.allergy_terms::text || ps.contraindications::text || ps.interaction_rules::text)
    ~* '"(demo|test|example|placeholder|synthetic)[^"]*"') as has_placeholder_terms
from public.products p
left join public.product_safety ps on ps.product_id = p.id
where p.chatbot_enabled;

revoke all on table public.catalogue_readiness from anon, authenticated;
grant select on table public.catalogue_readiness to service_role;

commit;

-- ---------------------------------------------------------------------------
-- 6. Verification: raises if an enabled row is still unsafe
-- ---------------------------------------------------------------------------

do $$
declare
  bad text;
begin
  select string_agg(sku, ', ') into bad
  from public.catalogue_readiness
  where not demo_sandbox
    and (
      fixture_like
      or reviewer_is_placeholder
      or has_unreachable_url
      or missing_max_duration
      or has_placeholder_terms
      or data_origin = 'synthetic'
    );

  if bad is not null then
    raise exception 'Catalogue guard verification failed for: %', bad;
  end if;
end
$$;
