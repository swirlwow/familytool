-- Preserve the atomic bill-payment workflow while storing its generated label
-- alongside other purchase descriptions instead of in the free-form note.
create or replace function public.pay_bill_to_ledger_atomic(
  p_workspace_id uuid,
  p_bill_instance_id uuid,
  p_pay_amount numeric,
  p_entry_date date,
  p_payer_id uuid,
  p_pay_method text,
  p_category_id uuid,
  p_merchant text,
  p_note text,
  p_splits jsonb,
  p_request_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_bill public.bill_instances%rowtype;
  v_entry_id uuid;
  v_next_paid numeric;
  v_next_status text;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_request_key is null or length(p_request_key) < 16 then
    raise exception 'request key is required';
  end if;

  select * into v_bill
  from public.bill_instances
  where id = p_bill_instance_id and workspace_id = p_workspace_id
  for update;

  if v_bill.id is null then
    raise exception 'bill not found';
  end if;

  if v_bill.payment_mode = 'status_only' then
    raise exception 'status-only bill cannot create ledger entry';
  end if;

  select id into v_entry_id
  from public.ledger_entries
  where workspace_id = p_workspace_id and request_key = p_request_key;

  if v_entry_id is not null then
    return jsonb_build_object(
      'ledger_entry_id', v_entry_id,
      'bill_instance_id', v_bill.id,
      'paid_total', v_bill.paid_total,
      'status', v_bill.status,
      'remaining', greatest(coalesce(v_bill.amount_due, 0) - v_bill.paid_total, 0),
      'already_processed', true
    );
  end if;

  if p_pay_amount <= 0
     or v_bill.amount_due is null
     or p_pay_amount > v_bill.amount_due - v_bill.paid_total then
    raise exception 'invalid payment amount';
  end if;

  v_entry_id := public.create_ledger_entry_with_details(
    p_workspace_id,
    p_entry_date,
    'expense',
    p_pay_amount,
    p_category_id,
    p_pay_method,
    p_merchant,
    p_note,
    p_bill_instance_id,
    p_payer_id,
    p_splits,
    p_request_key,
    left('Bill payment: ' || v_bill.name_snapshot, 1000)
  );

  v_next_paid := round(v_bill.paid_total + p_pay_amount, 2);
  v_next_status := case
    when v_next_paid >= v_bill.amount_due then 'paid'
    else 'partial'
  end;

  update public.bill_instances
  set paid_total = v_next_paid,
      status = v_next_status,
      paid_at = case when v_next_status = 'paid' then now() else paid_at end
  where id = v_bill.id and workspace_id = p_workspace_id;

  return jsonb_build_object(
    'ledger_entry_id', v_entry_id,
    'bill_instance_id', v_bill.id,
    'paid_total', v_next_paid,
    'status', v_next_status,
    'remaining', greatest(v_bill.amount_due - v_next_paid, 0),
    'already_processed', false
  );
end;
$$;

notify pgrst, 'reload schema';
