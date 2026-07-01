-- Lead acquisition automation.
-- Adds practical scoring metadata and RPCs for second-touch email follow-up queues.

alter table leads add column if not exists scoring_reason jsonb not null default '[]'::jsonb;
alter table leads add column if not exists next_best_action text;
alter table leads add column if not exists last_scored_at timestamptz;

alter table email_tasks add column if not exists template_code text references email_templates(template_code);
alter table email_tasks add column if not exists channel text not null default 'email';
alter table email_tasks add column if not exists subject_snapshot text;
alter table email_tasks add column if not exists body_snapshot text;
alter table email_tasks add column if not exists priority integer not null default 100;

create index if not exists idx_leads_score on leads(lead_score desc);
create index if not exists idx_leads_last_follow_up on leads(last_follow_up_at);
create index if not exists idx_email_tasks_lead_status on email_tasks(lead_id, status);
create index if not exists idx_email_tasks_scheduled_priority on email_tasks(scheduled_at, priority);

create or replace function app_score_lead(p_lead_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_lead leads%rowtype;
  v_score integer := 20;
  v_reasons jsonb := '[]'::jsonb;
  v_intent text := 'cold';
  v_next_action text := '进入长期培育，补充公司和路线信息。';
begin
  select *
  into v_lead
  from leads
  where id = p_lead_id;

  if v_lead.id is null then
    raise exception 'lead_not_found';
  end if;

  if coalesce(v_lead.email, '') <> '' then
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_object('factor', 'email', 'points', 8);
  end if;

  if coalesce(v_lead.phone, '') <> '' then
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_object('factor', 'phone', 'points', 8);
  end if;

  if coalesce(v_lead.origin, '') <> '' and coalesce(v_lead.destination, '') <> '' then
    v_score := v_score + 12;
    v_reasons := v_reasons || jsonb_build_object('factor', 'route_ready', 'points', 12);
  end if;

  if coalesce(v_lead.volume_cbm, 0) >= 10 or coalesce(v_lead.weight_kg, 0) >= 3000 then
    v_score := v_score + 14;
    v_reasons := v_reasons || jsonb_build_object('factor', 'large_shipment', 'points', 14);
  elsif coalesce(v_lead.volume_cbm, 0) > 0 or coalesce(v_lead.weight_kg, 0) > 0 then
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_object('factor', 'cargo_size_known', 'points', 8);
  end if;

  if v_lead.shipment_type_interest = 'FCL' then
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_object('factor', 'fcl_opportunity', 'points', 10);
  elsif v_lead.shipment_type_interest = 'air_cargo' then
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_object('factor', 'air_urgency', 'points', 8);
  end if;

  if v_lead.transport_mode_interest in ('rail', 'air') then
    v_score := v_score + 6;
    v_reasons := v_reasons || jsonb_build_object('factor', 'priority_mode', 'points', 6);
  end if;

  if v_lead.source_type in ('google_ads', 'google_seo', 'website_form') then
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_object('factor', 'inbound_intent', 'points', 10);
  elsif v_lead.source_type in ('referral', 'partner') then
    v_score := v_score + 12;
    v_reasons := v_reasons || jsonb_build_object('factor', 'trusted_referral', 'points', 12);
  end if;

  if coalesce(v_lead.message, '') ~* '(urgent|asap|quote|price|rate|ddp|customs|clearance|booking|本周|紧急|报价|价格|报关|订舱)' then
    v_score := v_score + 12;
    v_reasons := v_reasons || jsonb_build_object('factor', 'buying_signal', 'points', 12);
  end if;

  if v_lead.status = 'quoted' then
    v_score := v_score + 8;
    v_reasons := v_reasons || jsonb_build_object('factor', 'quoted', 'points', 8);
  elsif v_lead.status = 'lost' then
    v_score := greatest(v_score - 25, 0);
    v_reasons := v_reasons || jsonb_build_object('factor', 'lost', 'points', -25);
  end if;

  v_score := least(greatest(v_score, 0), 100);

  if v_score >= 80 then
    v_intent := 'hot';
    v_next_action := '4小时内电话或 WhatsApp 跟进，并同步创建报价。';
  elsif v_score >= 55 then
    v_intent := 'warm';
    v_next_action := '24小时内发送路线方案和报价资料，确认货量与时效。';
  else
    v_intent := 'cold';
    v_next_action := '进入邮件培育，补充目的港、货量和时间要求。';
  end if;

  update leads
  set
    lead_score = v_score,
    intent_level = v_intent,
    next_best_action = v_next_action,
    scoring_reason = v_reasons,
    last_scored_at = now(),
    updated_at = now()
  where id = v_lead.id;

  return jsonb_build_object(
    'lead_id', v_lead.id,
    'lead_score', v_score,
    'intent_level', v_intent,
    'next_best_action', v_next_action,
    'scoring_reason', v_reasons
  );
end;
$$;

create or replace function app_schedule_follow_up_for_lead(
  p_lead_id uuid,
  p_template_code text default null,
  p_delay_hours integer default null
)
returns jsonb
language plpgsql
as $$
declare
  v_lead leads%rowtype;
  v_template email_templates%rowtype;
  v_existing email_tasks%rowtype;
  v_task email_tasks%rowtype;
  v_template_code text;
  v_delay_hours integer;
  v_priority integer;
begin
  select *
  into v_lead
  from leads
  where id = p_lead_id;

  if v_lead.id is null then
    raise exception 'lead_not_found';
  end if;

  if v_lead.last_scored_at is null then
    perform app_score_lead(v_lead.id);

    select *
    into v_lead
    from leads
    where id = p_lead_id;
  end if;

  v_template_code := coalesce(
    p_template_code,
    case
      when v_lead.status = 'nurturing' or coalesce(v_lead.lead_score, 0) < 55 then 'reactivation_en'
      else 'lead_thank_you_en'
    end
  );

  select *
  into v_template
  from email_templates
  where template_code = v_template_code
    and is_active = true;

  if v_template.id is null then
    raise exception 'email_template_not_found';
  end if;

  select *
  into v_existing
  from email_tasks
  where lead_id = v_lead.id
    and status = 'pending'
    and template_code = v_template.template_code
  order by scheduled_at asc
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'email_task_id', v_existing.id,
      'lead_id', v_lead.id,
      'status', 'existing',
      'scheduled_at', v_existing.scheduled_at,
      'template_code', v_existing.template_code
    );
  end if;

  v_delay_hours := coalesce(
    p_delay_hours,
    case
      when coalesce(v_lead.lead_score, 0) >= 80 then 1
      when coalesce(v_lead.lead_score, 0) >= 55 then 24
      else 72
    end
  );

  v_priority := case
    when coalesce(v_lead.lead_score, 0) >= 80 then 10
    when coalesce(v_lead.lead_score, 0) >= 55 then 30
    else 60
  end;

  insert into email_tasks (
    lead_id,
    contact_id,
    trigger_ref_type,
    trigger_ref_id,
    scheduled_at,
    status,
    owner_id,
    template_code,
    channel,
    subject_snapshot,
    body_snapshot,
    priority
  )
  values (
    v_lead.id,
    null,
    'lead_follow_up',
    v_lead.id,
    now() + make_interval(hours => v_delay_hours),
    'pending',
    coalesce(v_lead.assigned_to, (select auth.uid())),
    v_template.template_code,
    'email',
    v_template.subject,
    coalesce(v_template.body_text, regexp_replace(coalesce(v_template.body_html, ''), '<[^>]+>', '', 'g')),
    v_priority
  )
  returning * into v_task;

  update leads
  set
    status = case when status = 'new' then 'contacted'::lead_status else status end,
    last_follow_up_at = now(),
    updated_at = now()
  where id = v_lead.id;

  return jsonb_build_object(
    'email_task_id', v_task.id,
    'lead_id', v_lead.id,
    'status', 'created',
    'scheduled_at', v_task.scheduled_at,
    'template_code', v_task.template_code,
    'priority', v_task.priority
  );
end;
$$;

create or replace function app_bulk_schedule_lead_followups(p_limit integer default 20)
returns jsonb
language plpgsql
as $$
declare
  v_lead record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_created_count integer := 0;
  v_existing_count integer := 0;
begin
  for v_lead in
    select id
    from leads
    where status in ('new', 'contacted', 'nurturing')
      and coalesce(email, '') <> ''
    order by lead_score desc, created_at asc
    limit greatest(coalesce(p_limit, 20), 1)
  loop
    perform app_score_lead(v_lead.id);
    v_result := app_schedule_follow_up_for_lead(v_lead.id);
    v_results := v_results || v_result;

    if v_result ->> 'status' = 'created' then
      v_created_count := v_created_count + 1;
    else
      v_existing_count := v_existing_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'created_count', v_created_count,
    'existing_count', v_existing_count,
    'items', v_results
  );
end;
$$;

revoke execute on function app_score_lead(uuid) from public;
revoke execute on function app_schedule_follow_up_for_lead(uuid, text, integer) from public;
revoke execute on function app_bulk_schedule_lead_followups(integer) from public;

grant execute on function app_score_lead(uuid) to authenticated, service_role;
grant execute on function app_schedule_follow_up_for_lead(uuid, text, integer) to authenticated, service_role;
grant execute on function app_bulk_schedule_lead_followups(integer) to authenticated, service_role;
