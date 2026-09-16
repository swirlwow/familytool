-- Synthetic-only, rollback-scoped check for complete wishlist transfer.
begin;
insert into auth.users(id) values ('b1000000-0000-4000-8000-000000000001');
insert into public.workspaces(id,name) values ('b2000000-0000-4000-8000-000000000001','Purchase snapshot test');
insert into public.user_workspaces(user_id,workspace_id) values ('b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001');
insert into public.shopping_items(id,workspace_id,name,requested_by,purchase_for,priority,planned_date,note,status)
values ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','螢幕','我','自己','high','2026-09-20','等待優惠','pending');
insert into public.shopping_item_sources(workspace_id,shopping_item_id,platform,url,price,note,sort_order) values
('b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','PChome','https://example.com/a',5988,'送點數',0),
('b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','momo','https://example.com/b',5888,null,1),
('b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','蝦皮','https://example.com/c',null,'看折價券',2);
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
do $$
declare r public.shopping_purchases; copied uuid; backup jsonb;
begin
 select * into r from public.record_shopping_purchase(
  'b2000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',
  '{"name":"螢幕","purchase_date":"2026-09-16","quantity":1,"total_amount":5888,"store":"momo","url":"https://example.com/b","specification":"27吋","note":"實際購買"}'
 );
 assert jsonb_array_length(r.wishlist_snapshot->'sources')=3, 'all quote sources must be captured';
 assert r.wishlist_snapshot->>'requested_by'='我' and r.wishlist_snapshot->>'note'='等待優惠', 'wishlist metadata missing';
 update public.shopping_item_sources set price=1 where shopping_item_id=r.shopping_item_id;
 assert (select (wishlist_snapshot->'sources'->0->>'price')::numeric=5988 from public.shopping_purchases where id=r.id), 'snapshot changed after source edit';
 copied:=public.rebuy_shopping_purchase('b2000000-0000-4000-8000-000000000001',r.id,'b5000000-0000-4000-8000-000000000001');
 assert (select count(*)=3 from public.shopping_item_sources where shopping_item_id=copied), 'rebuy did not restore all sources';
 assert (select requested_by='我' and priority='high' and note='等待優惠' from public.shopping_items where id=copied), 'rebuy did not restore wishlist metadata';
 backup:=public.export_family_backup('b2000000-0000-4000-8000-000000000001');
 assert jsonb_array_length(backup->'shopping_purchases'->0->'wishlist_snapshot'->'sources')=3, 'backup lacks source snapshot';
end $$;
reset role;
rollback;
select 'PASS: complete wishlist snapshot, immutable sources, rebuy and backup';
