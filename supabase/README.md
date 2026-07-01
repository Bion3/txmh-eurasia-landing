# Supabase Database

This directory now contains the first MVP database migration for the logistics system.

## Included domains

- lead acquisition
- lead scoring and second-touch follow-up automation
- CRM customers and contacts
- pricing and quotes
- orders and milestones
- order detail operations, parties, cargo, documents, tasks, and finance lines
- cost capture and settlement
- receivables, payables, payments
- email follow-up tasks

## Suggested rollout

1. Create a Supabase project.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your local env.
3. Run the migration with the Supabase CLI or paste the SQL into the Supabase SQL editor.

## First migration

- `migrations/20260527_000001_mvp_logistics_system.sql`
- `migrations/20260527_000000_legacy_schema_backup.sql`
- `migrations/20260527_000002_mvp_rpc_workflows.sql`
- `migrations/20260528_000003_mvp_rls_policies.sql`
- `migrations/20260528105246_harden_rls_roles_and_api_grants.sql`
- `migrations/20260530_000004_order_detail_operational_tables.sql`
- `migrations/20260531_000005_lead_scoring_and_followups.sql`
- `migrations/20260531_000006_public_intake_security_hardening.sql`
- `migrations/20260531_000007_rpc_and_authenticated_policy_hardening.sql`

## Seed data

- `seed.sql`
- `smoke_test.sql`

This seed file includes:

- lead sources
- sample campaigns
- vendors
- email templates
- base rail / sea / air rate sheets
- starter pricing line items

## Apply order

1. run the legacy schema cleanup migration
2. run the main MVP schema migration
3. run the RPC migration
4. run the RLS migration
5. run the RLS/API grants hardening migration
6. run the order detail operational tables migration
7. run the lead scoring and follow-up automation migration
8. run the public intake security hardening migration
9. run the RPC and authenticated policy hardening migration
10. run `seed.sql`
11. run `smoke_test.sql` to validate the deployed schema and RPC flow
12. run `npm run check:supabase:schema` from the project root to verify all required tables and columns are deployed
13. run `npm run check:supabase` from the project root to verify Data API access with the frontend anon key
14. run `npm run check:supabase:write` to verify anonymous website lead intake

## SQL Editor bundle

Run `npm run build:supabase:sql` from the project root to generate `supabase/deploy_bundle.sql`. The bundle includes migrations and seed data in the correct order, but excludes `smoke_test.sql` so smoke validation can run separately and roll back cleanly.

Current deployed project `hcorkkudgicarsmexnqf` has the MVP schema, seed data, public lead intake, and RPC permission hardening applied.

## RPC functions included

- `app_next_doc_no(prefix text)`
- `app_convert_lead_to_customer(lead_id, owner_id, create_primary_contact)`
- `app_convert_quote_to_order(quote_id, sales_owner_id, ops_owner_id, booking_no)`
- `app_generate_receivable_for_order(order_id, due_date)`
- `app_generate_payables_for_order(order_id, due_date)`
- `app_score_lead(lead_id)`
- `app_schedule_follow_up_for_lead(lead_id, template_code, delay_hours)`
- `app_bulk_schedule_lead_followups(limit)`

## Next recommended steps

1. add server actions or edge functions for quote conversion and finance posting
2. add live Supabase RPC or edge workflows for settlement posting
3. align JWT role claims with the deployed auth model
