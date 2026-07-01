create or replace function app_auto_prepare_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead leads%rowtype;
  v_template email_templates%rowtype;
  v_template_code text;
  v_delay_hours integer;
  v_priority integer;
begin
  perform app_score_lead(new.id);

  select *
  into v_lead
  from leads
  where id = new.id;

  if v_lead.id is null or coalesce(v_lead.email, '') = '' then
    return new;
  end if;

  v_template_code := case
    when coalesce(v_lead.lead_score, 0) < 55 then 'reactivation_en'
    else 'lead_thank_you_en'
  end;

  select *
  into v_template
  from email_templates
  where template_code = v_template_code
    and is_active = true
  limit 1;

  if v_template.id is null then
    return new;
  end if;

  if exists (
    select 1
    from email_tasks
    where lead_id = v_lead.id
      and status = 'pending'
      and template_code = v_template.template_code
  ) then
    return new;
  end if;

  v_delay_hours := case
    when coalesce(v_lead.lead_score, 0) >= 80 then 1
    when coalesce(v_lead.lead_score, 0) >= 55 then 24
    else 72
  end;

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
    'auto_new_lead',
    v_lead.id,
    now() + make_interval(hours => v_delay_hours),
    'pending',
    v_lead.assigned_to,
    v_template.template_code,
    'email',
    v_template.subject,
    coalesce(v_template.body_text, regexp_replace(coalesce(v_template.body_html, ''), '<[^>]+>', '', 'g')),
    v_priority
  );

  update leads
  set
    next_best_action = coalesce(next_best_action, '系统已自动排入二次邮件跟进队列。'),
    updated_at = now()
  where id = v_lead.id;

  return new;
end;
$$;

revoke execute on function app_auto_prepare_new_lead() from public, anon, authenticated;

drop trigger if exists trg_auto_prepare_new_lead on leads;
create trigger trg_auto_prepare_new_lead
after insert on leads
for each row
execute function app_auto_prepare_new_lead();
