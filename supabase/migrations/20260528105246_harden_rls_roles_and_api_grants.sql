-- Hardening pass for Supabase Data API access and role-based authorization.
-- User-editable user_metadata must not drive RLS; roles should live in auth.users.raw_app_meta_data.

create or replace function app_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'app_role',
    'anon'
  );
$$;

revoke execute on function app_user_role() from public;
revoke execute on function app_is_role(text) from public;
revoke execute on function app_is_any_role(text[]) from public;
grant execute on function app_user_role() to anon, authenticated, service_role;
grant execute on function app_is_role(text) to anon, authenticated, service_role;
grant execute on function app_is_any_role(text[]) to anon, authenticated, service_role;

revoke execute on function app_next_doc_no(text) from public;
revoke execute on function app_convert_lead_to_customer(uuid, uuid, boolean) from public;
revoke execute on function app_convert_quote_to_order(uuid, uuid, uuid, text) from public;
revoke execute on function app_generate_receivable_for_order(uuid, date) from public;
revoke execute on function app_generate_payables_for_order(uuid, date) from public;

grant execute on function app_next_doc_no(text) to authenticated, service_role;
grant execute on function app_convert_lead_to_customer(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function app_convert_quote_to_order(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function app_generate_receivable_for_order(uuid, date) to authenticated, service_role;
grant execute on function app_generate_payables_for_order(uuid, date) to authenticated, service_role;

grant usage on schema public to anon, authenticated;

grant select on
  lead_sources,
  campaigns
to anon, authenticated;

grant insert on
  website_visits,
  leads
to anon;

grant select, insert, update on
  website_visits,
  leads,
  customers,
  contacts,
  activities,
  quotes,
  quote_items,
  quote_cost_snapshots,
  orders,
  shipments,
  shipment_milestones,
  order_costs,
  order_revenues,
  receivables,
  payables,
  payments,
  email_tasks
to authenticated;

grant select on
  vendors,
  rate_sheets,
  rate_sheet_items,
  fx_rates,
  email_templates
to authenticated;

grant insert, update on
  vendors,
  rate_sheets,
  rate_sheet_items,
  email_templates
to authenticated;

alter table lead_sources enable row level security;
alter table campaigns enable row level security;
alter table website_visits enable row level security;
alter table vendors enable row level security;
alter table quote_cost_snapshots enable row level security;
alter table shipments enable row level security;
alter table shipment_milestones enable row level security;
alter table fx_rates enable row level security;

drop policy if exists lead_sources_select_policy on lead_sources;
create policy lead_sources_select_policy
on lead_sources
for select
to anon, authenticated
using (true);

drop policy if exists campaigns_select_policy on campaigns;
create policy campaigns_select_policy
on campaigns
for select
to anon, authenticated
using (status = 'active' or app_is_any_role(array['admin', 'manager', 'marketing']));

drop policy if exists website_visits_insert_policy on website_visits;
create policy website_visits_insert_policy
on website_visits
for insert
to anon, authenticated
with check (true);

drop policy if exists website_visits_select_policy on website_visits;
create policy website_visits_select_policy
on website_visits
for select
to authenticated
using (app_is_any_role(array['admin', 'manager', 'marketing']));

drop policy if exists vendors_select_policy on vendors;
create policy vendors_select_policy
on vendors
for select
to authenticated
using (app_is_any_role(array['admin', 'manager', 'ops', 'finance']));

drop policy if exists vendors_insert_policy on vendors;
create policy vendors_insert_policy
on vendors
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'ops']));

drop policy if exists vendors_update_policy on vendors;
create policy vendors_update_policy
on vendors
for update
to authenticated
using (app_is_any_role(array['admin', 'manager', 'ops']))
with check (app_is_any_role(array['admin', 'manager', 'ops']));

drop policy if exists quote_cost_snapshots_select_policy on quote_cost_snapshots;
create policy quote_cost_snapshots_select_policy
on quote_cost_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from quotes
    where quotes.id = quote_cost_snapshots.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_cost_snapshots_insert_policy on quote_cost_snapshots;
create policy quote_cost_snapshots_insert_policy
on quote_cost_snapshots
for insert
to authenticated
with check (
  exists (
    select 1
    from quotes
    where quotes.id = quote_cost_snapshots.quote_id
      and (
        app_is_any_role(array['admin', 'manager'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists shipments_select_policy on shipments;
create policy shipments_select_policy
on shipments
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or exists (
    select 1
    from orders
    where orders.id = shipments.order_id
      and orders.sales_owner_id = auth.uid()
  )
);

drop policy if exists shipments_insert_policy on shipments;
create policy shipments_insert_policy
on shipments
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'ops']));

drop policy if exists shipments_update_policy on shipments;
create policy shipments_update_policy
on shipments
for update
to authenticated
using (app_is_any_role(array['admin', 'manager', 'ops']))
with check (app_is_any_role(array['admin', 'manager', 'ops']));

drop policy if exists shipment_milestones_select_policy on shipment_milestones;
create policy shipment_milestones_select_policy
on shipment_milestones
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or exists (
    select 1
    from shipments
    join orders on orders.id = shipments.order_id
    where shipments.id = shipment_milestones.shipment_id
      and orders.sales_owner_id = auth.uid()
  )
);

drop policy if exists shipment_milestones_insert_policy on shipment_milestones;
create policy shipment_milestones_insert_policy
on shipment_milestones
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'ops']));

drop policy if exists shipment_milestones_update_policy on shipment_milestones;
create policy shipment_milestones_update_policy
on shipment_milestones
for update
to authenticated
using (app_is_any_role(array['admin', 'manager', 'ops']))
with check (app_is_any_role(array['admin', 'manager', 'ops']));

drop policy if exists fx_rates_select_policy on fx_rates;
create policy fx_rates_select_policy
on fx_rates
for select
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance', 'ops', 'sales']));

drop policy if exists fx_rates_insert_policy on fx_rates;
create policy fx_rates_insert_policy
on fx_rates
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'finance']));
