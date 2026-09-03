create table if not exists public.investment_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  broker text,
  currency text not null default 'TWD',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_accounts_name_not_blank check (char_length(btrim(name)) > 0),
  constraint investment_accounts_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint investment_accounts_workspace_name_unique unique (workspace_id, name)
);

create table if not exists public.investment_securities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  symbol text not null,
  name text not null,
  market text not null default 'TWSE',
  currency text not null default 'TWD',
  current_price numeric(20, 6),
  current_price_date date,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_securities_symbol_not_blank check (char_length(btrim(symbol)) > 0),
  constraint investment_securities_name_not_blank check (char_length(btrim(name)) > 0),
  constraint investment_securities_market_not_blank check (char_length(btrim(market)) > 0),
  constraint investment_securities_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint investment_securities_price_nonnegative check (current_price is null or current_price >= 0),
  constraint investment_securities_workspace_market_symbol_unique unique (workspace_id, market, symbol)
);

create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.investment_accounts(id) on delete restrict,
  security_id uuid not null references public.investment_securities(id) on delete restrict,
  transaction_type text not null,
  trade_date date not null,
  quantity numeric(20, 6) not null default 0,
  price numeric(20, 6) not null default 0,
  fee numeric(20, 2) not null default 0,
  tax numeric(20, 2) not null default 0,
  cash_amount numeric(20, 2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_transactions_type_valid check (transaction_type in ('buy', 'sell', 'dividend')),
  constraint investment_transactions_amounts_nonnegative check (
    quantity >= 0 and price >= 0 and fee >= 0 and tax >= 0 and cash_amount >= 0
  ),
  constraint investment_transactions_type_fields_valid check (
    (transaction_type in ('buy', 'sell') and quantity > 0 and price > 0 and cash_amount = 0)
    or
    (transaction_type = 'dividend' and quantity = 0 and price = 0 and cash_amount > 0)
  )
);

create index if not exists investment_accounts_workspace_order_idx
  on public.investment_accounts (workspace_id, is_active desc, sort_order, name);
create index if not exists investment_securities_workspace_order_idx
  on public.investment_securities (workspace_id, is_active desc, sort_order, market, symbol);
create index if not exists investment_transactions_workspace_date_idx
  on public.investment_transactions (workspace_id, trade_date desc, id);
create index if not exists investment_transactions_account_security_date_idx
  on public.investment_transactions (account_id, security_id, trade_date, created_at, id);
create index if not exists investment_transactions_security_id_idx
  on public.investment_transactions (security_id);

alter table public.investment_accounts enable row level security;
alter table public.investment_securities enable row level security;
alter table public.investment_transactions enable row level security;

revoke all on table public.investment_accounts from anon;
revoke all on table public.investment_securities from anon;
revoke all on table public.investment_transactions from anon;
grant select, insert, update, delete on table public.investment_accounts to authenticated;
grant select, insert, update, delete on table public.investment_securities to authenticated;
grant select, insert, update, delete on table public.investment_transactions to authenticated;

drop policy if exists investment_accounts_select_workspace_member on public.investment_accounts;
drop policy if exists investment_accounts_insert_workspace_member on public.investment_accounts;
drop policy if exists investment_accounts_update_workspace_member on public.investment_accounts;
drop policy if exists investment_accounts_delete_workspace_member on public.investment_accounts;
create policy investment_accounts_select_workspace_member on public.investment_accounts for select to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_accounts_insert_workspace_member on public.investment_accounts for insert to authenticated
with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_accounts_update_workspace_member on public.investment_accounts for update to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())))
with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_accounts_delete_workspace_member on public.investment_accounts for delete to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));

drop policy if exists investment_securities_select_workspace_member on public.investment_securities;
drop policy if exists investment_securities_insert_workspace_member on public.investment_securities;
drop policy if exists investment_securities_update_workspace_member on public.investment_securities;
drop policy if exists investment_securities_delete_workspace_member on public.investment_securities;
create policy investment_securities_select_workspace_member on public.investment_securities for select to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_securities_insert_workspace_member on public.investment_securities for insert to authenticated
with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_securities_update_workspace_member on public.investment_securities for update to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())))
with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_securities_delete_workspace_member on public.investment_securities for delete to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));

drop policy if exists investment_transactions_select_workspace_member on public.investment_transactions;
drop policy if exists investment_transactions_insert_workspace_member on public.investment_transactions;
drop policy if exists investment_transactions_update_workspace_member on public.investment_transactions;
drop policy if exists investment_transactions_delete_workspace_member on public.investment_transactions;
create policy investment_transactions_select_workspace_member on public.investment_transactions for select to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_transactions_insert_workspace_member on public.investment_transactions for insert to authenticated
with check (
  workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid()))
  and exists (select 1 from public.investment_accounts a where a.id = account_id and a.workspace_id = workspace_id)
  and exists (select 1 from public.investment_securities s where s.id = security_id and s.workspace_id = workspace_id)
);
create policy investment_transactions_update_workspace_member on public.investment_transactions for update to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())))
with check (
  workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid()))
  and exists (select 1 from public.investment_accounts a where a.id = account_id and a.workspace_id = workspace_id)
  and exists (select 1 from public.investment_securities s where s.id = security_id and s.workspace_id = workspace_id)
);
create policy investment_transactions_delete_workspace_member on public.investment_transactions for delete to authenticated
using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
