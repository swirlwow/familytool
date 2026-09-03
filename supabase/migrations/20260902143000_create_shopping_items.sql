create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  url text,
  estimated_price numeric(12, 2),
  platform text,
  requested_by text,
  purchase_for text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  planned_date date,
  status text not null default 'pending' check (status in ('pending', 'planned', 'waiting_sale', 'purchased', 'skipped')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shopping_items_name_not_blank check (char_length(btrim(name)) > 0),
  constraint shopping_items_url_length check (url is null or char_length(url) <= 2048),
  constraint shopping_items_price_nonnegative check (estimated_price is null or estimated_price >= 0)
);

alter table public.shopping_items enable row level security;
revoke all on table public.shopping_items from anon, authenticated;
grant select, insert, update, delete on table public.shopping_items to authenticated;

drop policy if exists shopping_items_select_workspace_member on public.shopping_items;
drop policy if exists shopping_items_insert_workspace_member on public.shopping_items;
drop policy if exists shopping_items_update_workspace_member on public.shopping_items;
drop policy if exists shopping_items_delete_workspace_member on public.shopping_items;

create policy shopping_items_select_workspace_member on public.shopping_items for select to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces as uw where uw.user_id = (select auth.uid())));
create policy shopping_items_insert_workspace_member on public.shopping_items for insert to authenticated
with check (workspace_id in (select uw.workspace_id from public.user_workspaces as uw where uw.user_id = (select auth.uid())));
create policy shopping_items_update_workspace_member on public.shopping_items for update to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces as uw where uw.user_id = (select auth.uid())))
with check (workspace_id in (select uw.workspace_id from public.user_workspaces as uw where uw.user_id = (select auth.uid())));
create policy shopping_items_delete_workspace_member on public.shopping_items for delete to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces as uw where uw.user_id = (select auth.uid())));

create index if not exists shopping_items_workspace_active_order_idx
  on public.shopping_items (workspace_id, status, sort_order, created_at desc) where deleted_at is null;
create index if not exists shopping_items_workspace_planned_date_idx
  on public.shopping_items (workspace_id, planned_date) where deleted_at is null and planned_date is not null;
