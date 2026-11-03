# Supabase setup

Run the SQL files in this order in **Supabase Dashboard → SQL Editor**:

1. `migrations/000_catalog_prerequisites.sql`
2. `migrations/001_medical_chatbot_schema.sql`
3. `migrations/002_research_seed.sql`
4. `migrations/003_inactive_question_templates.sql`
5. `migrations/004_n8n_catalog_api.sql`
6. `migrations/005_product_path_test_fixture.sql` (optional, test only)

`000_catalog_prerequisites.sql` is an explicit bootstrap/recovery step. Its final
result must show `public.countries` and `public.products`. When using the SQL
Editor, clear any text selection before clicking **Run** so the complete file is
executed rather than only the selected statement.

The seed creates four research candidates and seven English symptom categories.
Everything is disabled by design. The third migration adds general intake
question templates, but it does not add pathway-specific clinical warning-sign
rules. A product cannot be enabled until its market, clinical, legal, label and
product-safety information is approved.

Migration 005 is optional and test-only. It creates a synthetic product in the
reserved country `ZZ`, not a medicine and not an approval. It leaves every `MA`
record disabled and is used by `npm run test:product-path` to exercise
`PRODUCT_ELIGIBLE` and the safety-blocking path. Remove it by running the
teardown comments at the end of the migration.

## Connection rule

The touchscreen must call an n8n webhook. Store the Supabase service-role key in
n8n credentials only; never put it in the browser or kiosk application.

## Recommended n8n queries

Use the Supabase/Postgres node to perform these operations:

```sql
-- Starting menu. This returns nothing until reviewed pathways are enabled.
select id, code, display_name, description, icon_name
from public.symptom_pathways
where country_code = $1
  and language_code = $2
  and enabled = true
  and clinical_status = 'approved'
order by display_order;
```

```sql
-- Next-question candidates. n8n must evaluate show_if against session answers.
select id, code, question_text, help_text, input_type, options,
       validation_rules, show_if, required
from public.questions
where pathway_id = $1
  and language_code = $2
  and active = true
order by display_order;
```

```sql
-- Rules must be evaluated in this order. Stop immediately for an urgent or
-- clinic-referral match before considering a product.
select id, code, name, priority, rule_type, conditions, action,
       user_message, version
from public.clinical_rules
where pathway_id = $1
  and active = true
  and clinical_status = 'approved'
order by priority, code;
```

```sql
-- Only approved and enabled products can appear here.
select rp.*, pp.display_priority
from public.recommendable_products rp
join public.product_pathways pp on pp.product_id = rp.id
where pp.pathway_id = $1
  and pp.approval_status = 'approved'
order by pp.display_priority, rp.product_name;
```

## Enabling a product

Do not enable a product by changing only `chatbot_enabled`. The safe sequence is:

1. Complete its exact local label and sale information.
2. Add a complete `product_safety` record.
3. Have the safety record clinically reviewed and mark it `approved`.
4. Approve its `product_pathways` mapping.
5. Set product `clinical_status` and `legal_status` to `approved`.
6. Set `chatbot_enabled = true` last.

The database constraint and trigger reject premature enabling.
