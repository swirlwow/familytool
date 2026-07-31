-- Development-only seed for familytool-dev.
-- Do not include this file in a production migration.

insert into public.bill_templates (
  id,
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
  ('a0000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000999', '房貸', 17002, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000999', '大樓管理費', 2739, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000999', '網路費', 1349, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000999', '兒子-科林助聽器', 3128, 'fixed', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000005', '99999999-0000-0000-0000-000000000999', '兒子-教育費', null, 'variable', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000006', '99999999-0000-0000-0000-000000000999', '女兒-教育費', null, 'variable', 'monthly', null, null, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000007', '99999999-0000-0000-0000-000000000999', '就業安定費', 6000, 'fixed', 'months', array[2,5,8,11]::smallint[], 25, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000008', '99999999-0000-0000-0000-000000000999', '電費', null, 'variable', 'months', array[2,4,6,8,10,12]::smallint[], 28, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000009', '99999999-0000-0000-0000-000000000999', '水費', null, 'variable', 'months', array[2,4,6,8,10,12]::smallint[], 21, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000010', '99999999-0000-0000-0000-000000000999', '瓦斯費', null, 'variable', 'months', array[1,3,5,7,9,11]::smallint[], 30, 'ledger', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000011', '99999999-0000-0000-0000-000000000999', '大美女-富邦信用卡', null, 'variable', 'monthly', null, 20, 'status_only', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000012', '99999999-0000-0000-0000-000000000999', '大美女-台新信用卡', null, 'variable', 'monthly', null, 15, 'status_only', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000013', '99999999-0000-0000-0000-000000000999', '大美女-玉山信用卡', null, 'variable', 'monthly', null, 29, 'status_only', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000014', '99999999-0000-0000-0000-000000000999', '大美女-永豐信用卡', null, 'variable', 'monthly', null, 29, 'status_only', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000015', '99999999-0000-0000-0000-000000000999', '大帥哥-富邦信用卡', null, 'variable', 'monthly', null, 30, 'status_only', '2026-08-01'),
  ('a0000000-0000-0000-0000-000000000016', '99999999-0000-0000-0000-000000000999', '大帥哥-台新信用卡', null, 'variable', 'monthly', null, 29, 'status_only', '2026-08-01')
on conflict (id) do update
set
  name = excluded.name,
  amount_default = excluded.amount_default,
  amount_mode = excluded.amount_mode,
  schedule_type = excluded.schedule_type,
  schedule_months = excluded.schedule_months,
  due_day = excluded.due_day,
  payment_mode = excluded.payment_mode,
  starts_on = excluded.starts_on,
  active = true;

select private.generate_bill_instances('2026-08-01');
