drop index if exists public.investment_transactions_order_unique_idx;

create unique index investment_transactions_order_unique_idx
  on public.investment_transactions (
    workspace_id,
    account_id,
    trade_date,
    upper(btrim(order_number))
  )
  where order_number is not null and btrim(order_number) <> '';
