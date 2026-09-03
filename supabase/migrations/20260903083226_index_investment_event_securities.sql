create index if not exists investment_dividends_security_id_idx
  on public.investment_dividends (security_id);

create index if not exists investment_corporate_actions_security_id_idx
  on public.investment_corporate_actions (security_id);
