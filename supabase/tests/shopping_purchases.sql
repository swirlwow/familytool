-- Synthetic-only, rollback-scoped integration checks. Run with ON_ERROR_STOP=1.
begin;
insert into auth.users(id) values ('a1000000-0000-4000-8000-000000000001'),('a1000000-0000-4000-8000-000000000002');
insert into public.workspaces(id,name) values ('a2000000-0000-4000-8000-000000000001','Purchase test owner'),('a2000000-0000-4000-8000-000000000002','Purchase test foreign');
insert into public.user_workspaces(user_id,workspace_id) values ('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002');
insert into public.shopping_items(id,workspace_id,name,status) values ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Synthetic cup','pending'),('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','Foreign cup','pending'),('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','Legacy cup','purchased');
insert into public.shopping_item_sources(workspace_id,shopping_item_id,platform,price) values ('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Test store',999);
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
do $$
declare r public.shopping_purchases; r2 public.shopping_purchases; b jsonb; n integer; k uuid;
begin
 select * into r from public.shopping_purchases where shopping_item_id='a3000000-0000-4000-8000-000000000003';
 assert r.legacy and r.purchase_date is null and r.total_amount is null, 'Legacy must not invent date/amount';
 select * into r from public.record_shopping_purchase('a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','{"name":"Snapshot cup","purchase_date":"2026-09-16","quantity":2,"total_amount":null,"store":"Test store","specification":"500ml"}');
 assert r.total_amount is null, 'Source quote must not become actual price';
 assert (select status='purchased' from public.shopping_items where id=r.shopping_item_id), 'Completion must update source';
 assert (select count(*)=1 from public.shopping_item_sources where shopping_item_id=r.shopping_item_id), 'Sources preserved';
 select * into r2 from public.record_shopping_purchase('a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',null,'{}');
 assert r.id=r2.id, 'Request retry duplicated purchase';
 select * into r2 from public.record_shopping_purchase('a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002',r.shopping_item_id,'{}');
 assert r.id=r2.id, 'Source completion duplicated purchase';
 update public.shopping_items set name='Renamed wishlist',deleted_at=now() where id=r.shopping_item_id;
 assert (select name='Snapshot cup' from public.shopping_purchases where id=r.id), 'Snapshot changed with source';
 k:=public.rebuy_shopping_purchase('a2000000-0000-4000-8000-000000000001',r.id,'a5000000-0000-4000-8000-000000000001');
 assert public.rebuy_shopping_purchase('a2000000-0000-4000-8000-000000000001',r.id,k)=k, 'Rebuy retry';
 assert (select count(*)=1 from public.shopping_items where id=k and status='pending'), 'Rebuy not pending';
 assert (select price is null from public.shopping_item_sources where shopping_item_id=k), 'Rebuy inferred price';
 b:=public.export_family_backup('a2000000-0000-4000-8000-000000000001');
 assert jsonb_array_length(b->'shopping_purchases')=2, 'Backup lacks purchases';
 assert (select count(*)=31 from jsonb_object_keys(b)), 'Backup table count';
 perform public.remove_shopping_purchase('a2000000-0000-4000-8000-000000000001',r.id,true);
 perform public.remove_shopping_purchase('a2000000-0000-4000-8000-000000000001',r.id,true);
 assert (select deleted_at is not null from public.shopping_purchases where id=r.id), 'Purchase not archived';
 assert (select status='pending' and deleted_at is null from public.shopping_items where id=r.shopping_item_id), 'Source not restored';
 assert (select count(*)=0 from public.ledger_entries where workspace_id='a2000000-0000-4000-8000-000000000001'), 'Unexpected accounting write';
 assert (select count(*)=0 from public.shopping_items where workspace_id='a2000000-0000-4000-8000-000000000002'), 'Foreign read allowed';
 begin
  perform public.record_shopping_purchase('a2000000-0000-4000-8000-000000000002',gen_random_uuid(),null,'{}');
  raise exception 'Foreign RPC unexpectedly permitted';
 exception when raise_exception then
  if sqlerrm <> 'WORKSPACE_FORBIDDEN' then raise; end if;
 end;
 begin
  insert into public.shopping_purchases(workspace_id,request_key,name,purchase_date) values ('a2000000-0000-4000-8000-000000000002',gen_random_uuid(),'Intruder','2026-09-16');
  raise exception 'Foreign insert permitted';
 exception when insufficient_privilege then null;
 end;
 begin
  update public.shopping_purchases set workspace_id='a2000000-0000-4000-8000-000000000002' where id=r.id;
  raise exception 'Foreign reassignment permitted';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role anon;
do $$ begin
 begin perform count(*) from public.shopping_purchases; raise exception 'Anonymous read permitted'; exception when insufficient_privilege then null; end;
 begin perform public.record_shopping_purchase('a2000000-0000-4000-8000-000000000001',gen_random_uuid(),null,'{}'); raise exception 'Anonymous RPC permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: legacy, atomic completion, retry, snapshots, source preservation, rebuy, backup, delete/restore, no accounting, workspace and anonymous isolation';
