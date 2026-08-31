-- Integration checks against an existing workspace. All test writes roll back.
begin;
select set_config('request.jwt.claim.sub', (select user_id::text from public.user_workspaces limit 1), true);
set local role authenticated;
do $$
declare w uuid; e uuid; again uuid; m uuid; n integer; rejected boolean := false;
begin
 select workspace_id into w from public.user_workspaces limit 1;
 if w is null then raise exception 'test requires workspace membership'; end if;
 insert into public.ledger_merchants(workspace_id,name) values(w,'__test_merchant_20260831') returning id into m;
 update public.ledger_merchants set name='__test_merchant_renamed',is_active=false where id=m;
 if not exists(select 1 from public.ledger_merchants where id=m and not is_active) then raise exception 'merchant update failed'; end if;
 begin
   insert into public.ledger_merchants(workspace_id,name) values(w,'__TEST_MERCHANT_RENAMED');
   raise exception 'duplicate accepted';
 exception when unique_violation then null; end;
 e := public.create_ledger_entry_with_details(w,current_date,'expense',500,null,null,'蝦皮@2500ml保冷壺','原始備註',null,null,'[]','__test_detail_key','2500ml 保冷壺');
 again := public.create_ledger_entry_with_details(w,current_date,'expense',999,null,null,'changed','changed',null,null,'[]','__test_detail_key','changed');
 if e<>again or not exists(select 1 from public.ledger_entries where id=e and amount=500 and consumption_content='2500ml 保冷壺' and note='原始備註') then raise exception 'idempotency failed'; end if;
 perform public.update_ledger_entry_with_details(w,e,current_date,'expense',500,null,null,'蝦皮','原始備註',null,'[]','新版保冷壺');
 if not exists(select 1 from public.ledger_entries where id=e and consumption_content='新版保冷壺' and note='原始備註') then raise exception 'content update failed'; end if;
 perform public.update_ledger_entry_atomic(w,e,current_date,'expense',500,null,null,'蝦皮','原始備註',null,'[]');
 if not exists(select 1 from public.ledger_entries where id=e and consumption_content='新版保冷壺') then raise exception 'old client erased content'; end if;
 perform public.update_ledger_entry_with_details(w,e,current_date,'expense',500,null,null,'蝦皮','原始備註',null,'[]','');
 if not exists(select 1 from public.ledger_entries where id=e and consumption_content is null) then raise exception 'clear failed'; end if;
 begin
   perform public.update_ledger_entry_with_details(w,e,current_date,'expense',999,null,null,'broken','broken',null,'[]',repeat('a',1001));
 exception when others then rejected := true; end;
 if not rejected or not exists(select 1 from public.ledger_entries where id=e and amount=500 and note='原始備註') then raise exception 'invalid data changed record'; end if;
 -- Check settled-entry guard without modifying any original record.
 select le.id into e from public.ledger_entries le join public.ledger_splits ls on ls.entry_id=le.id
 join public.settlement_items si on si.split_id=ls.id where le.workspace_id=w limit 1;
 if e is not null then
   rejected := false;
   begin
     perform public.update_ledger_entry_with_details(w,e,current_date,'expense',500,null,null,'broken','broken',null,'[]','broken');
   exception when others then
     if sqlerrm='settled ledger entry cannot be edited' then rejected:=true; else raise; end if;
   end;
   if not rejected then raise exception 'settled protection failed'; end if;
 end if;
 -- Simulate an authenticated non-member; RLS must hide merchant data and deny RPC writes.
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 select count(*) into n from public.ledger_merchants;
 if n<>0 then raise exception 'RLS leaked merchants'; end if;
 rejected:=false;
 begin
   perform public.create_ledger_entry_with_details(w,current_date,'expense',500,null,null,null,null,null,null,'[]',null,null);
 exception when others then
   if sqlerrm='workspace access denied' then rejected:=true; else raise; end if;
 end;
 if not rejected then raise exception 'unauthorized write accepted'; end if;
end $$;
rollback;
select 'passed: merchant CRUD/duplicate, create/edit/clear, idempotency, legacy compatibility, settled guard, RLS; test changes rolled back' as test_result;
