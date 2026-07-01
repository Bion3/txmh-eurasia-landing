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

create or replace function app_is_role(role_name text)
returns boolean
language sql
stable
as $$
  select app_user_role() = role_name;
$$;

create or replace function app_is_any_role(roles text[])
returns boolean
language sql
stable
as $$
  select app_user_role() = any(roles);
$$;

grant execute on function app_user_role() to anon, authenticated, service_role;
grant execute on function app_is_role(text) to anon, authenticated, service_role;
grant execute on function app_is_any_role(text[]) to anon, authenticated, service_role;

alter table leads enable row level security;
alter table customers enable row level security;
alter table contacts enable row level security;
alter table activities enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table orders enable row level security;
alter table order_costs enable row level security;
alter table order_revenues enable row level security;
alter table receivables enable row level security;
alter table payables enable row level security;
alter table payments enable row level security;
alter table email_tasks enable row level security;
alter table email_templates enable row level security;
alter table rate_sheets enable row level security;
alter table rate_sheet_items enable row level security;

drop policy if exists leads_select_policy on leads;
create policy leads_select_policy
on leads
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance', 'marketing'])
  or assigned_to = auth.uid()
);

drop policy if exists leads_insert_policy on leads;
create policy leads_insert_policy
on leads
for insert
to anon, authenticated
with check (true);

drop policy if exists leads_update_policy on leads;
create policy leads_update_policy
on leads
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or assigned_to = auth.uid()
)
with check (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or assigned_to = auth.uid()
);

drop policy if exists customers_select_policy on customers;
create policy customers_select_policy
on customers
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or owner_id = auth.uid()
);

drop policy if exists customers_insert_policy on customers;
create policy customers_insert_policy
on customers
for insert
to authenticated
with check (true);

drop policy if exists customers_update_policy on customers;
create policy customers_update_policy
on customers
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager'])
  or owner_id = auth.uid()
)
with check (
  app_is_any_role(array['admin', 'manager'])
  or owner_id = auth.uid()
);

drop policy if exists contacts_select_policy on contacts;
create policy contacts_select_policy
on contacts
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or exists (
    select 1
    from customers
    where customers.id = contacts.customer_id
      and customers.owner_id = auth.uid()
  )
);

drop policy if exists contacts_insert_policy on contacts;
create policy contacts_insert_policy
on contacts
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager'])
  or exists (
    select 1
    from customers
    where customers.id = contacts.customer_id
      and customers.owner_id = auth.uid()
  )
);

drop policy if exists contacts_update_policy on contacts;
create policy contacts_update_policy
on contacts
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager'])
  or exists (
    select 1
    from customers
    where customers.id = contacts.customer_id
      and customers.owner_id = auth.uid()
  )
)
with check (
  app_is_any_role(array['admin', 'manager'])
  or exists (
    select 1
    from customers
    where customers.id = contacts.customer_id
      and customers.owner_id = auth.uid()
  )
);

drop policy if exists activities_select_policy on activities;
create policy activities_select_policy
on activities
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or owner_id = auth.uid()
);

drop policy if exists activities_insert_policy on activities;
create policy activities_insert_policy
on activities
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or owner_id = auth.uid()
);

drop policy if exists activities_update_policy on activities;
create policy activities_update_policy
on activities
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager'])
  or owner_id = auth.uid()
)
with check (
  app_is_any_role(array['admin', 'manager'])
  or owner_id = auth.uid()
);

drop policy if exists quotes_select_policy on quotes;
create policy quotes_select_policy
on quotes
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or app_is_role('sales')
  or created_by = auth.uid()
);

drop policy if exists quotes_insert_policy on quotes;
create policy quotes_insert_policy
on quotes
for insert
to authenticated
with check (true);

drop policy if exists quotes_update_policy on quotes;
create policy quotes_update_policy
on quotes
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager'])
  or app_is_role('sales')
  or created_by = auth.uid()
)
with check (
  app_is_any_role(array['admin', 'manager'])
  or app_is_role('sales')
  or created_by = auth.uid()
);

drop policy if exists quote_items_select_policy on quote_items;
create policy quote_items_select_policy
on quote_items
for select
to authenticated
using (
  exists (
    select 1
    from quotes
    where quotes.id = quote_items.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_items_insert_policy on quote_items;
create policy quote_items_insert_policy
on quote_items
for insert
to authenticated
with check (
  exists (
    select 1
    from quotes
    where quotes.id = quote_items.quote_id
      and (
        app_is_any_role(array['admin', 'manager'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists orders_select_policy on orders;
create policy orders_select_policy
on orders
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
  or sales_owner_id = auth.uid()
);

drop policy if exists orders_insert_policy on orders;
create policy orders_insert_policy
on orders
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'ops'])
  or sales_owner_id = auth.uid()
);

drop policy if exists orders_update_policy on orders;
create policy orders_update_policy
on orders
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops'])
  or sales_owner_id = auth.uid()
)
with check (
  app_is_any_role(array['admin', 'manager', 'ops'])
  or sales_owner_id = auth.uid()
);

drop policy if exists order_costs_select_policy on order_costs;
create policy order_costs_select_policy
on order_costs
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
);

drop policy if exists order_costs_insert_policy on order_costs;
create policy order_costs_insert_policy
on order_costs
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
);

drop policy if exists order_costs_update_policy on order_costs;
create policy order_costs_update_policy
on order_costs
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
)
with check (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
);

drop policy if exists order_revenues_select_policy on order_revenues;
create policy order_revenues_select_policy
on order_revenues
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
);

drop policy if exists order_revenues_insert_policy on order_revenues;
create policy order_revenues_insert_policy
on order_revenues
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'finance'])
);

drop policy if exists receivables_select_policy on receivables;
create policy receivables_select_policy
on receivables
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'finance'])
  or exists (
    select 1
    from orders
    where orders.id = receivables.order_id
      and orders.sales_owner_id = auth.uid()
  )
);

drop policy if exists receivables_insert_policy on receivables;
create policy receivables_insert_policy
on receivables
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'finance'])
);

drop policy if exists receivables_update_policy on receivables;
create policy receivables_update_policy
on receivables
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'finance'])
)
with check (
  app_is_any_role(array['admin', 'manager', 'finance'])
);

drop policy if exists payables_select_policy on payables;
create policy payables_select_policy
on payables
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'finance', 'ops'])
);

drop policy if exists payables_insert_policy on payables;
create policy payables_insert_policy
on payables
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'finance', 'ops'])
);

drop policy if exists payables_update_policy on payables;
create policy payables_update_policy
on payables
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'finance'])
)
with check (
  app_is_any_role(array['admin', 'manager', 'finance'])
);

drop policy if exists payments_select_policy on payments;
create policy payments_select_policy
on payments
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'finance'])
);

drop policy if exists payments_insert_policy on payments;
create policy payments_insert_policy
on payments
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'finance'])
);

drop policy if exists email_tasks_select_policy on email_tasks;
create policy email_tasks_select_policy
on email_tasks
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or owner_id = auth.uid()
);

drop policy if exists email_tasks_insert_policy on email_tasks;
create policy email_tasks_insert_policy
on email_tasks
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or owner_id = auth.uid()
);

drop policy if exists email_templates_select_policy on email_templates;
create policy email_templates_select_policy
on email_templates
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'marketing'])
);

drop policy if exists email_templates_insert_policy on email_templates;
create policy email_templates_insert_policy
on email_templates
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'marketing'])
);

drop policy if exists email_templates_update_policy on email_templates;
create policy email_templates_update_policy
on email_templates
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'marketing'])
)
with check (
  app_is_any_role(array['admin', 'manager', 'marketing'])
);

drop policy if exists rate_sheets_select_policy on rate_sheets;
create policy rate_sheets_select_policy
on rate_sheets
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
);

drop policy if exists rate_sheets_insert_policy on rate_sheets;
create policy rate_sheets_insert_policy
on rate_sheets
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager'])
);

drop policy if exists rate_sheets_update_policy on rate_sheets;
create policy rate_sheets_update_policy
on rate_sheets
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager'])
)
with check (
  app_is_any_role(array['admin', 'manager'])
);

drop policy if exists rate_sheet_items_select_policy on rate_sheet_items;
create policy rate_sheet_items_select_policy
on rate_sheet_items
for select
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
);

drop policy if exists rate_sheet_items_insert_policy on rate_sheet_items;
create policy rate_sheet_items_insert_policy
on rate_sheet_items
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager'])
);
