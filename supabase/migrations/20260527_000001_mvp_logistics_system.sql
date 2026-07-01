create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transport_mode') then
    create type transport_mode as enum ('rail', 'sea', 'air');
  end if;

  if not exists (select 1 from pg_type where typname = 'shipment_type') then
    create type shipment_type as enum ('FCL', 'LCL', 'air_cargo');
  end if;

  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('new', 'contacted', 'quoted', 'won', 'lost', 'nurturing');
  end if;

  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type quote_status as enum ('draft', 'sent', 'negotiating', 'accepted', 'rejected', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type approval_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('booked', 'in_transit', 'customs', 'delivered', 'closed', 'exception');
  end if;

  if not exists (select 1 from pg_type where typname = 'settlement_status') then
    create type settlement_status as enum ('unsettled', 'partial', 'settled');
  end if;

  if not exists (select 1 from pg_type where typname = 'cost_status') then
    create type cost_status as enum ('draft', 'confirmed', 'approved', 'paid');
  end if;

  if not exists (select 1 from pg_type where typname = 'ar_ap_status') then
    create type ar_ap_status as enum ('open', 'partial', 'closed', 'overdue');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_type') then
    create type payment_type as enum ('receipt', 'payment');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('draft', 'confirmed', 'void');
  end if;

  if not exists (select 1 from pg_type where typname = 'email_task_status') then
    create type email_task_status as enum ('pending', 'sent', 'failed', 'canceled', 'replied');
  end if;

  if not exists (select 1 from pg_type where typname = 'rate_sheet_status') then
    create type rate_sheet_status as enum ('draft', 'active', 'expired', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'calc_method') then
    create type calc_method as enum ('fixed', 'per_cbm', 'per_kg', 'per_shipment', 'per_container', 'tiered');
  end if;
end $$;

create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  lead_source_id uuid references lead_sources(id),
  campaign_name text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_page text,
  status text default 'active',
  start_date date,
  end_date date,
  budget numeric(18,2),
  owner_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists website_visits (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  visitor_id text,
  lead_source_id uuid references lead_sources(id),
  campaign_id uuid references campaigns(id),
  landing_page text,
  referrer_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  country text,
  device_type text,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_no text unique,
  company_name text,
  contact_name text,
  email text,
  phone text,
  country text,
  city text,
  customer_type text,
  business_type text,
  source_type text not null,
  lead_source_id uuid references lead_sources(id),
  campaign_id uuid references campaigns(id),
  website_visit_id uuid references website_visits(id),
  channel_detail text,
  intent_level text,
  lead_score integer not null default 0,
  transport_mode_interest transport_mode,
  shipment_type_interest shipment_type,
  origin text,
  destination text,
  cargo_desc text,
  volume_cbm numeric(18,3),
  weight_kg numeric(18,3),
  message text,
  status lead_status not null default 'new',
  assigned_to uuid,
  first_response_at timestamptz,
  last_follow_up_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_no text unique,
  company_name text not null,
  company_name_en text,
  customer_type text,
  industry text,
  country text,
  city text,
  address text,
  website text,
  tax_no text,
  source_primary text,
  owner_id uuid,
  status text not null default 'prospect',
  created_from_lead_id uuid references leads(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  whatsapp text,
  wechat text,
  is_primary boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  activity_type text not null,
  subject text,
  content text,
  result text,
  next_action text,
  next_follow_up_at timestamptz,
  owner_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_name text not null,
  vendor_type text,
  country text,
  contact_name text,
  email text,
  phone text,
  payment_term text,
  currency text,
  status text default 'active',
  created_at timestamptz not null default now()
);

create table if not exists rate_sheets (
  id uuid primary key default gen_random_uuid(),
  rate_sheet_no text unique,
  name text not null,
  mode transport_mode not null,
  shipment_type shipment_type not null,
  vendor_id uuid references vendors(id),
  origin_country text,
  origin_port text,
  destination_country text,
  destination_port text,
  incoterm_scope text,
  currency text not null,
  effective_from date,
  effective_to date,
  status rate_sheet_status not null default 'draft',
  priority integer not null default 100,
  remarks text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rate_sheet_items (
  id uuid primary key default gen_random_uuid(),
  rate_sheet_id uuid not null references rate_sheets(id) on delete cascade,
  fee_code text not null,
  fee_name text not null,
  calc_method calc_method not null,
  unit text,
  container_type text,
  min_qty numeric(18,3),
  max_qty numeric(18,3),
  min_charge numeric(18,2),
  unit_price numeric(18,6) not null default 0,
  currency text not null,
  tax_rate numeric(8,4) default 0,
  included_in_quote boolean not null default true,
  cost_type text not null default 'estimated_cost',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text unique,
  lead_id uuid references leads(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  transport_mode transport_mode not null,
  shipment_type shipment_type not null,
  incoterm text,
  origin text,
  destination text,
  cargo_desc text,
  container_type text,
  volume_cbm numeric(18,3),
  weight_kg numeric(18,3),
  rate_sheet_id uuid references rate_sheets(id),
  pricing_status text not null default 'auto_calculated',
  currency text not null,
  estimated_cost_total numeric(18,2) not null default 0,
  estimated_revenue_total numeric(18,2) not null default 0,
  estimated_profit_total numeric(18,2) not null default 0,
  estimated_profit_margin numeric(8,4) not null default 0,
  valid_until date,
  status quote_status not null default 'draft',
  approval_status approval_status not null default 'pending',
  approved_by uuid,
  approved_at timestamptz,
  version_no integer not null default 1,
  remarks text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  rate_sheet_item_id uuid references rate_sheet_items(id),
  source_type text not null default 'rate_engine',
  fee_code text not null,
  fee_name text not null,
  calc_base_value numeric(18,3),
  calc_formula text,
  unit text,
  qty numeric(18,3) not null default 1,
  unit_price numeric(18,6) not null default 0,
  currency text not null,
  revenue_amount numeric(18,2) not null default 0,
  estimated_cost_amount numeric(18,2) not null default 0,
  profit_amount numeric(18,2) not null default 0,
  profit_margin numeric(8,4) not null default 0,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists quote_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  quote_item_id uuid references quote_items(id) on delete cascade,
  rate_sheet_id uuid references rate_sheets(id),
  rate_sheet_item_id uuid references rate_sheet_items(id),
  fee_code text not null,
  fee_name text not null,
  calc_method calc_method,
  calc_base_value numeric(18,3),
  unit_price numeric(18,6),
  min_charge numeric(18,2),
  currency text,
  estimated_cost_amount numeric(18,2),
  quoted_amount numeric(18,2),
  profit_amount numeric(18,2),
  snapshot_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique,
  quote_id uuid references quotes(id) on delete set null,
  customer_id uuid not null references customers(id),
  contact_id uuid references contacts(id) on delete set null,
  transport_mode transport_mode not null,
  shipment_type shipment_type not null,
  booking_no text,
  origin text,
  destination text,
  cargo_desc text,
  container_type text,
  volume_cbm numeric(18,3),
  weight_kg numeric(18,3),
  incoterm text,
  quoted_revenue_total numeric(18,2) not null default 0,
  quoted_cost_total numeric(18,2) not null default 0,
  quoted_profit_total numeric(18,2) not null default 0,
  actual_revenue_total numeric(18,2) not null default 0,
  actual_cost_total numeric(18,2) not null default 0,
  actual_profit_total numeric(18,2) not null default 0,
  status order_status not null default 'booked',
  settlement_status settlement_status not null default 'unsettled',
  sales_owner_id uuid,
  ops_owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  shipment_no text unique,
  leg_type text,
  carrier_name text,
  route text,
  etd date,
  eta date,
  ata date,
  status text,
  current_node text,
  exception_flag boolean not null default false,
  exception_reason text,
  created_at timestamptz not null default now()
);

create table if not exists shipment_milestones (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  node_code text,
  node_name text not null,
  planned_at timestamptz,
  actual_at timestamptz,
  status text,
  remark text,
  created_at timestamptz not null default now()
);

create table if not exists order_costs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  shipment_id uuid references shipments(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  cost_category text,
  fee_code text not null,
  description text,
  currency text not null,
  amount numeric(18,2) not null default 0,
  tax_rate numeric(8,4) default 0,
  tax_amount numeric(18,2) not null default 0,
  amount_ex_tax numeric(18,2) not null default 0,
  is_estimated boolean not null default false,
  source_ref_type text,
  source_ref_id uuid,
  status cost_status not null default 'draft',
  occurred_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists order_revenues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  revenue_category text,
  fee_code text not null,
  description text,
  currency text not null,
  amount numeric(18,2) not null default 0,
  tax_rate numeric(8,4) default 0,
  tax_amount numeric(18,2) not null default 0,
  amount_ex_tax numeric(18,2) not null default 0,
  status text default 'confirmed',
  created_at timestamptz not null default now()
);

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  invoice_id uuid,
  currency text not null,
  amount_due numeric(18,2) not null default 0,
  amount_received numeric(18,2) not null default 0,
  balance_amount numeric(18,2) not null default 0,
  due_date date,
  status ar_ap_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists payables (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  invoice_id uuid,
  currency text not null,
  amount_due numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  balance_amount numeric(18,2) not null default 0,
  due_date date,
  status ar_ap_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text unique,
  payment_type payment_type not null,
  party_type text not null,
  party_id uuid not null,
  receivable_id uuid references receivables(id) on delete set null,
  payable_id uuid references payables(id) on delete set null,
  invoice_id uuid,
  currency text not null,
  amount numeric(18,2) not null default 0,
  fx_rate numeric(18,8),
  base_currency_amount numeric(18,2),
  payment_method text,
  payment_date date,
  reference_no text,
  status payment_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18,8) not null,
  rate_date date not null,
  source text,
  created_at timestamptz not null default now(),
  unique (base_currency, quote_currency, rate_date)
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  template_name text not null,
  language text not null default 'en',
  subject text not null,
  body_html text,
  body_text text,
  template_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists email_tasks (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid,
  sequence_step_id uuid,
  lead_id uuid references leads(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  trigger_ref_type text,
  trigger_ref_id uuid,
  scheduled_at timestamptz not null,
  status email_task_status not null default 'pending',
  sent_at timestamptz,
  owner_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_email on leads(email);
create index if not exists idx_customers_company_name on customers(company_name);
create index if not exists idx_quotes_customer_id on quotes(customer_id);
create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_receivables_customer_id on receivables(customer_id);
create index if not exists idx_payables_vendor_id on payables(vendor_id);
create index if not exists idx_email_tasks_status on email_tasks(status);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
before update on leads
for each row
execute function set_updated_at();

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at
before update on customers
for each row
execute function set_updated_at();

drop trigger if exists trg_rate_sheets_updated_at on rate_sheets;
create trigger trg_rate_sheets_updated_at
before update on rate_sheets
for each row
execute function set_updated_at();

drop trigger if exists trg_quotes_updated_at on quotes;
create trigger trg_quotes_updated_at
before update on quotes
for each row
execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row
execute function set_updated_at();
