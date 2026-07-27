-- Refuse to remove the legacy policies until production users are assigned.
do $$
begin
  if exists (select 1 from public.workspaces)
     and not exists (select 1 from public.user_workspaces) then
    raise exception
      'RLS hardening requires at least one user_workspaces row before deployment';
  end if;
end
$$;

-- Replace every legacy/open policy on the application tables in one pass.
do $$
declare
  target_table text;
  existing_policy record;
  target_tables constant text[] := array[
    'account_records',
    'accounts',
    'bill_instances',
    'bill_templates',
    'calendar_events',
    'categories',
    'category_groups',
    'ledger_categories',
    'ledger_entries',
    'ledger_splits',
    'members',
    'notes',
    'payers',
    'payment_methods',
    'payments',
    'settlement_items',
    'settlement_split_links',
    'settlements',
    'stickies',
    'sticky_items',
    'user_workspaces',
    'workspaces'
  ];
begin
  foreach target_table in array target_tables loop
    execute format('alter table public.%I enable row level security', target_table);

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format(
        'drop policy %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;
  end loop;
end
$$;

-- Anonymous users must not be able to reach household or financial data.
revoke all privileges on table
  public.account_records,
  public.accounts,
  public.bill_instances,
  public.bill_templates,
  public.calendar_events,
  public.categories,
  public.category_groups,
  public.ledger_categories,
  public.ledger_entries,
  public.ledger_splits,
  public.members,
  public.notes,
  public.payers,
  public.payment_methods,
  public.payments,
  public.settlement_items,
  public.settlement_split_links,
  public.settlements,
  public.stickies,
  public.sticky_items,
  public.user_workspaces,
  public.workspaces
from anon;

-- Remove broad defaults before granting only the operations the app needs.
revoke all privileges on table
  public.account_records,
  public.accounts,
  public.bill_instances,
  public.bill_templates,
  public.calendar_events,
  public.categories,
  public.category_groups,
  public.ledger_categories,
  public.ledger_entries,
  public.ledger_splits,
  public.members,
  public.notes,
  public.payers,
  public.payment_methods,
  public.payments,
  public.settlement_items,
  public.settlement_split_links,
  public.settlements,
  public.stickies,
  public.sticky_items,
  public.user_workspaces,
  public.workspaces
from authenticated;

grant select, insert, update, delete on table
  public.account_records,
  public.accounts,
  public.bill_instances,
  public.bill_templates,
  public.calendar_events,
  public.categories,
  public.category_groups,
  public.ledger_categories,
  public.ledger_entries,
  public.ledger_splits,
  public.notes,
  public.payers,
  public.payment_methods,
  public.payments,
  public.settlement_items,
  public.settlement_split_links,
  public.settlements,
  public.stickies,
  public.sticky_items
to authenticated;

grant select on table
  public.members,
  public.user_workspaces,
  public.workspaces
to authenticated;

create policy user_workspaces_select_own
on public.user_workspaces
for select
to authenticated
using (user_id = (select auth.uid()));

create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (
  id in (
    select uw.workspace_id
    from public.user_workspaces as uw
    where uw.user_id = (select auth.uid())
  )
);

create policy members_select_workspace_member
on public.members
for select
to authenticated
using (
  workspace_id in (
    select uw.workspace_id
    from public.user_workspaces as uw
    where uw.user_id = (select auth.uid())
  )
);

do $$
declare
  target_table text;
  workspace_tables constant text[] := array[
    'account_records',
    'accounts',
    'bill_instances',
    'bill_templates',
    'calendar_events',
    'categories',
    'category_groups',
    'ledger_categories',
    'ledger_entries',
    'ledger_splits',
    'notes',
    'payers',
    'payment_methods',
    'payments',
    'settlement_items',
    'settlement_split_links',
    'settlements',
    'stickies'
  ];
begin
  foreach target_table in array workspace_tables loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (workspace_id in ('
      || 'select uw.workspace_id from public.user_workspaces as uw '
      || 'where uw.user_id = (select auth.uid())'
      || ')) with check (workspace_id in ('
      || 'select uw.workspace_id from public.user_workspaces as uw '
      || 'where uw.user_id = (select auth.uid())'
      || '))',
      target_table || '_workspace_member_all',
      target_table
    );
  end loop;
end
$$;

create policy sticky_items_workspace_member_all
on public.sticky_items
for all
to authenticated
using (
  exists (
    select 1
    from public.stickies as s
    where s.id = sticky_items.sticky_id
      and s.workspace_id in (
        select uw.workspace_id
        from public.user_workspaces as uw
        where uw.user_id = (select auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.stickies as s
    where s.id = sticky_items.sticky_id
      and s.workspace_id in (
        select uw.workspace_id
        from public.user_workspaces as uw
        where uw.user_id = (select auth.uid())
      )
  )
);

-- The old public helper is no longer needed by any policy.
drop function if exists public.is_workspace_member(uuid);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'alter function public.set_updated_at() set search_path = pg_catalog';
  end if;
end
$$;
