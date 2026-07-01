create or replace function app_update_order_status(
  p_order_id uuid,
  p_status text,
  p_action text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_previous_status order_status;
  v_next_status order_status;
  v_log order_operation_logs%rowtype;
begin
  if p_order_id is null or p_status is null then
    raise exception 'order_id_and_status_required';
  end if;

  v_next_status := p_status::order_status;

  select * into v_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if not (
    app_is_any_role(array['admin', 'manager', 'ops'])
    or v_order.sales_owner_id = auth.uid()
  ) then
    raise exception 'insufficient_order_status_role' using errcode = '42501';
  end if;

  if v_order.status = 'closed' and v_next_status <> 'closed' and not app_is_any_role(array['admin', 'manager']) then
    raise exception 'closed_order_requires_manager';
  end if;

  v_previous_status := v_order.status;

  update orders
  set
    status = v_next_status,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into order_operation_logs (
    order_id,
    actor_id,
    actor_name,
    log_type,
    action,
    before_value,
    after_value
  )
  values (
    v_order.id,
    auth.uid(),
    coalesce(nullif(trim(coalesce(p_actor_name, '')), ''), 'system'),
    'status_update',
    coalesce(p_action, '订单状态更新'),
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', v_order.status)
  )
  returning * into v_log;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'operation_log', to_jsonb(v_log),
    'previous_status', v_previous_status,
    'status', v_order.status
  );
end;
$$;

revoke execute on function app_update_order_status(uuid, text, text, text) from public, anon;
grant execute on function app_update_order_status(uuid, text, text, text) to authenticated, service_role;
