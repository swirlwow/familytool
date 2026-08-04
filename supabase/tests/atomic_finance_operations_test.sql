begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select user_id::text
    from public.user_workspaces
    where workspace_id = '99999999-0000-0000-0000-000000000999'::uuid
    limit 1
  ),
  true
);
set local role authenticated;

do $$
declare
  v_workspace constant uuid := '99999999-0000-0000-0000-000000000999';
  v_creditor constant uuid := '10000000-0000-0000-0000-000000000001';
  v_debtor constant uuid := '10000000-0000-0000-0000-000000000002';
  v_category constant uuid := '20000000-0000-0000-0000-000000000001';
  v_entry uuid;
  v_entry_retry uuid;
  v_split uuid;
  v_settlement uuid;
  v_item uuid;
  v_bill uuid;
  v_payment jsonb;
  v_payment_retry jsonb;
begin
  insert into public.payers (id, workspace_id, name)
  values
    (v_creditor, v_workspace, 'Atomic test creditor'),
    (v_debtor, v_workspace, 'Atomic test debtor');

  insert into public.ledger_categories (id, workspace_id, name, type)
  values (v_category, v_workspace, 'Atomic test', 'expense');

  v_entry := public.create_ledger_entry_atomic(
    v_workspace, '2099-01-01', 'expense', 100, v_category,
    'test', 'Atomic test', null, null, v_creditor,
    jsonb_build_array(jsonb_build_object('payer_id', v_debtor, 'amount', 40)),
    'test-ledger-request-0001'
  );
  v_entry_retry := public.create_ledger_entry_atomic(
    v_workspace, '2099-01-01', 'expense', 100, v_category,
    'test', 'Atomic test', null, null, v_creditor,
    jsonb_build_array(jsonb_build_object('payer_id', v_debtor, 'amount', 40)),
    'test-ledger-request-0001'
  );
  assert v_entry = v_entry_retry, 'ledger request key is not idempotent';
  assert (select count(*) from public.ledger_entries where id = v_entry) = 1,
    'idempotent ledger request created duplicates';

  select id into v_split
  from public.ledger_splits
  where workspace_id = v_workspace and entry_id = v_entry;

  v_settlement := public.create_settlement_atomic(
    v_workspace, '2099-01-01', '2099-01-31', v_debtor, v_creditor,
    40, 'Atomic test settlement', v_split, 'test-settlement-request-0001'
  );
  select id into v_item
  from public.settlement_items
  where workspace_id = v_workspace and settlement_id = v_settlement;
  assert v_item is not null, 'settlement item was not created';

  begin
    perform public.update_ledger_entry_atomic(
      v_workspace, v_entry, '2099-01-02', 'expense', 100, v_category,
      'test', 'Should fail', null, v_creditor,
      jsonb_build_array(jsonb_build_object('payer_id', v_debtor, 'amount', 40))
    );
    raise exception 'settled ledger entry was editable';
  exception
    when others then
      if sqlerrm = 'settled ledger entry was editable' then
        raise;
      end if;
  end;

  perform public.undo_settlement_item_atomic(v_workspace, v_item);
  assert not exists (select 1 from public.settlements where id = v_settlement),
    'empty settlement header was not removed';
  perform public.delete_ledger_entry_atomic(v_workspace, v_entry);

  insert into public.bill_instances (
    id, workspace_id, period, due_date, name_snapshot, amount_due,
    status, paid_total, source, payment_mode
  ) values (
    '30000000-0000-0000-0000-000000000001', v_workspace, '2099-01',
    '2099-01-31', 'Atomic test bill', 120, 'unpaid', 0, 'manual', 'ledger'
  ) returning id into v_bill;

  v_payment := public.pay_bill_to_ledger_atomic(
    v_workspace, v_bill, 120, '2099-01-03', v_creditor, 'test',
    v_category, 'Atomic test bill', null,
    jsonb_build_array(jsonb_build_object('payer_id', v_debtor, 'amount', 60)),
    'test-bill-payment-0001'
  );
  v_payment_retry := public.pay_bill_to_ledger_atomic(
    v_workspace, v_bill, 120, '2099-01-03', v_creditor, 'test',
    v_category, 'Atomic test bill', null,
    jsonb_build_array(jsonb_build_object('payer_id', v_debtor, 'amount', 60)),
    'test-bill-payment-0001'
  );
  assert (v_payment ->> 'ledger_entry_id') = (v_payment_retry ->> 'ledger_entry_id'),
    'bill payment request key is not idempotent';
  assert (select paid_total from public.bill_instances where id = v_bill) = 120,
    'bill paid total was incremented twice';
  assert (select status from public.bill_instances where id = v_bill) = 'paid',
    'bill was not marked paid';
end;
$$;

rollback;
