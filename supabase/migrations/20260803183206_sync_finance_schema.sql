alter table public.payers
  add column if not exists name text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

alter table public.payment_methods
  add column if not exists name text not null default '',
  add column if not exists sort integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists sort_order integer not null default 0;

alter table public.ledger_categories
  add column if not exists name text not null default '',
  add column if not exists type text not null default 'expense',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists group_name text,
  add column if not exists sort_order integer default 0,
  add column if not exists is_active boolean default true;

alter table public.ledger_entries
  add column if not exists entry_date date,
  add column if not exists type text not null default 'expense',
  add column if not exists amount numeric,
  add column if not exists category_id uuid,
  add column if not exists pay_method text,
  add column if not exists merchant text,
  add column if not exists note text,
  add column if not exists bill_instance_id uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists payer_id uuid;

alter table public.ledger_splits
  add column if not exists entry_id uuid,
  add column if not exists payer_id uuid,
  add column if not exists amount numeric,
  add column if not exists created_at timestamptz not null default now();

alter table public.settlements
  add column if not exists debtor_id uuid,
  add column if not exists creditor_id uuid,
  add column if not exists amount numeric,
  add column if not exists settled_date date not null default ((now() at time zone 'utc'))::date,
  add column if not exists note text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists from_date date,
  add column if not exists to_date date,
  add column if not exists from_payer_id uuid,
  add column if not exists to_payer_id uuid;

alter table public.settlement_items
  add column if not exists settlement_id uuid,
  add column if not exists split_id uuid,
  add column if not exists amount numeric,
  add column if not exists created_at timestamptz not null default now();

alter table public.ledger_entries
  alter column entry_date set not null,
  alter column amount set not null;

alter table public.ledger_splits
  alter column entry_id set not null,
  alter column payer_id set not null,
  alter column amount set not null;

alter table public.settlements
  alter column debtor_id set not null,
  alter column creditor_id set not null,
  alter column amount set not null;

alter table public.settlement_items
  alter column settlement_id set not null,
  alter column split_id set not null,
  alter column amount set not null;

create unique index if not exists ledger_entries_workspace_id_id_key
  on public.ledger_entries (workspace_id, id);

create unique index if not exists ledger_splits_workspace_id_id_key
  on public.ledger_splits (workspace_id, id);

create unique index if not exists settlements_workspace_id_id_key
  on public.settlements (workspace_id, id);

create index if not exists ledger_entries_workspace_date_idx
  on public.ledger_entries (workspace_id, entry_date desc);

create index if not exists ledger_splits_workspace_entry_idx
  on public.ledger_splits (workspace_id, entry_id);

create index if not exists settlement_items_workspace_settlement_idx
  on public.settlement_items (workspace_id, settlement_id);

create index if not exists settlement_items_workspace_split_idx
  on public.settlement_items (workspace_id, split_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ledger_entries_type_check'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_type_check
      check (type in ('expense', 'income'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ledger_entries_amount_check'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_amount_check check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ledger_splits_amount_positive_check'
  ) then
    alter table public.ledger_splits
      add constraint ledger_splits_amount_positive_check check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_amount_positive_check'
  ) then
    alter table public.settlements
      add constraint settlements_amount_positive_check check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'settlement_items_amount_positive_check'
  ) then
    alter table public.settlement_items
      add constraint settlement_items_amount_positive_check check (amount > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ledger_splits_workspace_entry_fkey'
  ) then
    alter table public.ledger_splits
      add constraint ledger_splits_workspace_entry_fkey
      foreign key (workspace_id, entry_id)
      references public.ledger_entries (workspace_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'settlement_items_workspace_settlement_fkey'
  ) then
    alter table public.settlement_items
      add constraint settlement_items_workspace_settlement_fkey
      foreign key (workspace_id, settlement_id)
      references public.settlements (workspace_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'settlement_items_workspace_split_fkey'
  ) then
    alter table public.settlement_items
      add constraint settlement_items_workspace_split_fkey
      foreign key (workspace_id, split_id)
      references public.ledger_splits (workspace_id, id)
      on delete restrict;
  end if;
end
$$;
