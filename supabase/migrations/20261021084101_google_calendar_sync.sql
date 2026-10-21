-- Applied migration version matches Supabase history: 20261021084101.
-- Independent integration state; no changes to existing notes or calendar behavior.
create table public.google_calendar_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ciphertext text,
  lock_token uuid,
  lock_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from anon, public;
grant select, insert, update on public.google_calendar_connections to authenticated;
create policy google_calendar_own_member on public.google_calendar_connections
  for all to authenticated
  using (user_id = (select auth.uid()) and workspace_id in
    (select workspace_id from public.user_workspaces where user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and workspace_id in
    (select workspace_id from public.user_workspaces where user_id = (select auth.uid())));

create function public.google_calendar_lock(p_workspace uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null or not exists(select 1 from public.user_workspaces
    where user_id = auth.uid() and workspace_id = p_workspace) then
    raise exception 'WORKSPACE_FORBIDDEN';
  end if;
  insert into public.google_calendar_connections(user_id, workspace_id)
    values(auth.uid(), p_workspace) on conflict do nothing;
  update public.google_calendar_connections
    set lock_token = p_token, lock_until = clock_timestamp() + interval '10 minutes'
    where user_id = auth.uid() and workspace_id = p_workspace
      and (lock_until is null or lock_until < clock_timestamp());
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

-- One statement snapshot, not paginated/filtered calendar UI data. JSON aggregate
-- avoids the REST row limit. Explicit membership prevents empty-RLS-as-empty-calendar.
create function public.google_calendar_snapshot(p_workspace uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare rows jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.user_workspaces
    where user_id = auth.uid() and workspace_id = p_workspace) then
    raise exception 'WORKSPACE_FORBIDDEN';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'title', n.title, 'content', coalesce(n.content,''),
    'owner', coalesce(n.owner,'家庭'), 'note_date', n.note_date,
    'date_from', n.date_from, 'date_to', n.date_to, 'updated_at', n.updated_at
  ) order by n.id), '[]'::jsonb) into rows
  from public.notes n where n.workspace_id = p_workspace and n.deleted_at is null;
  if jsonb_array_length(rows) > 5000 then raise exception 'CALENDAR_TOO_LARGE'; end if;
  return jsonb_build_object('rows', rows, 'count', jsonb_array_length(rows),
    'revision', md5(rows::text), 'complete', true);
end;
$$;
revoke all on function public.google_calendar_lock(uuid,uuid) from public, anon;
revoke all on function public.google_calendar_snapshot(uuid) from public, anon;
grant execute on function public.google_calendar_lock(uuid,uuid) to authenticated;
grant execute on function public.google_calendar_snapshot(uuid) to authenticated;
