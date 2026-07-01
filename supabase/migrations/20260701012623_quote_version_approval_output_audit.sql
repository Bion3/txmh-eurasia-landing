create table if not exists quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  version_no integer not null,
  quote_no text,
  status quote_status not null,
  pricing_status text not null,
  approval_status approval_status not null,
  valid_until date,
  currency text not null,
  estimated_cost_total numeric(18,2) not null default 0,
  estimated_revenue_total numeric(18,2) not null default 0,
  estimated_profit_total numeric(18,2) not null default 0,
  estimated_profit_margin numeric(8,4) not null default 0,
  snapshot_data jsonb not null default '{}'::jsonb,
  locked_by uuid,
  locked_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (quote_id, version_no)
);

create table if not exists quote_approval_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  quote_version_id uuid references quote_versions(id) on delete set null,
  event_type text not null,
  from_status approval_status,
  to_status approval_status,
  actor_id uuid,
  remarks text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quote_output_documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  quote_version_id uuid references quote_versions(id) on delete set null,
  output_type text not null default 'customer_pdf',
  channel text not null default 'browser_print',
  document_status text not null default 'generated',
  storage_bucket text,
  storage_path text,
  recipient_email text,
  content_hash text,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_versions_quote_id on quote_versions(quote_id);
create index if not exists idx_quote_versions_quote_no on quote_versions(quote_no);
create index if not exists idx_quote_approval_events_quote_id on quote_approval_events(quote_id, created_at desc);
create index if not exists idx_quote_output_documents_quote_id on quote_output_documents(quote_id, generated_at desc);

alter table quote_versions enable row level security;
alter table quote_approval_events enable row level security;
alter table quote_output_documents enable row level security;

grant select, insert, update on
  quote_versions,
  quote_approval_events,
  quote_output_documents
to authenticated;

drop policy if exists quote_versions_select_policy on quote_versions;
create policy quote_versions_select_policy
on quote_versions
for select
to authenticated
using (
  exists (
    select 1
    from quotes
    where quotes.id = quote_versions.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_versions_insert_policy on quote_versions;
create policy quote_versions_insert_policy
on quote_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from quotes
    where quotes.id = quote_versions.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'sales'])
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_versions_update_policy on quote_versions;
create policy quote_versions_update_policy
on quote_versions
for update
to authenticated
using (
  exists (
    select 1
    from quotes
    where quotes.id = quote_versions.quote_id
      and (
        app_is_any_role(array['admin', 'manager'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from quotes
    where quotes.id = quote_versions.quote_id
      and (
        app_is_any_role(array['admin', 'manager'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_approval_events_select_policy on quote_approval_events;
create policy quote_approval_events_select_policy
on quote_approval_events
for select
to authenticated
using (
  exists (
    select 1
    from quotes
    where quotes.id = quote_approval_events.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_approval_events_insert_policy on quote_approval_events;
create policy quote_approval_events_insert_policy
on quote_approval_events
for insert
to authenticated
with check (
  exists (
    select 1
    from quotes
    where quotes.id = quote_approval_events.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'sales'])
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_output_documents_select_policy on quote_output_documents;
create policy quote_output_documents_select_policy
on quote_output_documents
for select
to authenticated
using (
  exists (
    select 1
    from quotes
    where quotes.id = quote_output_documents.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'ops', 'finance'])
        or app_is_role('sales')
        or quotes.created_by = auth.uid()
      )
  )
);

drop policy if exists quote_output_documents_insert_policy on quote_output_documents;
create policy quote_output_documents_insert_policy
on quote_output_documents
for insert
to authenticated
with check (
  exists (
    select 1
    from quotes
    where quotes.id = quote_output_documents.quote_id
      and (
        app_is_any_role(array['admin', 'manager', 'sales'])
        or quotes.created_by = auth.uid()
      )
  )
);

create or replace function app_record_quote_governance_event(
  p_quote_id uuid,
  p_action text,
  p_actor_id uuid default auth.uid(),
  p_remarks text default null,
  p_output_type text default null,
  p_channel text default null,
  p_storage_path text default null,
  p_recipient_email text default null,
  p_content_hash text default null
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_before_approval approval_status;
  v_version_id uuid;
  v_event_type text;
begin
  select *
  into v_quote
  from quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  v_before_approval := v_quote.approval_status;

  insert into quote_versions (
    quote_id,
    version_no,
    quote_no,
    status,
    pricing_status,
    approval_status,
    valid_until,
    currency,
    estimated_cost_total,
    estimated_revenue_total,
    estimated_profit_total,
    estimated_profit_margin,
    snapshot_data,
    locked_by,
    created_by
  )
  values (
    v_quote.id,
    v_quote.version_no,
    v_quote.quote_no,
    v_quote.status,
    v_quote.pricing_status,
    v_quote.approval_status,
    v_quote.valid_until,
    v_quote.currency,
    v_quote.estimated_cost_total,
    v_quote.estimated_revenue_total,
    v_quote.estimated_profit_total,
    v_quote.estimated_profit_margin,
    to_jsonb(v_quote),
    p_actor_id,
    coalesce(v_quote.created_by, p_actor_id)
  )
  on conflict (quote_id, version_no) do update
  set
    quote_no = excluded.quote_no,
    status = excluded.status,
    pricing_status = excluded.pricing_status,
    approval_status = excluded.approval_status,
    valid_until = excluded.valid_until,
    currency = excluded.currency,
    estimated_cost_total = excluded.estimated_cost_total,
    estimated_revenue_total = excluded.estimated_revenue_total,
    estimated_profit_total = excluded.estimated_profit_total,
    estimated_profit_margin = excluded.estimated_profit_margin,
    snapshot_data = excluded.snapshot_data,
    locked_by = excluded.locked_by,
    locked_at = now()
  returning id into v_version_id;

  if p_action = 'send' then
    update quotes
    set
      status = 'sent',
      remarks = coalesce(p_remarks, remarks),
      updated_at = now()
    where id = p_quote_id
    returning * into v_quote;
    v_event_type := 'sent';
  elsif p_action = 'submit_approval' then
    update quotes
    set
      pricing_status = 'approval_requested',
      approval_status = 'pending',
      remarks = coalesce(p_remarks, remarks),
      updated_at = now()
    where id = p_quote_id
    returning * into v_quote;
    v_event_type := 'approval_submitted';
  elsif p_action = 'approve' then
    update quotes
    set
      approval_status = 'approved',
      approved_by = p_actor_id,
      approved_at = now(),
      remarks = coalesce(p_remarks, remarks),
      updated_at = now()
    where id = p_quote_id
    returning * into v_quote;
    v_event_type := 'approved';
  elsif p_action = 'reject' then
    update quotes
    set
      approval_status = 'rejected',
      remarks = coalesce(p_remarks, remarks),
      updated_at = now()
    where id = p_quote_id
    returning * into v_quote;
    v_event_type := 'rejected';
  elsif p_action = 'formal_output' then
    insert into quote_output_documents (
      quote_id,
      quote_version_id,
      output_type,
      channel,
      document_status,
      storage_path,
      recipient_email,
      content_hash,
      generated_by,
      sent_at,
      metadata
    )
    values (
      p_quote_id,
      v_version_id,
      coalesce(p_output_type, 'customer_pdf'),
      coalesce(p_channel, 'browser_print'),
      case when coalesce(p_channel, 'browser_print') = 'email' then 'sent' else 'generated' end,
      p_storage_path,
      p_recipient_email,
      p_content_hash,
      p_actor_id,
      case when coalesce(p_channel, 'browser_print') = 'email' then now() else null end,
      jsonb_build_object('remarks', p_remarks)
    );
    v_event_type := 'formal_output_generated';
  else
    raise exception 'unsupported_quote_governance_action: %', p_action;
  end if;

  insert into quote_approval_events (
    quote_id,
    quote_version_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    remarks,
    metadata
  )
  values (
    p_quote_id,
    v_version_id,
    v_event_type,
    v_before_approval,
    v_quote.approval_status,
    p_actor_id,
    p_remarks,
    jsonb_build_object(
      'action', p_action,
      'output_type', p_output_type,
      'channel', p_channel,
      'storage_path', p_storage_path,
      'recipient_email', p_recipient_email,
      'content_hash', p_content_hash
    )
  );

  return v_quote;
end;
$$;

revoke execute on function app_record_quote_governance_event(uuid, text, uuid, text, text, text, text, text, text) from public, anon;
grant execute on function app_record_quote_governance_event(uuid, text, uuid, text, text, text, text, text, text) to authenticated, service_role;
