-- Read-only catalogue view used by the n8n Product Matcher.
-- Run after migrations 000 through 003.

begin;

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

commit;

