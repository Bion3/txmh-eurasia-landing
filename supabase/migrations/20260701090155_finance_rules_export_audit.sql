create table if not exists financial_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  rule_name text not null,
  rule_type text not null,
  status text not null default 'active',
  applies_to text not null default 'ar_ap',
  external_system text,
  base_currency text not null default 'USD',
  tax_rate numeric(8,4),
  writeoff_limit numeric(18,2),
  fx_tolerance numeric(18,4),
  requires_approval boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_rules_status_check check (status in ('draft', 'active', 'inactive', 'archived')),
  constraint financial_rules_type_check check (rule_type in ('tax', 'fx', 'writeoff', 'export', 'approval', 'mapping'))
);

create table if not exists finance_export_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text not null unique default app_next_doc_no('FEXP'),
  export_type text not null,
  external_system text not null default 'manual',
  status text not null default 'queued',
  source_ref_type text,
  source_ref_id uuid,
  order_id uuid references orders(id) on delete set null,
  receivable_id uuid references receivables(id) on delete set null,
  payable_id uuid references payables(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  currency text,
  amount numeric(18,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  exported_by uuid,
  exported_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_export_jobs_status_check check (status in ('queued', 'exported', 'acknowledged', 'failed', 'retry_pending', 'cancelled')),
  constraint finance_export_jobs_type_check check (export_type in ('receivable', 'payable', 'payment', 'invoice', 'writeoff', 'master_data', 'statement'))
);

create table if not exists finance_export_events (
  id uuid primary key default gen_random_uuid(),
  export_job_id uuid not null references finance_export_jobs(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  remarks text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_financial_rules_status on financial_rules(status, rule_type);
create index if not exists idx_finance_export_jobs_status on finance_export_jobs(status, next_retry_at, created_at);
create index if not exists idx_finance_export_jobs_source on finance_export_jobs(source_ref_type, source_ref_id);
create index if not exists idx_finance_export_jobs_order on finance_export_jobs(order_id);
create index if not exists idx_finance_export_events_job on finance_export_events(export_job_id, created_at desc);

alter table financial_rules enable row level security;
alter table finance_export_jobs enable row level security;
alter table finance_export_events enable row level security;

grant select, insert, update on
  financial_rules,
  finance_export_jobs,
  finance_export_events
to authenticated;

drop policy if exists financial_rules_select_policy on financial_rules;
create policy financial_rules_select_policy
on financial_rules
for select
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists financial_rules_insert_policy on financial_rules;
create policy financial_rules_insert_policy
on financial_rules
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists financial_rules_update_policy on financial_rules;
create policy financial_rules_update_policy
on financial_rules
for update
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance']))
with check (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists finance_export_jobs_select_policy on finance_export_jobs;
create policy finance_export_jobs_select_policy
on finance_export_jobs
for select
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists finance_export_jobs_insert_policy on finance_export_jobs;
create policy finance_export_jobs_insert_policy
on finance_export_jobs
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists finance_export_jobs_update_policy on finance_export_jobs;
create policy finance_export_jobs_update_policy
on finance_export_jobs
for update
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance']))
with check (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists finance_export_events_select_policy on finance_export_events;
create policy finance_export_events_select_policy
on finance_export_events
for select
to authenticated
using (app_is_any_role(array['admin', 'manager', 'finance']));

drop policy if exists finance_export_events_insert_policy on finance_export_events;
create policy finance_export_events_insert_policy
on finance_export_events
for insert
to authenticated
with check (app_is_any_role(array['admin', 'manager', 'finance']));

drop trigger if exists trg_financial_rules_updated_at on financial_rules;
create trigger trg_financial_rules_updated_at
before update on financial_rules
for each row execute function set_updated_at();

drop trigger if exists trg_finance_export_jobs_updated_at on finance_export_jobs;
create trigger trg_finance_export_jobs_updated_at
before update on finance_export_jobs
for each row execute function set_updated_at();

create or replace function app_record_finance_export_event(
  p_job_id uuid default null,
  p_action text default 'prepare',
  p_export_type text default null,
  p_external_system text default null,
  p_source_ref_type text default null,
  p_source_ref_id uuid default null,
  p_order_id uuid default null,
  p_receivable_id uuid default null,
  p_payable_id uuid default null,
  p_payment_id uuid default null,
  p_currency text default null,
  p_amount numeric default 0,
  p_payload jsonb default '{}'::jsonb,
  p_response_payload jsonb default '{}'::jsonb,
  p_error text default null,
  p_actor_id uuid default auth.uid(),
  p_remarks text default null
)
returns finance_export_jobs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job finance_export_jobs%rowtype;
  v_from_status text;
  v_to_status text;
begin
  if not app_is_any_role(array['admin', 'manager', 'finance']) then
    raise exception 'insufficient_finance_role' using errcode = '42501';
  end if;

  if p_job_id is null then
    if p_export_type is null then
      raise exception 'export_type_required';
    end if;

    insert into finance_export_jobs (
      export_type,
      external_system,
      status,
      source_ref_type,
      source_ref_id,
      order_id,
      receivable_id,
      payable_id,
      payment_id,
      currency,
      amount,
      payload,
      exported_by
    )
    values (
      p_export_type,
      coalesce(nullif(trim(coalesce(p_external_system, '')), ''), 'manual'),
      'queued',
      p_source_ref_type,
      p_source_ref_id,
      p_order_id,
      p_receivable_id,
      p_payable_id,
      p_payment_id,
      p_currency,
      round(coalesce(p_amount, 0)::numeric, 2),
      coalesce(p_payload, '{}'::jsonb),
      p_actor_id
    )
    returning * into v_job;
  else
    select *
    into v_job
    from finance_export_jobs
    where id = p_job_id
    for update;

    if not found then
      raise exception 'finance_export_job_not_found';
    end if;
  end if;

  v_from_status := v_job.status;

  if p_action in ('prepare', 'queue') then
    v_to_status := 'queued';
  elsif p_action = 'export' then
    v_to_status := 'exported';
  elsif p_action in ('ack', 'acknowledge') then
    v_to_status := 'acknowledged';
  elsif p_action = 'fail' then
    v_to_status := 'failed';
  elsif p_action = 'retry' then
    v_to_status := 'retry_pending';
  elsif p_action = 'cancel' then
    v_to_status := 'cancelled';
  else
    raise exception 'unsupported_finance_export_action: %', p_action;
  end if;

  update finance_export_jobs
  set
    status = v_to_status,
    external_system = coalesce(nullif(trim(coalesce(p_external_system, '')), ''), finance_export_jobs.external_system),
    payload = case when coalesce(p_payload, '{}'::jsonb) = '{}'::jsonb then finance_export_jobs.payload else p_payload end,
    response_payload = case when coalesce(p_response_payload, '{}'::jsonb) = '{}'::jsonb then finance_export_jobs.response_payload else p_response_payload end,
    last_error = case when p_action in ('fail', 'retry') then p_error else null end,
    retry_count = case when p_action = 'retry' then finance_export_jobs.retry_count + 1 else finance_export_jobs.retry_count end,
    next_retry_at = case
      when p_action = 'retry' then now() + make_interval(mins => least((finance_export_jobs.retry_count + 1) * 15, 240))
      when p_action in ('export', 'ack', 'acknowledge') then null
      else finance_export_jobs.next_retry_at
    end,
    exported_by = case when p_action = 'export' then p_actor_id else finance_export_jobs.exported_by end,
    exported_at = case when p_action = 'export' then now() else finance_export_jobs.exported_at end,
    acknowledged_at = case when p_action in ('ack', 'acknowledge') then now() else finance_export_jobs.acknowledged_at end,
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  insert into finance_export_events (
    export_job_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    remarks,
    metadata
  )
  values (
    v_job.id,
    p_action,
    v_from_status,
    v_to_status,
    p_actor_id,
    p_remarks,
    jsonb_build_object(
      'external_system', v_job.external_system,
      'source_ref_type', coalesce(p_source_ref_type, v_job.source_ref_type),
      'source_ref_id', coalesce(p_source_ref_id, v_job.source_ref_id),
      'error', p_error,
      'response_payload', coalesce(p_response_payload, '{}'::jsonb)
    )
  );

  return v_job;
end;
$$;

revoke execute on function app_record_finance_export_event(uuid, text, text, text, text, uuid, uuid, uuid, uuid, uuid, text, numeric, jsonb, jsonb, text, uuid, text) from public, anon;
grant execute on function app_record_finance_export_event(uuid, text, text, text, text, uuid, uuid, uuid, uuid, uuid, text, numeric, jsonb, jsonb, text, uuid, text) to authenticated, service_role;
