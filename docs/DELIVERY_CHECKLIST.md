# Delivery Checklist

This checklist is for handing over the logistics system MVP: acquisition, customer management, quote calculation, order operations, and finance settlement.

## 1. Local Verification

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Optionally set `SUPABASE_SMOKE_EMAIL` and `SUPABASE_SMOKE_PASSWORD` for authenticated database checks.
5. Run `npm run check:core` for the full local readiness suite: system coverage, cross-module business flow, acquisition routes, AI support, self-service order, quote pricing, order lifecycle, customer health, supplier health, finance aging, delivery gate, and production build.
6. Run `npm run check:release` for release readiness: local core checks plus Supabase schema and public API checks. If the current network cannot reach Supabase, remote checks are reported as warnings rather than confused with schema failures.
7. Run `npm run check:release:strict` from a network that can resolve the Supabase project when remote Supabase success must be mandatory.
8. Run `npm run check:release:write` only when you intentionally want to verify anonymous public intake writes by creating a cleanup-safe `ANON-CHECK-*` lead.
9. Run `npm run check:delivery:build` when you specifically want the delivery checker to own the build step.
10. Verify the main route entry points: `/`, `/quote`, `/order`, `/system/overview`, `/system/leads`, `/system/customers`, `/system/quotes`, `/system/cost-center`, `/system/orders`, and `/system/finance`.
11. Verify public acquisition: the home page quick inquiry and `/quote` public quote form submit leads, preserve UTM/referrer/landing attribution, link matched campaign/source IDs, and pass `npm run check:supabase:write`.
12. Run `npm run check:supabase:schema` after applying the database SQL to verify every required table and protected table surface exists.
13. Run `npm run check:supabase` to verify public Data API access.
14. Run `npm run build:supabase:sql` if you need a single SQL file for Supabase SQL Editor deployment.
15. Optional CLI deploy: set `SUPABASE_DB_PASSWORD` temporarily and run `npm run deploy:supabase`.

## 2. Supabase Database Setup

Run SQL files in this order:

1. `supabase/migrations/20260527_000000_legacy_schema_backup.sql`
2. `supabase/migrations/20260527_000001_mvp_logistics_system.sql`
3. `supabase/migrations/20260527_000002_mvp_rpc_workflows.sql`
4. `supabase/migrations/20260528_000003_mvp_rls_policies.sql`
5. `supabase/migrations/20260528105246_harden_rls_roles_and_api_grants.sql`
6. `supabase/migrations/20260530_000004_order_detail_operational_tables.sql`
7. `supabase/migrations/20260531_000005_lead_scoring_and_followups.sql`
8. `supabase/migrations/20260531_000006_public_intake_security_hardening.sql`
9. `supabase/migrations/20260531_000007_rpc_and_authenticated_policy_hardening.sql`
10. `supabase/migrations/20260601_000008_email_task_update_policy.sql`
11. `supabase/migrations/20260602021157_transactional_payment_rpc.sql`
12. `supabase/migrations/20260602041708_pricing_recalculation_rpc.sql`
13. `supabase/migrations/20260602062921_order_status_update_rpc.sql`
14. `supabase/migrations/20260602063911_order_task_rpc_and_list_view.sql`
15. `supabase/migrations/20260602073915_dashboard_summary_rpc.sql`
16. `supabase/migrations/20260602075118_auto_lead_followup_trigger.sql`
17. `supabase/seed.sql`
18. `supabase/smoke_test.sql`

The first migration removes incompatible old demo `leads` and `shipments` tables when they use integer IDs or miss required MVP columns. Current project schema takes priority.

The smoke test opens a transaction and rolls it back, so it should validate the workflow without leaving test records.

After this SQL smoke test passes, run `npm run check:supabase:schema` from the project to verify the deployed schema matches the app. Then run `npm run check:supabase` to verify the frontend anon key can access the expected Data API surface. Run `npm run check:supabase:write` only when you want to verify anonymous lead intake by creating a cleanup-safe `ANON-CHECK-*` lead.

Current remote status: the Supabase project `hcorkkudgicarsmexnqf` has been deployed with the current schema, seed data, public intake hardening, and RPC permission hardening. Schema, public Data API, and anonymous lead-intake checks have passed.

For manual SQL Editor deployment, run `npm run build:supabase:sql` and execute `supabase/deploy_bundle.sql`, then execute `supabase/smoke_test.sql` separately.

For CLI deployment, use the linked Supabase project:

```bash
SUPABASE_DB_PASSWORD='your_database_password' npm run deploy:supabase
```

This executes the generated `supabase/deploy_bundle.sql` through `supabase db query --linked`. The password is not stored by the project.

## 3. Auth And Roles

Create the first internal users in Supabase Auth, then assign role metadata according to the operating team. Use `app_metadata.role` or `app_metadata.app_role`; do not authorize from user-editable `user_metadata`.

Supported role values:

- `sales`
- `ops`
- `finance`
- `marketing`
- `manager`
- `admin`

The frontend sign-up form records a `requested_role` of `sales`. Actual access is assigned from the Supabase admin side through app metadata.

## 4. Business Flow Test

Check the system page from left to right:

1. Acquisition: create or open a lead, refresh score/next-best-action, and generate a second-touch email task.
2. Customer: convert the lead to a customer, then confirm contacts are visible.
3. Quote: create a quote with rail, sea, air, FCL, or LCL line items.
4. Order: convert the quote to an order and confirm booking/order details.
5. Order detail: confirm task flow, shipper/consignee/notify parties, cargo, service segment, documents, and finance line tabs can load.
6. Finance: generate receivable and payable records, add cost lines, and record settlement payments.

## 5. Finance Readiness

Before production finance use, confirm these items with the finance owner:

- default tax rules and invoice naming
- settlement currency and FX source
- receivable due-date policy
- payable due-date policy
- cost approval workflow
- write-off, discount, and bad-debt handling
- export format for accounting software

## 6. Production Notes

The current frontend can talk directly to Supabase when environment variables are configured. For stricter production control, add Supabase Edge Functions or backend routes around sensitive workflows such as price approval, finance posting, and role management.
