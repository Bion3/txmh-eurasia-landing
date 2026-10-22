create table if not exists public.freight_public_quotes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  station text,
  destination text not null,
  transport text not null check (transport in ('lcl','fcl')),
  service_scope text not null default 'door' check (service_scope in ('door','station')),
  container text,
  currency text not null default 'USD' check (currency = 'USD'),
  unit text not null check (unit in ('billable_cbm','container')),
  unit_price_low numeric(12,2) not null check (unit_price_low >= 0),
  unit_price_high numeric(12,2) not null check (unit_price_high >= unit_price_low),
  minimum_charge numeric(12,2) not null default 0 check (minimum_charge >= 0),
  ratio numeric(12,2) check (ratio is null or ratio > 0),
  valid_from date,
  valid_until date,
  status text not null default 'active' check (status in ('active','inactive')),
  public_note text not null default '',
  pricing_meta jsonb not null default '{}'::jsonb,
  source_snapshot_id uuid references public.freight_cost_snapshots(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_from is null or valid_until is null or valid_from <= valid_until)
);

create index if not exists freight_public_quotes_active_lane_idx
on public.freight_public_quotes (transport, lower(origin), lower(destination), updated_at desc)
where status = 'active';

create index if not exists freight_public_quotes_snapshot_idx
on public.freight_public_quotes (source_snapshot_id)
where source_snapshot_id is not null;

alter table public.freight_public_quotes enable row level security;

drop policy if exists freight_public_quotes_public_read on public.freight_public_quotes;
create policy freight_public_quotes_public_read on public.freight_public_quotes for select to anon
using (status = 'active' and (valid_from is null or valid_from <= current_date) and (valid_until is null or valid_until >= current_date));

drop policy if exists freight_public_quotes_staff_read on public.freight_public_quotes;
create policy freight_public_quotes_staff_read on public.freight_public_quotes for select to authenticated
using ((select auth.uid()) = any (array['1520a854-1746-4add-af50-6605967bb72f'::uuid,'2c1dc7d7-ecc4-4992-9bca-301877e9cd66'::uuid]));

drop policy if exists freight_public_quotes_staff_insert on public.freight_public_quotes;
create policy freight_public_quotes_staff_insert on public.freight_public_quotes for insert to authenticated
with check ((select auth.uid()) = any (array['1520a854-1746-4add-af50-6605967bb72f'::uuid,'2c1dc7d7-ecc4-4992-9bca-301877e9cd66'::uuid]) and created_by = (select auth.uid()));

drop policy if exists freight_public_quotes_staff_update on public.freight_public_quotes;
create policy freight_public_quotes_staff_update on public.freight_public_quotes for update to authenticated
using ((select auth.uid()) = any (array['1520a854-1746-4add-af50-6605967bb72f'::uuid,'2c1dc7d7-ecc4-4992-9bca-301877e9cd66'::uuid]))
with check ((select auth.uid()) = any (array['1520a854-1746-4add-af50-6605967bb72f'::uuid,'2c1dc7d7-ecc4-4992-9bca-301877e9cd66'::uuid]));

drop policy if exists freight_public_quotes_staff_delete on public.freight_public_quotes;
create policy freight_public_quotes_staff_delete on public.freight_public_quotes for delete to authenticated
using ((select auth.uid()) = any (array['1520a854-1746-4add-af50-6605967bb72f'::uuid,'2c1dc7d7-ecc4-4992-9bca-301877e9cd66'::uuid]));

revoke all on table public.freight_public_quotes from anon, authenticated;
grant select (id, origin, station, destination, transport, service_scope, container, currency, unit, unit_price_low, unit_price_high, minimum_charge, ratio, valid_from, valid_until, status, public_note, updated_at) on public.freight_public_quotes to anon;
grant select, insert, update, delete on table public.freight_public_quotes to authenticated;
