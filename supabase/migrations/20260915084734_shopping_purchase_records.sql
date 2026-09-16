-- Independent snapshots: deleting/editing a wishlist item never erases purchase history.
create table public.shopping_purchases (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 shopping_item_id uuid references public.shopping_items(id) on delete set null,
 request_key uuid not null,
 name text not null check(length(btrim(name)) between 1 and 200),
 purchase_date date,
 quantity numeric(12,3) not null default 1 check(quantity > 0),
 total_amount numeric(14,2) check(total_amount >= 0),
 store text check(length(store)<=120),
 url text check(url is null or (length(url)<=2048 and url ~* '^https?://')),
 specification text check(length(specification)<=300),
 note text check(length(note)<=1000),
 legacy boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 unique(workspace_id,request_key),
 check(legacy or purchase_date is not null)
);
create unique index shopping_purchases_source_active on public.shopping_purchases(shopping_item_id) where shopping_item_id is not null and deleted_at is null;
create index shopping_purchases_workspace_date on public.shopping_purchases(workspace_id,purchase_date desc,id) where deleted_at is null;
alter table public.shopping_purchases enable row level security;
revoke all on public.shopping_purchases from anon,authenticated;
grant select,insert,update,delete on public.shopping_purchases to authenticated;
create policy purchases_workspace on public.shopping_purchases for all to authenticated
 using(workspace_id in(select workspace_id from public.user_workspaces where user_id=(select auth.uid())))
 with check(workspace_id in(select workspace_id from public.user_workspaces where user_id=(select auth.uid()))
 and (shopping_item_id is null or exists(select 1 from public.shopping_items i where i.id=shopping_item_id and i.workspace_id=shopping_purchases.workspace_id)));

-- Preserve old purchased items without guessing the date, amount or store.
insert into public.shopping_purchases(workspace_id,shopping_item_id,request_key,name,note,legacy)
select workspace_id,id,gen_random_uuid(),name,note,true from public.shopping_items where status='purchased' and deleted_at is null;

-- Compatibility for existing clients/status controls. Actual completion inserts the
-- snapshot first; this trigger only fills missing history with clearly unknown values.
create function public.capture_legacy_shopping_purchase() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='purchased' and new.deleted_at is null and
    not exists(select 1 from public.shopping_purchases where shopping_item_id=new.id and deleted_at is null) then
  insert into public.shopping_purchases(workspace_id,shopping_item_id,request_key,name,note,legacy)
  values(new.workspace_id,new.id,gen_random_uuid(),new.name,new.note,true);
 end if;
 return new;
end $$;
create trigger shopping_purchase_compatibility after insert or update of status on public.shopping_items
for each row execute function public.capture_legacy_shopping_purchase();

create function public.record_shopping_purchase(p_workspace uuid,p_key uuid,p_source uuid,p_data jsonb)
returns public.shopping_purchases language plpgsql security invoker set search_path='' as $$
declare r public.shopping_purchases; i public.shopping_items;
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
 end if;
 insert into public.shopping_purchases(workspace_id,shopping_item_id,request_key,name,purchase_date,quantity,total_amount,store,url,specification,note)
 values(p_workspace,p_source,p_key,p_data->>'name',(p_data->>'purchase_date')::date,(p_data->>'quantity')::numeric,
 (p_data->>'total_amount')::numeric,p_data->>'store',p_data->>'url',p_data->>'specification',p_data->>'note') returning * into r;
 if p_source is not null then update public.shopping_items set status='purchased',updated_at=now() where id=p_source and workspace_id=p_workspace; end if;
 return r;
end $$;

create function public.remove_shopping_purchase(p_workspace uuid,p_id uuid,p_restore boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.shopping_purchases;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from public.shopping_purchases where id=p_id and workspace_id=p_workspace for update;
 if not found then raise exception '找不到購買紀錄'; end if;
 if r.deleted_at is not null then return; end if;
 update public.shopping_purchases set deleted_at=now(),updated_at=now() where id=p_id;
 if p_restore and r.shopping_item_id is not null then
  update public.shopping_items set status='pending',deleted_at=null,updated_at=now() where id=r.shopping_item_id and workspace_id=p_workspace;
 end if;
end $$;

create function public.rebuy_shopping_purchase(p_workspace uuid,p_id uuid,p_key uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.shopping_purchases;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from public.shopping_purchases where id=p_id and workspace_id=p_workspace and deleted_at is null;
 if not found then raise exception '找不到購買紀錄'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text||p_key::text,0));
 if exists(select 1 from public.shopping_items where id=p_key and workspace_id=p_workspace) then return p_key; end if;
 insert into public.shopping_items(id,workspace_id,name,note,status) values(p_key,p_workspace,r.name,concat_ws(E'\n',r.specification,r.note),'pending');
 if r.store is not null or r.url is not null then
  insert into public.shopping_item_sources(workspace_id,shopping_item_id,platform,url) values(p_workspace,p_key,r.store,r.url);
 end if;
 return p_key;
end $$;
revoke all on function public.capture_legacy_shopping_purchase(), public.record_shopping_purchase(uuid,uuid,uuid,jsonb), public.remove_shopping_purchase(uuid,uuid,boolean), public.rebuy_shopping_purchase(uuid,uuid,uuid) from public,anon;
grant execute on function public.record_shopping_purchase(uuid,uuid,uuid,jsonb), public.remove_shopping_purchase(uuid,uuid,boolean), public.rebuy_shopping_purchase(uuid,uuid,uuid) to authenticated;

-- Single STABLE invocation: all tables use the caller's statement snapshot and RLS.
-- Numeric fields are stored as decimal strings to avoid JavaScript precision loss.
create or replace function public.export_family_backup(p_workspace_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not exists (select 1 from public.user_workspaces where workspace_id=p_workspace_id and user_id=auth.uid()) then raise exception 'WORKSPACE_FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'workspaces',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.workspaces t where t.id=p_workspace_id),
    'user_workspaces',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.user_workspaces t where t.workspace_id=p_workspace_id),
    'members',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.members t where t.workspace_id=p_workspace_id),
    'accounts',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.accounts t where t.workspace_id=p_workspace_id),
    'account_records',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.account_records t where t.workspace_id=p_workspace_id),
    'bill_templates',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.bill_templates t where t.workspace_id=p_workspace_id),
    'bill_instances',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.bill_instances t where t.workspace_id=p_workspace_id),
    'calendar_events',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.calendar_events t where t.workspace_id=p_workspace_id),
    'categories',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.categories t where t.workspace_id=p_workspace_id),
    'category_groups',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.category_groups t where t.workspace_id=p_workspace_id),
    'ledger_categories',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.ledger_categories t where t.workspace_id=p_workspace_id),
    'ledger_entries',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.ledger_entries t where t.workspace_id=p_workspace_id),
    'ledger_merchants',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.ledger_merchants t where t.workspace_id=p_workspace_id),
    'ledger_splits',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.ledger_splits t where t.workspace_id=p_workspace_id),
    'notes',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.notes t where t.workspace_id=p_workspace_id),
    'payers',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.payers t where t.workspace_id=p_workspace_id),
    'payment_methods',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.payment_methods t where t.workspace_id=p_workspace_id),
    'payments',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.payments t where t.workspace_id=p_workspace_id),
    'settlements',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.settlements t where t.workspace_id=p_workspace_id),
    'settlement_items',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.settlement_items t where t.workspace_id=p_workspace_id),
    'settlement_split_links',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.settlement_split_links t where t.workspace_id=p_workspace_id),
    'stickies',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.stickies t where t.workspace_id=p_workspace_id),
    'sticky_items',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.sticky_items t where t.sticky_id in (select id from public.stickies where workspace_id=p_workspace_id)),
    'shopping_purchases',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.shopping_purchases t where t.workspace_id=p_workspace_id),
    'shopping_items',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.shopping_items t where t.workspace_id=p_workspace_id),
    'shopping_item_sources',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.shopping_item_sources t where t.workspace_id=p_workspace_id),
    'investment_accounts',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.investment_accounts t where t.workspace_id=p_workspace_id),
    'investment_securities',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.investment_securities t where t.workspace_id=p_workspace_id),
    'investment_transactions',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.investment_transactions t where t.workspace_id=p_workspace_id),
    'investment_dividends',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.investment_dividends t where t.workspace_id=p_workspace_id),
    'investment_corporate_actions',(select coalesce(jsonb_agg((select jsonb_object_agg(k,case when jsonb_typeof(v)='number' then to_jsonb(v::text) else v end) from jsonb_each(to_jsonb(t)) e(k,v)) order by t.id),'[]'::jsonb) from public.investment_corporate_actions t where t.workspace_id=p_workspace_id)
  ) into result;
  if octet_length(result::text)>20971520 then raise exception 'BACKUP_TOO_LARGE'; end if;
  return result;
end;
$$;
revoke all on function public.export_family_backup(uuid) from public,anon;
grant execute on function public.export_family_backup(uuid) to authenticated;
