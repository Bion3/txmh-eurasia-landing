create or replace function app_recalculate_quote_pricing(
  p_transport_mode text,
  p_shipment_type text,
  p_origin text default null,
  p_destination text default null,
  p_volume_cbm numeric default 0,
  p_weight_kg numeric default 0,
  p_container_qty numeric default 1,
  p_container_type text default null,
  p_customer_id uuid default null,
  p_quote_date date default null,
  p_min_margin numeric default 0.18
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rate_sheet rate_sheets%rowtype;
  v_customer customers%rowtype;
  v_item rate_sheet_items%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_quote_date date := coalesce(p_quote_date, current_date);
  v_origin text := lower(coalesce(p_origin, ''));
  v_destination text := lower(coalesce(p_destination, ''));
  v_route_score integer := 0;
  v_target_margin numeric := greatest(coalesce(p_min_margin, 0.18), 0.01);
  v_qty numeric(18,3);
  v_cost numeric(18,2);
  v_revenue numeric(18,2);
  v_profit numeric(18,2);
  v_revenue_total numeric(18,2) := 0;
  v_cost_total numeric(18,2) := 0;
  v_profit_total numeric(18,2) := 0;
  v_margin numeric(8,4) := 0;
  v_currency text := 'USD';
  v_currency_mismatch boolean := false;
begin
  if not app_is_any_role(array['admin', 'manager', 'sales', 'ops', 'finance']) then
    raise exception 'insufficient_pricing_role' using errcode = '42501';
  end if;

  if p_transport_mode is null or p_shipment_type is null then
    raise exception 'pricing_mode_and_shipment_type_required';
  end if;

  if p_customer_id is not null then
    select * into v_customer
    from customers
    where id = p_customer_id;

    if v_customer.status in ('active', 'vip', 'key_account') or v_customer.customer_type in ('vip', 'key_account') then
      v_target_margin := greatest(v_target_margin, 0.18);
    elsif v_customer.status in ('prospect', 'new') then
      v_target_margin := greatest(v_target_margin, 0.22);
    else
      v_target_margin := greatest(v_target_margin, 0.20);
    end if;
  end if;

  select *
  into v_rate_sheet
  from (
    select
      rs.*,
      (
        case
          when rs.origin_port is not null and v_origin like '%' || lower(rs.origin_port) || '%' then 35
          when rs.origin_country is not null and v_origin like '%' || lower(rs.origin_country) || '%' then 20
          when rs.origin_port is null and rs.origin_country is null then 5
          else 0
        end
        +
        case
          when rs.destination_port is not null and v_destination like '%' || lower(rs.destination_port) || '%' then 35
          when rs.destination_country is not null and v_destination like '%' || lower(rs.destination_country) || '%' then 20
          when rs.destination_port is null and rs.destination_country is null then 5
          else 0
        end
        +
        case
          when rs.effective_from is not null and rs.effective_to is not null then 10
          else 0
        end
      ) as match_score
    from rate_sheets rs
    where rs.mode = p_transport_mode::transport_mode
      and rs.shipment_type = p_shipment_type::shipment_type
      and rs.status = 'active'
      and (rs.effective_from is null or rs.effective_from <= v_quote_date)
      and (rs.effective_to is null or rs.effective_to >= v_quote_date)
  ) ranked
  order by ranked.match_score desc, ranked.priority asc, ranked.effective_from desc nulls last, ranked.created_at desc
  limit 1;

  if v_rate_sheet.id is null then
    raise exception 'no_active_rate_sheet_matched';
  end if;

  v_currency := coalesce(v_rate_sheet.currency, 'USD');

  v_route_score :=
    case
      when v_rate_sheet.origin_port is not null and v_origin like '%' || lower(v_rate_sheet.origin_port) || '%' then 35
      when v_rate_sheet.origin_country is not null and v_origin like '%' || lower(v_rate_sheet.origin_country) || '%' then 20
      when v_rate_sheet.origin_port is null and v_rate_sheet.origin_country is null then 5
      else 0
    end
    +
    case
      when v_rate_sheet.destination_port is not null and v_destination like '%' || lower(v_rate_sheet.destination_port) || '%' then 35
      when v_rate_sheet.destination_country is not null and v_destination like '%' || lower(v_rate_sheet.destination_country) || '%' then 20
      when v_rate_sheet.destination_port is null and v_rate_sheet.destination_country is null then 5
      else 0
    end;

  if v_route_score < 40 then
    v_warnings := v_warnings || jsonb_build_array('路线匹配较弱，请人工确认起运地、目的地和费率表适用范围。');
  end if;

  if v_rate_sheet.effective_from is null or v_rate_sheet.effective_to is null then
    v_warnings := v_warnings || jsonb_build_array('费率表缺少完整有效期，发报价前建议复核。');
  end if;

  for v_item in
    select *
    from rate_sheet_items
    where rate_sheet_id = v_rate_sheet.id
      and included_in_quote = true
    order by sort_order asc, created_at asc
  loop
    v_qty := case v_item.calc_method::text
      when 'per_cbm' then greatest(coalesce(p_volume_cbm, 0), coalesce(v_item.min_qty, 0), 1)
      when 'per_kg' then greatest(coalesce(p_weight_kg, 0), coalesce(v_item.min_qty, 0), 1)
      when 'per_container' then greatest(coalesce(p_container_qty, 1), coalesce(v_item.min_qty, 0), 1)
      else 1
    end;

    if v_item.calc_method::text = 'tiered' then
      v_warnings := v_warnings || jsonb_build_array('存在阶梯价费项，当前按基础单价核算，需人工复核。');
    end if;

    if v_item.container_type is not null
      and p_container_type is not null
      and v_item.container_type <> p_container_type then
      continue;
    end if;

    v_cost := greatest(round((v_qty * coalesce(v_item.unit_price, 0))::numeric, 2), coalesce(v_item.min_charge, 0));
    v_revenue := round((v_cost / greatest(1 - v_target_margin, 0.01))::numeric, 2);
    v_profit := v_revenue - v_cost;

    if coalesce(v_item.currency, v_currency) <> v_currency then
      v_currency_mismatch := true;
    end if;

    v_cost_total := v_cost_total + v_cost;
    v_revenue_total := v_revenue_total + v_revenue;
    v_profit_total := v_profit_total + v_profit;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'rate_sheet_item_id', v_item.id,
      'fee_code', v_item.fee_code,
      'fee_name', v_item.fee_name,
      'qty', v_qty,
      'unit', v_item.unit,
      'unit_price', v_item.unit_price,
      'currency', coalesce(v_item.currency, v_currency),
      'revenue_amount', v_revenue,
      'estimated_cost_amount', v_cost,
      'profit_amount', v_profit,
      'profit_margin', case when v_revenue > 0 then round((v_profit / v_revenue)::numeric, 4) else 0 end
    ));
  end loop;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'rate_sheet_has_no_quote_items';
  end if;

  if v_currency_mismatch then
    v_warnings := v_warnings || jsonb_build_array('费率行存在多币种，当前未做汇率换算，请财务复核。');
  end if;

  v_margin := case when v_revenue_total > 0 then round((v_profit_total / v_revenue_total)::numeric, 4) else 0 end;

  if v_margin < coalesce(p_min_margin, 0.18) then
    v_warnings := v_warnings || jsonb_build_array('毛利率低于最低要求，必须提交审批后再发送。');
  end if;

  if jsonb_array_length(v_warnings) = 0 then
    v_warnings := jsonb_build_array('已按路线、有效期、优先级和目标毛利完成自动核价。');
  end if;

  return jsonb_build_object(
    'matched_rate_sheet_id', v_rate_sheet.id,
    'matched_rate_sheet_name', v_rate_sheet.name,
    'currency', v_currency,
    'route_match_score', v_route_score,
    'target_margin', v_target_margin,
    'pricing_status', case when v_margin < coalesce(p_min_margin, 0.18) or v_route_score < 40 then 'needs_review' else 'auto_calculated' end,
    'items', v_items,
    'summary', jsonb_build_object(
      'estimated_revenue_total', v_revenue_total,
      'estimated_cost_total', v_cost_total,
      'estimated_profit_total', v_profit_total,
      'estimated_profit_margin', v_margin
    ),
    'warnings', v_warnings
  );
end;
$$;

revoke execute on function app_recalculate_quote_pricing(text, text, text, text, numeric, numeric, numeric, text, uuid, date, numeric) from public, anon;
grant execute on function app_recalculate_quote_pricing(text, text, text, text, numeric, numeric, numeric, text, uuid, date, numeric) to authenticated, service_role;
