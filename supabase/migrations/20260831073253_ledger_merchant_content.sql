-- Additive change: historical merchant and note text remain untouched.
alter table public.ledger_entries add column consumption_content text
  check (consumption_content is null or char_length(consumption_content) <= 1000);

create table public.ledger_merchants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index ledger_merchants_workspace_name_key
  on public.ledger_merchants(workspace_id, lower(name));
alter table public.ledger_merchants enable row level security;
revoke all on public.ledger_merchants from public, anon, authenticated;
grant select, insert, update on public.ledger_merchants to authenticated;
create policy ledger_merchants_workspace_access on public.ledger_merchants
  for all to authenticated
  using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())))
  with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));

insert into public.ledger_merchants(workspace_id, name)
select w.id, v.name from public.workspaces w
cross join (values ('蝦皮'), ('momo'), ('PChome'), ('全聯'), ('7-ELEVEN'), ('全家')) v(name);

-- Keep original RPCs intact: existing bill payments and older clients still work.
create function public.create_ledger_entry_with_details(
  p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric,
  p_category_id uuid, p_pay_method text, p_merchant text, p_note text,
  p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text,
  p_consumption_content text
) returns uuid language plpgsql security invoker
set search_path = pg_catalog, public, private as $$
declare v_id uuid;
begin
  perform private.assert_workspace_member(p_workspace_id);
  if char_length(p_consumption_content) > 1000 then raise exception 'consumption content too long'; end if;
  if p_request_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_request_key, 0));
    select id into v_id from public.ledger_entries
      where workspace_id = p_workspace_id and request_key = p_request_key;
    if v_id is not null then return v_id; end if;
  end if;
  v_id := public.create_ledger_entry_atomic(p_workspace_id, p_entry_date, p_type, p_amount,
    p_category_id, p_pay_method, p_merchant, p_note, p_bill_instance_id, p_payer_id, p_splits, p_request_key);
  update public.ledger_entries set consumption_content = nullif(btrim(p_consumption_content), '')
    where id = v_id and workspace_id = p_workspace_id;
  return v_id;
end;
$$;

create function public.update_ledger_entry_with_details(
  p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric,
  p_category_id uuid, p_pay_method text, p_merchant text, p_note text,
  p_payer_id uuid, p_splits jsonb, p_consumption_content text
) returns void language plpgsql security invoker
set search_path = pg_catalog, public, private as $$
begin
  if char_length(p_consumption_content) > 1000 then raise exception 'consumption content too long'; end if;
  -- Original RPC keeps row locking, split validation and settled-entry protection.
  perform public.update_ledger_entry_atomic(p_workspace_id, p_entry_id, p_entry_date, p_type,
    p_amount, p_category_id, p_pay_method, p_merchant, p_note, p_payer_id, p_splits);
  update public.ledger_entries set consumption_content = nullif(btrim(p_consumption_content), '')
    where id = p_entry_id and workspace_id = p_workspace_id;
end;
$$;
revoke all on function public.create_ledger_entry_with_details(uuid,date,text,numeric,uuid,text,text,text,uuid,uuid,jsonb,text,text) from public, anon;
revoke all on function public.update_ledger_entry_with_details(uuid,uuid,date,text,numeric,uuid,text,text,text,uuid,jsonb,text) from public, anon;
grant execute on function public.create_ledger_entry_with_details(uuid,date,text,numeric,uuid,text,text,text,uuid,uuid,jsonb,text,text) to authenticated;
grant execute on function public.update_ledger_entry_with_details(uuid,uuid,date,text,numeric,uuid,text,text,text,uuid,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
