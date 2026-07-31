begin;

insert into public.bill_templates (
  workspace_id,
  name,
  amount_default,
  amount_mode,
  schedule_type,
  schedule_months,
  due_day,
  payment_mode,
  starts_on
)
values
  ('99999999-0000-0000-0000-000000000999', '房貸', 17002, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大樓管理費', 2739, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '網路費', 1349, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '兒子-科林助聽器', 3128, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '兒子-教育費', null, 'variable', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '女兒-教育費', null, 'variable', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '就業安定費', 6000, 'fixed', 'months', array[2,5,8,11]::smallint[], 25, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '電費', null, 'variable', 'months', array[2,4,6,8,10,12]::smallint[], 28, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '水費', null, 'variable', 'months', array[2,4,6,8,10,12]::smallint[], 21, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '瓦斯費', null, 'variable', 'months', array[1,3,5,7,9,11]::smallint[], 30, 'ledger', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大美女-富邦信用卡', null, 'variable', 'monthly', null, 20, 'status_only', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大美女-台新信用卡', null, 'variable', 'monthly', null, 15, 'status_only', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大美女-玉山信用卡', null, 'variable', 'monthly', null, 29, 'status_only', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大美女-永豐信用卡', null, 'variable', 'monthly', null, 29, 'status_only', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大帥哥-富邦信用卡', null, 'variable', 'monthly', null, 30, 'status_only', '2026-08-01'),
  ('99999999-0000-0000-0000-000000000999', '大帥哥-台新信用卡', null, 'variable', 'monthly', null, 29, 'status_only', '2026-08-01');

do $$
declare
  v_first_run integer;
  v_second_run integer;
begin
  v_first_run := private.generate_bill_instances('2026-08-01');
  v_second_run := private.generate_bill_instances('2026-08-01');

  if v_first_run <> 15 then
    raise exception 'August generation expected 15 rows, got %', v_first_run;
  end if;

  if v_second_run <> 0 then
    raise exception 'Repeated generation expected 0 rows, got %', v_second_run;
  end if;
end;
$$;

do $$
declare
  v_september_count integer;
  v_february_count integer;
  v_card_count integer;
  v_ledger_count integer;
  v_bad_february_due_dates integer;
  v_bad_variable_rows integer;
begin
  v_september_count := private.generate_bill_instances('2026-09-01');
  v_february_count := private.generate_bill_instances('2027-02-01');

  if v_september_count <> 13 then
    raise exception 'September generation expected 13 rows, got %', v_september_count;
  end if;

  if v_february_count <> 15 then
    raise exception 'February generation expected 15 rows, got %', v_february_count;
  end if;

  select count(*)
    into v_card_count
  from public.bill_instances
  where workspace_id = '99999999-0000-0000-0000-000000000999'
    and period = '2027-02'
    and payment_mode = 'status_only';

  if v_card_count <> 6 then
    raise exception 'February expected 6 status-only card bills, got %', v_card_count;
  end if;

  select count(*)
    into v_bad_february_due_dates
  from public.bill_instances
  where workspace_id = '99999999-0000-0000-0000-000000000999'
    and period = '2027-02'
    and payment_mode = 'status_only'
    and due_date > '2027-02-28';

  if v_bad_february_due_dates <> 0 then
    raise exception 'February card due dates were not clamped to month end';
  end if;

  select count(*)
    into v_bad_variable_rows
  from public.bill_instances
  where workspace_id = '99999999-0000-0000-0000-000000000999'
    and source = 'template'
    and name_snapshot in ('兒子-教育費', '女兒-教育費', '電費', '水費', '瓦斯費')
    and (amount_due is not null or status <> 'awaiting_details');

  if v_bad_variable_rows <> 0 then
    raise exception 'Variable bills must await amount details';
  end if;

  select count(*)
    into v_ledger_count
  from public.ledger_entries
  where workspace_id = '99999999-0000-0000-0000-000000000999';

  if v_ledger_count <> 0 then
    raise exception 'Bill generation unexpectedly created ledger entries';
  end if;
end;
$$;

rollback;
