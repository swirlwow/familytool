-- Keep the complete wishlist card as an immutable purchase-time snapshot.
alter table public.shopping_purchases
  add column wishlist_snapshot jsonb not null default '{}'::jsonb
  check (jsonb_typeof(wishlist_snapshot) = 'object');

-- Recover the source card for existing purchase records while it is still available.
update public.shopping_purchases p
set wishlist_snapshot = jsonb_build_object(
  'requested_by', i.requested_by, 'purchase_for', i.purchase_for,
  'priority', i.priority, 'planned_date', i.planned_date, 'note', i.note,
  'sources', coalesce((select jsonb_agg(jsonb_build_object(
    'platform',s.platform,'url',s.url,'price',s.price,'note',s.note,'sort_order',s.sort_order
  ) order by s.sort_order,s.created_at,s.id) from public.shopping_item_sources s
    where s.shopping_item_id=i.id and s.workspace_id=i.workspace_id),'[]'::jsonb)
)
from public.shopping_items i
where p.shopping_item_id=i.id and p.workspace_id=i.workspace_id and p.wishlist_snapshot='{}'::jsonb;

create or replace function public.capture_legacy_shopping_purchase() returns trigger
language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb;
begin
 if new.status='purchased' and new.deleted_at is null and
    not exists(select 1 from public.shopping_purchases where shopping_item_id=new.id and deleted_at is null) then
  snapshot := jsonb_build_object(
    'requested_by',new.requested_by,'purchase_for',new.purchase_for,'priority',new.priority,
    'planned_date',new.planned_date,'note',new.note,
    'sources',coalesce((select jsonb_agg(jsonb_build_object(
      'platform',s.platform,'url',s.url,'price',s.price,'note',s.note,'sort_order',s.sort_order
    ) order by s.sort_order,s.created_at,s.id) from public.shopping_item_sources s
      where s.shopping_item_id=new.id and s.workspace_id=new.workspace_id),'[]'::jsonb)
  );
  insert into public.shopping_purchases(workspace_id,shopping_item_id,request_key,name,note,legacy,wishlist_snapshot)
  values(new.workspace_id,new.id,gen_random_uuid(),new.name,new.note,true,snapshot);
 end if;
 return new;
end $$;

create or replace function public.record_shopping_purchase(p_workspace uuid,p_key uuid,p_source uuid,p_data jsonb)
returns public.shopping_purchases language plpgsql security invoker set search_path='' as $$
declare r public.shopping_purchases; i public.shopping_items; snapshot jsonb := '{}'::jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.user_workspaces where workspace_id=p_workspace and user_id=auth.uid()) then raise exception 'WORKSPACE_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text||p_key::text,0));
 select * into r from public.shopping_purchases where workspace_id=p_workspace and request_key=p_key;
 if found then
  if r.deleted_at is not null then raise exception '這次購買已刪除，請重新開啟新增表單'; end if;
  return r;
 end if;
 if p_source is not null then
  select * into i from public.shopping_items where id=p_source and workspace_id=p_workspace and deleted_at is null for update;
  if not found then raise exception '找不到原待購項目'; end if;
  select * into r from public.shopping_purchases where shopping_item_id=p_source and deleted_at is null;
  if found then return r; end if;
  snapshot := jsonb_build_object(
    'requested_by',i.requested_by,'purchase_for',i.purchase_for,'priority',i.priority,
    'planned_date',i.planned_date,'note',i.note,
    'sources',coalesce((select jsonb_agg(jsonb_build_object(
      'platform',s.platform,'url',s.url,'price',s.price,'note',s.note,'sort_order',s.sort_order
    ) order by s.sort_order,s.created_at,s.id) from public.shopping_item_sources s
      where s.shopping_item_id=i.id and s.workspace_id=i.workspace_id),'[]'::jsonb)
  );
 end if;
 insert into public.shopping_purchases(workspace_id,shopping_item_id,request_key,name,purchase_date,quantity,total_amount,store,url,specification,note,wishlist_snapshot)
 values(p_workspace,p_source,p_key,p_data->>'name',(p_data->>'purchase_date')::date,(p_data->>'quantity')::numeric,
 (p_data->>'total_amount')::numeric,p_data->>'store',p_data->>'url',p_data->>'specification',p_data->>'note',snapshot) returning * into r;
 if p_source is not null then update public.shopping_items set status='purchased',updated_at=now() where id=p_source and workspace_id=p_workspace; end if;
 return r;
end $$;

create or replace function public.rebuy_shopping_purchase(p_workspace uuid,p_id uuid,p_key uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.shopping_purchases; snap jsonb; src jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from public.shopping_purchases where id=p_id and workspace_id=p_workspace and deleted_at is null;
 if not found then raise exception '找不到購買紀錄'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text||p_key::text,0));
 if exists(select 1 from public.shopping_items where id=p_key and workspace_id=p_workspace) then return p_key; end if;
 snap := coalesce(r.wishlist_snapshot,'{}'::jsonb);
 insert into public.shopping_items(id,workspace_id,name,requested_by,purchase_for,priority,planned_date,note,status)
 values(p_key,p_workspace,r.name,snap->>'requested_by',snap->>'purchase_for',coalesce(snap->>'priority','normal'),
   (snap->>'planned_date')::date,coalesce(snap->>'note',concat_ws(E'\n',r.specification,r.note)),'pending');
 if jsonb_typeof(snap->'sources')='array' and jsonb_array_length(snap->'sources')>0 then
  for src in select value from jsonb_array_elements(snap->'sources') loop
   insert into public.shopping_item_sources(workspace_id,shopping_item_id,platform,url,price,note,sort_order)
   values(p_workspace,p_key,src->>'platform',src->>'url',(src->>'price')::numeric,src->>'note',coalesce((src->>'sort_order')::integer,0));
  end loop;
 elsif r.store is not null or r.url is not null then
  insert into public.shopping_item_sources(workspace_id,shopping_item_id,platform,url) values(p_workspace,p_key,r.store,r.url);
 end if;
 return p_key;
end $$;
