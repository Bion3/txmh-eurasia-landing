create or replace function app_dashboard_summary()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today_leads integer := 0;
  v_active_quotes integer := 0;
  v_executing_orders integer := 0;
  v_projected_profit numeric(18,2) := 0;
  v_pending_email_tasks integer := 0;
  v_low_margin_quotes integer := 0;
  v_orders_need_costs integer := 0;
  v_pending_receivables integer := 0;
begin
  if not app_is_any_role(array['admin', 'manager', 'sales', 'ops', 'finance', 'marketing']) then
    raise exception 'insufficient_dashboard_role' using errcode = '42501';
  end if;

  select count(*)::integer
  into v_today_leads
  from leads
  where created_at >= current_date
    and created_at < current_date + interval '1 day';

  select count(*)::integer
  into v_active_quotes
  from quotes
  where status in ('draft', 'sent', 'negotiating')
    and approval_status <> 'rejected';

  select count(*)::integer
  into v_executing_orders
  from orders
  where status in ('booked', 'in_transit', 'customs');

  select coalesce(sum(
    case
      when coalesce(actual_profit_total, 0) <> 0 then actual_profit_total
      else quoted_profit_total
    end
  ), 0)
  into v_projected_profit
  from orders
  where status in ('booked', 'in_transit', 'customs', 'delivered');

  select count(*)::integer
  into v_pending_email_tasks
  from email_tasks
  where status = 'pending'
    and scheduled_at <= now() + interval '1 day';

  select count(*)::integer
  into v_low_margin_quotes
  from quotes
  where status in ('draft', 'sent', 'negotiating')
    and estimated_profit_margin < 0.18;

  select count(*)::integer
  into v_orders_need_costs
  from orders
  where status in ('booked', 'in_transit', 'customs')
    and not exists (
      select 1
      from order_costs
      where order_costs.order_id = orders.id
        and order_costs.status in ('confirmed', 'approved', 'paid')
    )
    and not exists (
      select 1
      from payables
      where payables.order_id = orders.id
    );

  select count(*)::integer
  into v_pending_receivables
  from receivables
  where status in ('open', 'partial', 'overdue')
    and balance_amount > 0;

  return jsonb_build_object(
    'source', 'database',
    'generated_at', now(),
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'key', 'today_leads',
        'label', '今日新增线索',
        'value', v_today_leads,
        'display_value', v_today_leads::text,
        'hint', '按当前账号可见的 leads 实时统计'
      ),
      jsonb_build_object(
        'key', 'active_quotes',
        'label', '进行中报价',
        'value', v_active_quotes,
        'display_value', v_active_quotes::text,
        'hint', '草稿、已发送、谈判中的报价'
      ),
      jsonb_build_object(
        'key', 'executing_orders',
        'label', '执行中订单',
        'value', v_executing_orders,
        'display_value', v_executing_orders::text,
        'hint', '已订舱、运输中、报关中的订单'
      ),
      jsonb_build_object(
        'key', 'projected_profit',
        'label', '预计毛利',
        'value', v_projected_profit,
        'display_value', '$' || to_char(v_projected_profit, 'FM999G999G999D00'),
        'hint', '按订单实际/报价利润汇总'
      )
    ),
    'workbench', jsonb_build_object(
      'pending_email_tasks', v_pending_email_tasks,
      'low_margin_quotes', v_low_margin_quotes,
      'orders_need_costs', v_orders_need_costs,
      'pending_receivables', v_pending_receivables
    )
  );
end;
$$;

revoke execute on function app_dashboard_summary() from public, anon;
grant execute on function app_dashboard_summary() to authenticated, service_role;
