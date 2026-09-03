create table if not exists public.shopping_item_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  shopping_item_id uuid not null references public.shopping_items(id) on delete cascade,
  platform text,
  url text,
  price numeric(12, 2),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_item_sources_content_present check (
    char_length(btrim(coalesce(platform, ''))) > 0
    or char_length(btrim(coalesce(url, ''))) > 0
    or price is not null
    or char_length(btrim(coalesce(note, ''))) > 0
  ),
  constraint shopping_item_sources_url_length check (url is null or char_length(url) <= 2048),
  constraint shopping_item_sources_price_nonnegative check (price is null or price >= 0)
);

create index if not exists shopping_item_sources_item_order_idx
  on public.shopping_item_sources (shopping_item_id, sort_order, created_at);
create index if not exists shopping_item_sources_workspace_item_idx
  on public.shopping_item_sources (workspace_id, shopping_item_id);

alter table public.shopping_item_sources enable row level security;
revoke all on table public.shopping_item_sources from anon, authenticated;
grant select, insert, update, delete on table public.shopping_item_sources to authenticated;

drop policy if exists shopping_item_sources_select_workspace_member on public.shopping_item_sources;
drop policy if exists shopping_item_sources_insert_workspace_member on public.shopping_item_sources;
drop policy if exists shopping_item_sources_update_workspace_member on public.shopping_item_sources;
drop policy if exists shopping_item_sources_delete_workspace_member on public.shopping_item_sources;

create policy shopping_item_sources_select_workspace_member on public.shopping_item_sources for select to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy shopping_item_sources_insert_workspace_member on public.shopping_item_sources for insert to authenticated
with check (
  workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid()))
  and exists (
    select 1 from public.shopping_items item
    where item.id = shopping_item_id and item.workspace_id = workspace_id and item.deleted_at is null
  )
);
create policy shopping_item_sources_update_workspace_member on public.shopping_item_sources for update to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())))
with check (
  workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid()))
  and exists (
    select 1 from public.shopping_items item
    where item.id = shopping_item_id and item.workspace_id = workspace_id and item.deleted_at is null
  )
);
create policy shopping_item_sources_delete_workspace_member on public.shopping_item_sources for delete to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));

insert into public.shopping_item_sources (workspace_id, shopping_item_id, platform, url, price, sort_order)
select item.workspace_id, item.id, item.platform, item.url, item.estimated_price, 10
from public.shopping_items item
where item.deleted_at is null
  and (item.platform is not null or item.url is not null or item.estimated_price is not null)
  and not exists (
    select 1 from public.shopping_item_sources source where source.shopping_item_id = item.id
  );
