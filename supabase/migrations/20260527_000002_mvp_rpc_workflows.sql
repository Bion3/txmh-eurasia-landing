create or replace function app_next_doc_no(prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return upper(prefix)
    || to_char(now(), 'YYYYMMDDHH24MISS')
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
end;
$$;

grant execute on function app_next_doc_no(text) to authenticated, service_role;

create or replace function app_convert_lead_to_customer(
  p_lead_id uuid,
  p_owner_id uuid default null,
  p_create_primary_contact boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads%rowtype;
  v_customer customers%rowtype;
  v_contact contacts%rowtype;
begin
  select * into v_lead
  from leads
  where id = p_lead_id;

  if not found then
    raise exception 'lead_not_found';
  end if;

  select * into v_customer
  from customers
  where created_from_lead_id = p_lead_id
  limit 1;

  if v_customer.id is null then
    insert into customers (
      customer_no,
      company_name,
      customer_type,
      industry,
      country,
      city,
      source_primary,
      owner_id,
      status,
      created_from_lead_id
    )
    values (
      app_next_doc_no('CU'),
      coalesce(v_lead.company_name, v_lead.contact_name, 'New Customer'),
      v_lead.customer_type,
      v_lead.business_type,
      v_lead.country,
      v_lead.city,
      v_lead.source_type,
      coalesce(p_owner_id, v_lead.assigned_to, auth.uid()),
      'prospect',
      v_lead.id
    )
    returning * into v_customer;
  end if;

  if p_create_primary_contact then
    select * into v_contact
    from contacts
    where customer_id = v_customer.id
      and is_primary = true
    order by created_at asc
    limit 1;

    if v_contact.id is null then
      insert into contacts (
        customer_id,
        name,
        email,
        phone,
        is_primary,
        status
      )
      values (
        v_customer.id,
        coalesce(v_lead.contact_name, v_customer.company_name),
        v_lead.email,
        v_lead.phone,
        true,
        'active'
      )
      returning * into v_contact;
    end if;
  end if;

  update leads
  set
    status = case when status = 'new' then 'contacted' else status end,
    updated_at = now()
  where id = v_lead.id;

  return jsonb_build_object(
    'customer_id', v_customer.id,
    'customer_no', v_customer.customer_no,
    'contact_id', v_contact.id,
    'lead_id', v_lead.id
  );
end;
$$;

grant execute on function app_convert_lead_to_customer(uuid, uuid, boolean) to authenticated, service_role;

create or replace function app_convert_quote_to_order(
  p_quote_id uuid,
  p_sales_owner_id uuid default null,
  p_ops_owner_id uuid default null,
  p_booking_no text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_existing_order orders%rowtype;
  v_order orders%rowtype;
begin
  select * into v_quote
  from quotes
  where id = p_quote_id;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if v_quote.customer_id is null then
    raise exception 'quote_missing_customer';
  end if;

  select * into v_existing_order
  from orders
  where quote_id = p_quote_id
  limit 1;

  if v_existing_order.id is not null then
    return jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_no', v_existing_order.order_no,
      'quote_id', v_quote.id,
      'quote_no', v_quote.quote_no
    );
  end if;

  insert into orders (
    order_no,
    quote_id,
    customer_id,
    contact_id,
    transport_mode,
    shipment_type,
    booking_no,
    origin,
    destination,
    cargo_desc,
    container_type,
    volume_cbm,
    weight_kg,
    incoterm,
    quoted_revenue_total,
    quoted_cost_total,
    quoted_profit_total,
    sales_owner_id,
    ops_owner_id,
    status,
    settlement_status
  )
  values (
    app_next_doc_no('OD'),
    v_quote.id,
    v_quote.customer_id,
    v_quote.contact_id,
    v_quote.transport_mode,
    v_quote.shipment_type,
    p_booking_no,
    v_quote.origin,
    v_quote.destination,
    v_quote.cargo_desc,
    v_quote.container_type,
    v_quote.volume_cbm,
    v_quote.weight_kg,
    v_quote.incoterm,
    v_quote.estimated_revenue_total,
    v_quote.estimated_cost_total,
    v_quote.estimated_profit_total,
    coalesce(p_sales_owner_id, v_quote.created_by, auth.uid()),
    p_ops_owner_id,
    'booked',
    'unsettled'
  )
  returning * into v_order;

  update quotes
  set
    status = case
      when status in ('draft', 'sent', 'negotiating') then 'accepted'
      else status
    end,
    approval_status = case
      when approval_status = 'pending' then 'approved'
      else approval_status
    end,
    approved_at = case
      when approval_status = 'pending' then now()
      else approved_at
    end,
    updated_at = now()
  where id = v_quote.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_no', v_order.order_no,
    'quote_id', v_quote.id,
    'quote_no', v_quote.quote_no
  );
end;
$$;

grant execute on function app_convert_quote_to_order(uuid, uuid, uuid, text) to authenticated, service_role;

create or replace function app_generate_receivable_for_order(
  p_order_id uuid,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_receivable receivables%rowtype;
  v_amount numeric(18,2);
begin
  select * into v_order
  from orders
  where id = p_order_id;

  if not found then
    raise exception 'order_not_found';
  end if;

  select * into v_receivable
  from receivables
  where order_id = p_order_id
  order by created_at asc
  limit 1;

  if v_receivable.id is not null then
    return jsonb_build_object(
      'receivable_id', v_receivable.id,
      'order_id', v_order.id,
      'amount_due', v_receivable.amount_due,
      'status', v_receivable.status
    );
  end if;

  v_amount := case
    when coalesce(v_order.actual_revenue_total, 0) > 0 then v_order.actual_revenue_total
    else v_order.quoted_revenue_total
  end;

  insert into receivables (
    customer_id,
    order_id,
    currency,
    amount_due,
    amount_received,
    balance_amount,
    due_date,
    status
  )
  values (
    v_order.customer_id,
    v_order.id,
    'USD',
    coalesce(v_amount, 0),
    0,
    coalesce(v_amount, 0),
    coalesce(p_due_date, current_date + 14),
    'open'
  )
  returning * into v_receivable;

  return jsonb_build_object(
    'receivable_id', v_receivable.id,
    'order_id', v_order.id,
    'amount_due', v_receivable.amount_due,
    'status', v_receivable.status
  );
end;
$$;

grant execute on function app_generate_receivable_for_order(uuid, date) to authenticated, service_role;

create or replace function app_generate_payables_for_order(
  p_order_id uuid,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_count integer := 0;
  v_ids uuid[] := '{}';
  v_existing payables%rowtype;
  v_new payables%rowtype;
  v_cost record;
begin
  select * into v_order
  from orders
  where id = p_order_id;

  if not found then
    raise exception 'order_not_found';
  end if;

  for v_cost in
    select
      vendor_id,
      currency,
      sum(amount) as amount_due
    from order_costs
    where order_id = p_order_id
      and vendor_id is not null
    group by vendor_id, currency
  loop
    select * into v_existing
    from payables
    where order_id = p_order_id
      and vendor_id = v_cost.vendor_id
      and currency = v_cost.currency
    order by created_at asc
    limit 1;

    if v_existing.id is not null then
      v_ids := array_append(v_ids, v_existing.id);
      continue;
    end if;

    insert into payables (
      vendor_id,
      order_id,
      currency,
      amount_due,
      amount_paid,
      balance_amount,
      due_date,
      status
    )
    values (
      v_cost.vendor_id,
      p_order_id,
      coalesce(v_cost.currency, 'USD'),
      coalesce(v_cost.amount_due, 0),
      0,
      coalesce(v_cost.amount_due, 0),
      coalesce(p_due_date, current_date + 14),
      'open'
    )
    returning * into v_new;

    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new.id);
  end loop;

  return jsonb_build_object(
    'order_id', v_order.id,
    'created_count', v_count,
    'payable_ids', v_ids
  );
end;
$$;

grant execute on function app_generate_payables_for_order(uuid, date) to authenticated, service_role;
