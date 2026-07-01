create or replace function app_record_receivable_payment(
  p_receivable_id uuid,
  p_amount numeric,
  p_currency text default null,
  p_payment_date date default null,
  p_payment_method text default null,
  p_reference_no text default null,
  p_fx_rate numeric default null,
  p_base_currency_amount numeric default null,
  p_allow_overpayment boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receivable receivables%rowtype;
  v_payment payments%rowtype;
  v_amount numeric(18,2);
  v_current_received numeric(18,2);
  v_current_balance numeric(18,2);
  v_next_received numeric(18,2);
  v_next_balance numeric(18,2);
begin
  if not app_is_any_role(array['admin', 'manager', 'finance']) then
    raise exception 'insufficient_finance_role' using errcode = '42501';
  end if;

  v_amount := round(coalesce(p_amount, 0)::numeric, 2);

  if v_amount <= 0 then
    raise exception 'payment_amount_must_be_positive';
  end if;

  select * into v_receivable
  from receivables
  where id = p_receivable_id
  for update;

  if not found then
    raise exception 'receivable_not_found';
  end if;

  if p_currency is not null and p_currency <> v_receivable.currency then
    raise exception 'payment_currency_mismatch';
  end if;

  v_current_received := round(coalesce(v_receivable.amount_received, 0)::numeric, 2);
  v_current_balance := round(coalesce(v_receivable.balance_amount, v_receivable.amount_due - v_current_received, 0)::numeric, 2);

  if v_receivable.status = 'closed' or v_current_balance <= 0 then
    raise exception 'receivable_already_closed';
  end if;

  if not p_allow_overpayment and v_amount > v_current_balance then
    raise exception 'payment_exceeds_receivable_balance';
  end if;

  if nullif(trim(coalesce(p_reference_no, '')), '') is not null and exists (
    select 1
    from payments
    where receivable_id = p_receivable_id
      and reference_no = trim(p_reference_no)
      and status <> 'void'
  ) then
    raise exception 'duplicate_payment_reference';
  end if;

  v_next_received := v_current_received + v_amount;
  v_next_balance := greatest(round((v_receivable.amount_due - v_next_received)::numeric, 2), 0);

  insert into payments (
    payment_no,
    payment_type,
    party_type,
    party_id,
    receivable_id,
    currency,
    amount,
    fx_rate,
    base_currency_amount,
    payment_method,
    payment_date,
    reference_no,
    status
  )
  values (
    app_next_doc_no('RCPT'),
    'receipt',
    'customer',
    v_receivable.customer_id,
    v_receivable.id,
    v_receivable.currency,
    v_amount,
    p_fx_rate,
    p_base_currency_amount,
    p_payment_method,
    coalesce(p_payment_date, current_date),
    nullif(trim(coalesce(p_reference_no, '')), ''),
    'confirmed'
  )
  returning * into v_payment;

  update receivables
  set
    amount_received = v_next_received,
    balance_amount = v_next_balance,
    status = case when v_next_balance = 0 then 'closed' else 'partial' end
  where id = v_receivable.id
  returning * into v_receivable;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'receivable', to_jsonb(v_receivable),
    'amount_applied', v_amount,
    'balance_amount', v_receivable.balance_amount
  );
end;
$$;

create or replace function app_record_payable_payment(
  p_payable_id uuid,
  p_amount numeric,
  p_currency text default null,
  p_payment_date date default null,
  p_payment_method text default null,
  p_reference_no text default null,
  p_fx_rate numeric default null,
  p_base_currency_amount numeric default null,
  p_allow_overpayment boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payable payables%rowtype;
  v_payment payments%rowtype;
  v_amount numeric(18,2);
  v_current_paid numeric(18,2);
  v_current_balance numeric(18,2);
  v_next_paid numeric(18,2);
  v_next_balance numeric(18,2);
begin
  if not app_is_any_role(array['admin', 'manager', 'finance']) then
    raise exception 'insufficient_finance_role' using errcode = '42501';
  end if;

  v_amount := round(coalesce(p_amount, 0)::numeric, 2);

  if v_amount <= 0 then
    raise exception 'payment_amount_must_be_positive';
  end if;

  select * into v_payable
  from payables
  where id = p_payable_id
  for update;

  if not found then
    raise exception 'payable_not_found';
  end if;

  if p_currency is not null and p_currency <> v_payable.currency then
    raise exception 'payment_currency_mismatch';
  end if;

  v_current_paid := round(coalesce(v_payable.amount_paid, 0)::numeric, 2);
  v_current_balance := round(coalesce(v_payable.balance_amount, v_payable.amount_due - v_current_paid, 0)::numeric, 2);

  if v_payable.status = 'closed' or v_current_balance <= 0 then
    raise exception 'payable_already_closed';
  end if;

  if not p_allow_overpayment and v_amount > v_current_balance then
    raise exception 'payment_exceeds_payable_balance';
  end if;

  if nullif(trim(coalesce(p_reference_no, '')), '') is not null and exists (
    select 1
    from payments
    where payable_id = p_payable_id
      and reference_no = trim(p_reference_no)
      and status <> 'void'
  ) then
    raise exception 'duplicate_payment_reference';
  end if;

  v_next_paid := v_current_paid + v_amount;
  v_next_balance := greatest(round((v_payable.amount_due - v_next_paid)::numeric, 2), 0);

  insert into payments (
    payment_no,
    payment_type,
    party_type,
    party_id,
    payable_id,
    currency,
    amount,
    fx_rate,
    base_currency_amount,
    payment_method,
    payment_date,
    reference_no,
    status
  )
  values (
    app_next_doc_no('PAY'),
    'payment',
    'vendor',
    v_payable.vendor_id,
    v_payable.id,
    v_payable.currency,
    v_amount,
    p_fx_rate,
    p_base_currency_amount,
    p_payment_method,
    coalesce(p_payment_date, current_date),
    nullif(trim(coalesce(p_reference_no, '')), ''),
    'confirmed'
  )
  returning * into v_payment;

  update payables
  set
    amount_paid = v_next_paid,
    balance_amount = v_next_balance,
    status = case when v_next_balance = 0 then 'closed' else 'partial' end
  where id = v_payable.id
  returning * into v_payable;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'payable', to_jsonb(v_payable),
    'amount_applied', v_amount,
    'balance_amount', v_payable.balance_amount
  );
end;
$$;

revoke execute on function app_record_receivable_payment(uuid, numeric, text, date, text, text, numeric, numeric, boolean) from public, anon;
revoke execute on function app_record_payable_payment(uuid, numeric, text, date, text, text, numeric, numeric, boolean) from public, anon;

grant execute on function app_record_receivable_payment(uuid, numeric, text, date, text, text, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function app_record_payable_payment(uuid, numeric, text, date, text, text, numeric, numeric, boolean) to authenticated, service_role;
