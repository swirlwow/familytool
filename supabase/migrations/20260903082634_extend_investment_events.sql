alter table public.investment_transactions
  add column if not exists settlement_amount numeric(20, 2),
  add column if not exists order_number text,
  add column if not exists currency text not null default 'TWD',
  add column if not exists source text not null default 'manual';

alter table public.investment_transactions
  add constraint investment_transactions_settlement_nonnegative check (settlement_amount is null or settlement_amount >= 0),
  add constraint investment_transactions_currency_format check (currency ~ '^[A-Z]{3}$'),
  add constraint investment_transactions_source_valid check (source in ('manual', 'csv', 'excel'));

create unique index if not exists investment_transactions_order_unique_idx
  on public.investment_transactions (workspace_id, account_id, trade_date, order_number)
  where order_number is not null;

create table if not exists public.investment_dividends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.investment_accounts(id) on delete restrict,
  security_id uuid not null references public.investment_securities(id) on delete restrict,
  ex_dividend_date date not null,
  eligible_quantity numeric(20, 6) not null,
  dividend_per_share numeric(20, 6) not null,
  payment_date date,
  received_amount numeric(20, 2),
  deduction_type text,
  status text not null default 'pending',
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_dividends_values_valid check (eligible_quantity > 0 and dividend_per_share >= 0 and (received_amount is null or received_amount >= 0)),
  constraint investment_dividends_status_valid check (status in ('pending', 'received')),
  constraint investment_dividends_source_valid check (source in ('manual', 'csv', 'excel')),
  constraint investment_dividends_deduction_type_valid check (deduction_type is null or deduction_type in ('transfer_fee', 'nhi', 'withholding_tax', 'other', 'unclassified'))
);

create table if not exists public.investment_corporate_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.investment_accounts(id) on delete restrict,
  security_id uuid not null references public.investment_securities(id) on delete restrict,
  action_type text not null,
  event_date date not null,
  quantity_before numeric(20, 6) not null,
  reduction_ratio numeric(12, 8) not null,
  quantity_after numeric(20, 6) not null,
  cash_return numeric(20, 2) not null default 0,
  cost_adjustment numeric(20, 2) not null default 0,
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_corporate_actions_type_valid check (action_type in ('capital_reduction', 'loss_reduction')),
  constraint investment_corporate_actions_values_valid check (quantity_before > 0 and reduction_ratio > 0 and reduction_ratio < 1 and quantity_after >= 0 and quantity_after < quantity_before and cash_return >= 0 and cost_adjustment >= 0),
  constraint investment_corporate_actions_source_valid check (source in ('manual', 'csv', 'excel'))
);

create index if not exists investment_dividends_workspace_date_idx on public.investment_dividends (workspace_id, ex_dividend_date desc, id);
create index if not exists investment_dividends_account_security_date_idx on public.investment_dividends (account_id, security_id, ex_dividend_date, created_at, id);
create index if not exists investment_corporate_actions_workspace_date_idx on public.investment_corporate_actions (workspace_id, event_date desc, id);
create index if not exists investment_corporate_actions_account_security_date_idx on public.investment_corporate_actions (account_id, security_id, event_date, created_at, id);

alter table public.investment_dividends enable row level security;
alter table public.investment_corporate_actions enable row level security;
revoke all on table public.investment_dividends from anon;
revoke all on table public.investment_corporate_actions from anon;
grant select, insert, update, delete on table public.investment_dividends to authenticated;
grant select, insert, update, delete on table public.investment_corporate_actions to authenticated;

create policy investment_dividends_select_workspace_member on public.investment_dividends for select to authenticated using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_dividends_insert_workspace_member on public.investment_dividends for insert to authenticated with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())) and exists (select 1 from public.investment_accounts a where a.id = account_id and a.workspace_id = workspace_id) and exists (select 1 from public.investment_securities s where s.id = security_id and s.workspace_id = workspace_id));
create policy investment_dividends_update_workspace_member on public.investment_dividends for update to authenticated using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid()))) with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())) and exists (select 1 from public.investment_accounts a where a.id = account_id and a.workspace_id = workspace_id) and exists (select 1 from public.investment_securities s where s.id = security_id and s.workspace_id = workspace_id));
create policy investment_dividends_delete_workspace_member on public.investment_dividends for delete to authenticated using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));

create policy investment_corporate_actions_select_workspace_member on public.investment_corporate_actions for select to authenticated using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
create policy investment_corporate_actions_insert_workspace_member on public.investment_corporate_actions for insert to authenticated with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())) and exists (select 1 from public.investment_accounts a where a.id = account_id and a.workspace_id = workspace_id) and exists (select 1 from public.investment_securities s where s.id = security_id and s.workspace_id = workspace_id));
create policy investment_corporate_actions_update_workspace_member on public.investment_corporate_actions for update to authenticated using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid()))) with check (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())) and exists (select 1 from public.investment_accounts a where a.id = account_id and a.workspace_id = workspace_id) and exists (select 1 from public.investment_securities s where s.id = security_id and s.workspace_id = workspace_id));
create policy investment_corporate_actions_delete_workspace_member on public.investment_corporate_actions for delete to authenticated using (workspace_id in (select uw.workspace_id from public.user_workspaces uw where uw.user_id = (select auth.uid())));
