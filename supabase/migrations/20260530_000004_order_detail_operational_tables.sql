-- Order detail operational layer.
-- These tables support practical order entry, execution tracking, document handling,
-- and finance line review beyond the base order header and AR/AP summary tables.

create table if not exists order_parties (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  role text not null check (role in ('shipper', 'consignee', 'notify', 'pre_alert', 'booking_party', 'agent')),
  company_name text,
  contact_name text,
  email text,
  phone text,
  address text,
  country text,
  city text,
  visible_to_customer boolean not null default true,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_cargo_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  goods_name_cn text,
  goods_name_en text,
  hs_code text,
  marks text,
  package_type text,
  pieces integer not null default 0,
  gross_weight_kg numeric(18,3) not null default 0,
  volume_cbm numeric(18,3) not null default 0,
  chargeable_volume_cbm numeric(18,3),
  dimensions text,
  cargo_value numeric(18,2),
  currency text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_service_segments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  segment_type text not null check (segment_type in ('domestic_pickup', 'warehouse', 'customs', 'main_rail', 'main_sea', 'main_air', 'tail_delivery', 'other')),
  service_mode text,
  provider_name text,
  origin text,
  destination text,
  train_no text,
  vessel_flight_no text,
  container_no text,
  container_type text,
  warehouse_name text,
  planned_at timestamptz,
  actual_at timestamptz,
  status text not null default 'pending',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_task_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  group_name text not null,
  task_name text not null,
  status text not null default 'not_started' check (status in ('not_started', 'pending', 'in_progress', 'done', 'blocked', 'skipped')),
  completed_count integer not null default 0,
  total_count integer not null default 1,
  due_at timestamptz,
  completed_at timestamptz,
  owner_id uuid,
  sort_order integer not null default 100,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  category text not null check (category in ('booking', 'customs', 'railway_bill', 'invoice', 'packing_list', 'pod', 'finance', 'other')),
  document_name text not null,
  document_no text,
  file_url text,
  file_size_bytes bigint,
  mime_type text,
  visible_to_customer boolean not null default false,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  remarks text
);

create table if not exists order_finance_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  line_type text not null check (line_type in ('receivable', 'payable')),
  party_id uuid,
  party_name text,
  fee_code text not null,
  fee_name text not null,
  unit_price numeric(18,6) not null default 0,
  quantity numeric(18,3) not null default 1,
  allocation_note text,
  fx_rate numeric(18,8) not null default 1,
  calc_method calc_method,
  tax_rate numeric(8,4) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,
  currency text not null default 'USD',
  settled_amount numeric(18,2) not null default 0,
  bill_no text,
  invoice_no text,
  pushed_to_external boolean not null default false,
  external_system text not null default 'yonyou',
  status ar_ap_status not null default 'open',
  finance_remark text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'watching', 'resolved', 'ignored')),
  owner_id uuid,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_operation_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  log_type text not null default 'operation',
  actor_id uuid,
  actor_name text,
  action text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_parties_order_id on order_parties(order_id);
create index if not exists idx_order_cargo_items_order_id on order_cargo_items(order_id);
create index if not exists idx_order_service_segments_order_id on order_service_segments(order_id);
create index if not exists idx_order_task_items_order_id on order_task_items(order_id);
create index if not exists idx_order_documents_order_id on order_documents(order_id);
create index if not exists idx_order_finance_lines_order_id on order_finance_lines(order_id);
create index if not exists idx_order_finance_lines_line_type on order_finance_lines(line_type);
create index if not exists idx_order_exceptions_order_id on order_exceptions(order_id);
create index if not exists idx_order_operation_logs_order_id on order_operation_logs(order_id);
create index if not exists idx_orders_sales_owner_id on orders(sales_owner_id);

drop trigger if exists trg_order_parties_updated_at on order_parties;
create trigger trg_order_parties_updated_at
before update on order_parties
for each row
execute function set_updated_at();

drop trigger if exists trg_order_cargo_items_updated_at on order_cargo_items;
create trigger trg_order_cargo_items_updated_at
before update on order_cargo_items
for each row
execute function set_updated_at();

drop trigger if exists trg_order_service_segments_updated_at on order_service_segments;
create trigger trg_order_service_segments_updated_at
before update on order_service_segments
for each row
execute function set_updated_at();

drop trigger if exists trg_order_task_items_updated_at on order_task_items;
create trigger trg_order_task_items_updated_at
before update on order_task_items
for each row
execute function set_updated_at();

drop trigger if exists trg_order_finance_lines_updated_at on order_finance_lines;
create trigger trg_order_finance_lines_updated_at
before update on order_finance_lines
for each row
execute function set_updated_at();

drop trigger if exists trg_order_exceptions_updated_at on order_exceptions;
create trigger trg_order_exceptions_updated_at
before update on order_exceptions
for each row
execute function set_updated_at();

grant select, insert, update on
  order_parties,
  order_cargo_items,
  order_service_segments,
  order_task_items,
  order_documents,
  order_finance_lines,
  order_exceptions,
  order_operation_logs
to authenticated;

alter table order_parties enable row level security;
alter table order_cargo_items enable row level security;
alter table order_service_segments enable row level security;
alter table order_task_items enable row level security;
alter table order_documents enable row level security;
alter table order_finance_lines enable row level security;
alter table order_exceptions enable row level security;
alter table order_operation_logs enable row level security;

drop policy if exists order_parties_select_policy on order_parties;
create policy order_parties_select_policy
on order_parties
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_parties.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_parties_insert_policy on order_parties;
create policy order_parties_insert_policy
on order_parties
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_parties.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_parties_update_policy on order_parties;
create policy order_parties_update_policy
on order_parties
for update
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_parties.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from orders
    where orders.id = order_parties.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_cargo_items_select_policy on order_cargo_items;
create policy order_cargo_items_select_policy
on order_cargo_items
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_cargo_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_cargo_items_insert_policy on order_cargo_items;
create policy order_cargo_items_insert_policy
on order_cargo_items
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_cargo_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_cargo_items_update_policy on order_cargo_items;
create policy order_cargo_items_update_policy
on order_cargo_items
for update
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_cargo_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from orders
    where orders.id = order_cargo_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_service_segments_select_policy on order_service_segments;
create policy order_service_segments_select_policy
on order_service_segments
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_service_segments.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_service_segments_insert_policy on order_service_segments;
create policy order_service_segments_insert_policy
on order_service_segments
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_service_segments.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_service_segments_update_policy on order_service_segments;
create policy order_service_segments_update_policy
on order_service_segments
for update
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_service_segments.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from orders
    where orders.id = order_service_segments.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_task_items_select_policy on order_task_items;
create policy order_task_items_select_policy
on order_task_items
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_task_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_task_items_insert_policy on order_task_items;
create policy order_task_items_insert_policy
on order_task_items
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_task_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_task_items_update_policy on order_task_items;
create policy order_task_items_update_policy
on order_task_items
for update
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_task_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from orders
    where orders.id = order_task_items.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_documents_select_policy on order_documents;
create policy order_documents_select_policy
on order_documents
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_documents.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_documents_insert_policy on order_documents;
create policy order_documents_insert_policy
on order_documents
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_documents.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_documents_update_policy on order_documents;
create policy order_documents_update_policy
on order_documents
for update
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_documents.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from orders
    where orders.id = order_documents.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_finance_lines_select_policy on order_finance_lines;
create policy order_finance_lines_select_policy
on order_finance_lines
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_finance_lines.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_finance_lines_insert_policy on order_finance_lines;
create policy order_finance_lines_insert_policy
on order_finance_lines
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'ops', 'finance']));

drop policy if exists order_finance_lines_update_policy on order_finance_lines;
create policy order_finance_lines_update_policy
on order_finance_lines
for update
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance']))
with check (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists order_exceptions_select_policy on order_exceptions;
create policy order_exceptions_select_policy
on order_exceptions
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_exceptions.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_exceptions_insert_policy on order_exceptions;
create policy order_exceptions_insert_policy
on order_exceptions
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_exceptions.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_exceptions_update_policy on order_exceptions;
create policy order_exceptions_update_policy
on order_exceptions
for update
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_exceptions.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from orders
    where orders.id = order_exceptions.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_operation_logs_select_policy on order_operation_logs;
create policy order_operation_logs_select_policy
on order_operation_logs
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_operation_logs.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);

drop policy if exists order_operation_logs_insert_policy on order_operation_logs;
create policy order_operation_logs_insert_policy
on order_operation_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from orders
    where orders.id = order_operation_logs.order_id
      and (app_is_any_role(array['admin', 'manager', 'ops', 'finance']) or orders.sales_owner_id = auth.uid())
  )
);
