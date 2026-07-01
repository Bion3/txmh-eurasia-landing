begin;

select 'lead_sources' as check_name, count(*) as row_count from lead_sources;
select 'vendors' as check_name, count(*) as row_count from vendors;
select 'rate_sheets_active' as check_name, count(*) as row_count from rate_sheets where status = 'active';
select 'email_templates' as check_name, count(*) as row_count from email_templates;

with smoke_lead as (
  insert into leads (
    lead_no,
    company_name,
    contact_name,
    email,
    source_type,
    transport_mode_interest,
    shipment_type_interest,
    origin,
    destination,
    cargo_desc,
    volume_cbm,
    weight_kg,
    status
  )
  values (
    app_next_doc_no('LD'),
    'Smoke Test GmbH',
    'Test Operator',
    'smoke@example.test',
    'website_form',
    'rail',
    'LCL',
    'Shenzhen',
    'Hamburg',
    'test cargo',
    2.5,
    600,
    'new'
  )
  returning id
),
converted as (
  select app_convert_lead_to_customer(id, null, true) as result
  from smoke_lead
),
scored_lead as (
  select app_score_lead(id) as result
  from smoke_lead
),
follow_up_task as (
  select app_schedule_follow_up_for_lead(id, 'lead_thank_you_en', 1) as result
  from smoke_lead
),
smoke_quote as (
  insert into quotes (
    quote_no,
    lead_id,
    customer_id,
    contact_id,
    transport_mode,
    shipment_type,
    incoterm,
    origin,
    destination,
    cargo_desc,
    volume_cbm,
    weight_kg,
    currency,
    estimated_cost_total,
    estimated_revenue_total,
    estimated_profit_total,
    estimated_profit_margin,
    status
  )
  select
    app_next_doc_no('QT'),
    (select id from smoke_lead),
    (converted.result ->> 'customer_id')::uuid,
    nullif(converted.result ->> 'contact_id', '')::uuid,
    'rail',
    'LCL',
    'EXW',
    'Shenzhen',
    'Hamburg',
    'test cargo',
    2.5,
    600,
    'USD',
    520,
    650,
    130,
    0.2,
    'draft'
  from converted
  returning id
),
smoke_order as (
  select app_convert_quote_to_order(id, null, null, null) as result
  from smoke_quote
),
smoke_task as (
  insert into order_task_items (order_id, group_name, task_name, status, sort_order)
  select (result ->> 'order_id')::uuid, '前段', '待入集货仓', 'pending', 10
  from smoke_order
  returning id
),
smoke_party as (
  insert into order_parties (order_id, role, company_name, contact_name, email)
  select (result ->> 'order_id')::uuid, 'shipper', 'Smoke Test GmbH', 'Test Operator', 'smoke@example.test'
  from smoke_order
  returning id
),
smoke_cargo as (
  insert into order_cargo_items (order_id, goods_name_cn, pieces, gross_weight_kg, volume_cbm, currency)
  select (result ->> 'order_id')::uuid, 'test cargo', 1, 600, 2.5, 'USD'
  from smoke_order
  returning id
),
smoke_finance_line as (
  insert into order_finance_lines (order_id, line_type, party_name, fee_code, fee_name, unit_price, quantity, calc_method, total_amount, currency)
  select (result ->> 'order_id')::uuid, 'receivable', 'Smoke Test GmbH', 'MAIN_FREIGHT', '主运费收入', 650, 1, 'fixed', 650, 'USD'
  from smoke_order
  returning id
),
smoke_receivable as (
  select app_generate_receivable_for_order((result ->> 'order_id')::uuid, current_date + 7) as result
  from smoke_order
)
select
  'rpc_flow' as check_name,
  smoke_receivable.result ->> 'receivable_id' as generated_receivable_id,
  scored_lead.result ->> 'lead_score' as generated_lead_score,
  follow_up_task.result ->> 'email_task_id' as generated_email_task_id,
  (select count(*) from smoke_task) as task_rows,
  (select count(*) from smoke_party) as party_rows,
  (select count(*) from smoke_cargo) as cargo_rows,
  (select count(*) from smoke_finance_line) as finance_line_rows
from smoke_receivable, scored_lead, follow_up_task;

rollback;
