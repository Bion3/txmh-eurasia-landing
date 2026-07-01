begin;

insert into lead_sources (code, name, category, is_active)
values
  ('google_seo', 'Google SEO', 'organic', true),
  ('google_ads', 'Google Ads', 'paid', true),
  ('linkedin', 'LinkedIn', 'social', true),
  ('whatsapp', 'WhatsApp', 'direct', true),
  ('referral', 'Referral', 'referral', true),
  ('trade_show', 'Trade Show', 'offline', true)
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  is_active = excluded.is_active;

insert into campaigns (
  lead_source_id,
  campaign_name,
  utm_source,
  utm_medium,
  utm_campaign,
  landing_page,
  status
)
select id, 'Rail LCL Europe Push', 'google', 'cpc', 'rail_lcl_europe', '/rail-lcl-europe', 'active'
from lead_sources
where code = 'google_ads'
on conflict do nothing;

insert into campaigns (
  lead_source_id,
  campaign_name,
  utm_source,
  utm_medium,
  utm_campaign,
  landing_page,
  status
)
select id, 'Sea FCL Germany SEO', 'google', 'organic', 'sea_fcl_germany', '/sea-fcl-germany', 'active'
from lead_sources
where code = 'google_seo'
on conflict do nothing;

insert into vendors (
  vendor_name,
  vendor_type,
  country,
  contact_name,
  email,
  phone,
  payment_term,
  currency,
  status
)
values
  ('TX Rail Partner', 'rail', 'China', 'Lynn Wu', 'rail@txmh.test', '+86-755-1000-0001', '30 days', 'USD', 'active'),
  ('Blue Ocean Carrier', 'sea', 'China', 'Mason Lee', 'sea@txmh.test', '+86-755-1000-0002', '30 days', 'USD', 'active'),
  ('SkyBridge Air', 'air', 'China', 'Ava Chen', 'air@txmh.test', '+86-755-1000-0003', '15 days', 'USD', 'active'),
  ('EU Broker Desk', 'customs', 'Germany', 'Nina Keller', 'broker@txmh.test', '+49-40-1000-2001', '15 days', 'USD', 'active'),
  ('Last Mile Europe', 'trucking', 'Germany', 'Jonas Weiss', 'delivery@txmh.test', '+49-40-1000-2002', '15 days', 'USD', 'active')
on conflict do nothing;

insert into email_templates (
  template_code,
  template_name,
  language,
  subject,
  body_text,
  template_type,
  is_active
)
values
  (
    'lead_thank_you_en',
    'New Lead Thank You',
    'en',
    'We received your logistics request',
    'Hi {{contact_name}}, thanks for reaching out. We received your request for {{origin}} to {{destination}} and our team will follow up shortly.',
    'welcome',
    true
  ),
  (
    'quote_followup_en',
    'Quote Follow-up',
    'en',
    'Following up on your quotation',
    'Hi {{contact_name}}, we wanted to follow up on quote {{quote_no}} and see if you need any adjustment on route, timing, or service scope.',
    'quote_followup',
    true
  ),
  (
    'reactivation_en',
    'Inactive Customer Reactivation',
    'en',
    'Checking in on your upcoming shipments',
    'Hi {{contact_name}}, we wanted to check whether you have any upcoming rail, sea, or air shipments we can support this month.',
    'reactivation',
    true
  )
on conflict (template_code) do update
set
  template_name = excluded.template_name,
  language = excluded.language,
  subject = excluded.subject,
  body_text = excluded.body_text,
  template_type = excluded.template_type,
  is_active = excluded.is_active;

with rail_vendor as (
  select id from vendors where vendor_name = 'TX Rail Partner' limit 1
),
sea_vendor as (
  select id from vendors where vendor_name = 'Blue Ocean Carrier' limit 1
),
air_vendor as (
  select id from vendors where vendor_name = 'SkyBridge Air' limit 1
)
insert into rate_sheets (
  rate_sheet_no,
  name,
  mode,
  shipment_type,
  vendor_id,
  origin_country,
  origin_port,
  destination_country,
  destination_port,
  incoterm_scope,
  currency,
  effective_from,
  effective_to,
  status,
  priority,
  remarks
)
select
  'RS-RAIL-LCL-001',
  'Rail LCL China to Germany',
  'rail'::transport_mode,
  'LCL'::shipment_type,
  rail_vendor.id,
  'China',
  'Shenzhen',
  'Germany',
  'Hamburg',
  'EXW/FOB',
  'USD',
  current_date,
  current_date + interval '90 day',
  'active'::rate_sheet_status,
  10,
  'Base rail LCL corridor for MVP'
from rail_vendor
where not exists (
  select 1 from rate_sheets where rate_sheet_no = 'RS-RAIL-LCL-001'
)
union all
select
  'RS-SEA-FCL-001',
  'Sea FCL China to Germany',
  'sea'::transport_mode,
  'FCL'::shipment_type,
  sea_vendor.id,
  'China',
  'Shanghai',
  'Germany',
  'Hamburg',
  'FOB',
  'USD',
  current_date,
  current_date + interval '90 day',
  'active'::rate_sheet_status,
  10,
  'Base sea FCL corridor for MVP'
from sea_vendor
where not exists (
  select 1 from rate_sheets where rate_sheet_no = 'RS-SEA-FCL-001'
)
union all
select
  'RS-AIR-GEN-001',
  'Air General Cargo China to EU',
  'air'::transport_mode,
  'air_cargo'::shipment_type,
  air_vendor.id,
  'China',
  'Shenzhen',
  'Germany',
  'Frankfurt',
  'EXW',
  'USD',
  current_date,
  current_date + interval '60 day',
  'active'::rate_sheet_status,
  10,
  'Base air cargo corridor for MVP'
from air_vendor
where not exists (
  select 1 from rate_sheets where rate_sheet_no = 'RS-AIR-GEN-001'
);

insert into rate_sheet_items (
  rate_sheet_id,
  fee_code,
  fee_name,
  calc_method,
  unit,
  min_charge,
  unit_price,
  currency,
  tax_rate,
  included_in_quote,
  cost_type,
  sort_order
)
select
  rs.id,
  item.fee_code,
  item.fee_name,
  item.calc_method::calc_method,
  item.unit,
  item.min_charge,
  item.unit_price,
  'USD',
  0,
  true,
  'estimated_cost',
  item.sort_order
from rate_sheets rs
join (
  values
    ('RS-RAIL-LCL-001', 'freight', 'Rail Freight', 'per_cbm', 'CBM', 180.00, 180.00, 10),
    ('RS-RAIL-LCL-001', 'docs', 'Documentation Fee', 'fixed', 'shipment', 35.00, 35.00, 20),
    ('RS-RAIL-LCL-001', 'delivery', 'Final Delivery', 'fixed', 'shipment', 90.00, 90.00, 30),
    ('RS-SEA-FCL-001', 'ocean_freight', 'Ocean Freight 40HQ', 'per_container', '40HQ', 2150.00, 2150.00, 10),
    ('RS-SEA-FCL-001', 'docs', 'BL & Docs', 'fixed', 'shipment', 55.00, 55.00, 20),
    ('RS-SEA-FCL-001', 'customs', 'Export Customs', 'fixed', 'shipment', 80.00, 80.00, 30),
    ('RS-AIR-GEN-001', 'air_freight', 'Air Freight', 'per_kg', 'KG', 4.80, 4.80, 10),
    ('RS-AIR-GEN-001', 'security', 'Security Charge', 'fixed', 'shipment', 45.00, 45.00, 20),
    ('RS-AIR-GEN-001', 'handling', 'Terminal Handling', 'fixed', 'shipment', 35.00, 35.00, 30)
) as item(rate_sheet_no, fee_code, fee_name, calc_method, unit, min_charge, unit_price, sort_order)
  on rs.rate_sheet_no = item.rate_sheet_no
where not exists (
  select 1
  from rate_sheet_items existing
  where existing.rate_sheet_id = rs.id
    and existing.fee_code = item.fee_code
);

commit;
