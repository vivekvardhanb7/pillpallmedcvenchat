-- Reset every Morocco research product to the safe, disabled state.
-- Run after migrations 000 through 005.
--
-- The research seed (002) inserts real brand names as draft, disabled records
-- without leaflets or dose instructions. Any later manual edit that enabled or
-- approved one of them (or added a label_url / dose text for testing) is
-- reverted here, so no real medicine can be recommended until it passes full
-- clinical and legal review. The isolated ZZ test fixture is untouched.

begin;

update public.products
set
  chatbot_enabled = false,
  clinical_status = 'draft',
  legal_status = 'draft',
  label_url = null,
  label_version = null
where country_code = 'MA';

commit;

-- Expected: zero rows. Any row listed here can still reach the kiosk.
select p.country_code, p.sku, p.product_name, p.clinical_status, p.legal_status, p.chatbot_enabled
from public.products p
where p.country_code = 'MA'
  and (p.chatbot_enabled or p.clinical_status <> 'draft' or p.legal_status <> 'draft' or p.label_url is not null);
