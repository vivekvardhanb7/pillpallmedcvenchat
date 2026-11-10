-- Germany-first catalogue contract. No medicine or pathway is enabled here.
-- Run after 010; validate in staging before deployment.
begin;
insert into public.countries (code, name, default_language_code, currency_code, active)
values ('DE', 'Germany', 'de', 'EUR', true)
on conflict (code) do update set default_language_code = 'de', currency_code = 'EUR';
-- rp.* gains fields, so the dependent view must be rebuilt rather than replaced
-- with a changed column order. No table data is removed.
drop view if exists public.recommendable_product_pathways;
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
  ps.reviewer_role,
  p.chatbot_enabled,
  p.market_status,
  p.clinical_status,
  p.legal_status,
  ps.review_status,
  ps.reviewed_at,
  ps.clinical_source_url
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
  pp.display_priority,
  pp.approval_status as pathway_approval_status
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


commit;
