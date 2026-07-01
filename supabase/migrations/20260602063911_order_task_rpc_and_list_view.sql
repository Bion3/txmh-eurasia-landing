drop view if exists order_list_view;

create view order_list_view
with (security_invoker = true)
as
select
  orders.id,
  orders.order_no,
  orders.quote_id,
  orders.customer_id,
  orders.contact_id,
  customers.company_name as customer_name,
  customers.customer_no,
  quotes.quote_no,
  orders.transport_mode,
  orders.shipment_type,
  orders.booking_no,
  orders.origin,
  orders.destination,
  orders.cargo_desc,
  orders.container_type,
  orders.volume_cbm,
  orders.weight_kg,
  orders.quoted_revenue_total,
  orders.quoted_cost_total,
  orders.quoted_profit_total,
  orders.actual_revenue_total,
  orders.actual_cost_total,
  orders.actual_profit_total,
  orders.status,
  orders.settlement_status,
  orders.sales_owner_id,
  orders.ops_owner_id,
  orders.created_at,
  orders.updated_at,
  coalesce(receivable_rollup.amount_due, 0) as receivable_amount_due,
  coalesce(receivable_rollup.amount_received, 0) as receivable_amount_received,
  coalesce(receivable_rollup.balance_amount, 0) as receivable_balance_amount,
  coalesce(payable_rollup.amount_due, 0) as payable_amount_due,
  coalesce(payable_rollup.amount_paid, 0) as payable_amount_paid,
  coalesce(payable_rollup.balance_amount, 0) as payable_balance_amount,
  case
    when coalesce(receivable_rollup.balance_amount, 0) = 0 and coalesce(receivable_rollup.amount_due, 0) > 0 then '已结清'
    when coalesce(receivable_rollup.amount_received, 0) > 0 then '部分收款'
    when coalesce(receivable_rollup.amount_due, 0) > 0 then '未结清'
    else '待生成'
  end as receivable_status,
  case
    when exists (
      select 1
      from order_task_items
      where order_task_items.order_id = orders.id
        and order_task_items.group_name = '报关'
        and order_task_items.status <> 'done'
    ) then '未完成'
    when exists (
      select 1
      from order_task_items
      where order_task_items.order_id = orders.id
        and order_task_items.group_name = '报关'
    ) then '已完成'
    else '待确认'
  end as customs_status
from orders
left join customers on customers.id = orders.customer_id
left join quotes on quotes.id = orders.quote_id
left join lateral (
  select
    sum(amount_due) as amount_due,
    sum(amount_received) as amount_received,
    sum(balance_amount) as balance_amount
  from receivables
  where receivables.order_id = orders.id
) receivable_rollup on true
left join lateral (
  select
    sum(amount_due) as amount_due,
    sum(amount_paid) as amount_paid,
    sum(balance_amount) as balance_amount
  from payables
  where payables.order_id = orders.id
) payable_rollup on true;

grant select on order_list_view to authenticated, service_role;

create or replace function app_update_order_task_status(
  p_task_id uuid,
  p_status text,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_task order_task_items%rowtype;
  v_order orders%rowtype;
  v_previous_status text;
  v_log order_operation_logs%rowtype;
begin
  if p_task_id is null or p_status is null then
    raise exception 'task_id_and_status_required';
  end if;

  if p_status not in ('not_started', 'pending', 'in_progress', 'done', 'blocked', 'skipped') then
    raise exception 'invalid_task_status';
  end if;

  select * into v_task
  from order_task_items
  where id = p_task_id
  for update;

  if not found then
    raise exception 'order_task_not_found';
  end if;

  select * into v_order
  from orders
  where id = v_task.order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if not (
    app_is_any_role(array['admin', 'manager', 'ops'])
    or v_order.sales_owner_id = auth.uid()
  ) then
    raise exception 'insufficient_order_task_role' using errcode = '42501';
  end if;

  v_previous_status := v_task.status;

  update order_task_items
  set
    status = p_status,
    completed_count = case when p_status = 'done' then total_count else 0 end,
    completed_at = case when p_status = 'done' then now() else null end,
    updated_at = now()
  where id = v_task.id
  returning * into v_task;

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
    'task_update',
    '订单任务状态更新',
    jsonb_build_object('task_id', v_task.id, 'task_name', v_task.task_name, 'status', v_previous_status),
    jsonb_build_object('task_id', v_task.id, 'task_name', v_task.task_name, 'status', v_task.status)
  )
  returning * into v_log;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'operation_log', to_jsonb(v_log),
    'previous_status', v_previous_status,
    'status', v_task.status
  );
end;
$$;

revoke execute on function app_update_order_task_status(uuid, text, text) from public, anon;
grant execute on function app_update_order_task_status(uuid, text, text) to authenticated, service_role;
