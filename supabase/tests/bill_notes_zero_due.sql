-- Integration smoke test. Every test row is isolated in this transaction and rolled back.
begin;
do $$
declare
  w uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  paid uuid := gen_random_uuid();
  invalid_accepted boolean := false;
begin
  insert into public.workspaces(id,name) values (w,'bill-notes-rollback-test');
  insert into public.bill_instances(id,workspace_id,period,due_date,name_snapshot,amount_due,status,paid_total,payment_mode,note)
    values (b,w,'2026-11','2026-11-09','isolated-zero-due',0,'unpaid',0,'status_only',E'overpaid\nzero due');
  if not exists(select 1 from public.bill_instances where id=b and amount_due=0 and paid_total=0 and paid_at is null and note=E'overpaid\nzero due') then
    raise exception 'zero-due note roundtrip failed';
  end if;
  update public.bill_instances set note=null where id=b;
  if not exists(select 1 from public.bill_instances where id=b and note is null and amount_due=0 and paid_total=0) then
    raise exception 'clear note changed financial data';
  end if;
  begin
    update public.bill_instances set note=repeat('x',2001) where id=b;
    invalid_accepted := true;
  exception when check_violation then null;
  end;
  if invalid_accepted then raise exception 'note length check missing'; end if;
  begin
    update public.bill_instances set amount_due=-1 where id=b;
    invalid_accepted := true;
  exception when check_violation then null;
  end;
  if invalid_accepted then raise exception 'negative amount accepted'; end if;
  insert into public.bill_instances(id,workspace_id,period,due_date,name_snapshot,amount_due,status,paid_total,payment_mode,paid_at)
    values (paid,w,'2026-11','2026-11-09','isolated-paid-note',500,'paid',500,'status_only','2026-11-08T08:00:00Z');
  update public.bill_instances set note='paid details remain intact' where id=paid;
  if not exists(select 1 from public.bill_instances where id=paid and status='paid' and amount_due=500 and paid_total=500 and paid_at='2026-11-08T08:00:00Z' and note='paid details remain intact') then
    raise exception 'paid note edit changed settled fields';
  end if;
  if exists(select 1 from public.ledger_entries where workspace_id=w) then raise exception 'unexpected ledger entry'; end if;
end;
$$;
rollback;
select 'passed_and_rolled_back' as bill_notes_zero_due_test;
