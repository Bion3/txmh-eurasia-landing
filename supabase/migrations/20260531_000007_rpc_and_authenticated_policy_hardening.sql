-- Harden RPC exposure and broad authenticated insert policies.
-- Public intake remains open only for lead capture; operational workflows require signed-in users.

alter function set_updated_at() set search_path = public, pg_temp;
alter function app_user_role() set search_path = public, pg_temp;
alter function app_is_role(text) set search_path = public, pg_temp;
alter function app_is_any_role(text[]) set search_path = public, pg_temp;
alter function app_score_lead(uuid) set search_path = public, pg_temp;
alter function app_schedule_follow_up_for_lead(uuid, text, integer) set search_path = public, pg_temp;
alter function app_bulk_schedule_lead_followups(integer) set search_path = public, pg_temp;

revoke execute on function app_next_doc_no(text) from public, anon;
revoke execute on function app_convert_lead_to_customer(uuid, uuid, boolean) from public, anon;
revoke execute on function app_convert_quote_to_order(uuid, uuid, uuid, text) from public, anon;
revoke execute on function app_generate_receivable_for_order(uuid, date) from public, anon;
revoke execute on function app_generate_payables_for_order(uuid, date) from public, anon;
revoke execute on function app_score_lead(uuid) from public, anon;
revoke execute on function app_schedule_follow_up_for_lead(uuid, text, integer) from public, anon;
revoke execute on function app_bulk_schedule_lead_followups(integer) from public, anon;

grant execute on function app_next_doc_no(text) to authenticated, service_role;
grant execute on function app_convert_lead_to_customer(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function app_convert_quote_to_order(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function app_generate_receivable_for_order(uuid, date) to authenticated, service_role;
grant execute on function app_generate_payables_for_order(uuid, date) to authenticated, service_role;
grant execute on function app_score_lead(uuid) to authenticated, service_role;
grant execute on function app_schedule_follow_up_for_lead(uuid, text, integer) to authenticated, service_role;
grant execute on function app_bulk_schedule_lead_followups(integer) to authenticated, service_role;

drop policy if exists customers_insert_policy on customers;
create policy customers_insert_policy
on customers
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'sales', 'marketing'])
  or owner_id = auth.uid()
  or owner_id is null
);

drop policy if exists quotes_insert_policy on quotes;
create policy quotes_insert_policy
on quotes
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'sales'])
  or created_by = auth.uid()
  or created_by is null
);
