alter table public.investment_dividends
  add column if not exists dividend_type text not null default 'cash',
  add column if not exists stock_dividend_rate numeric(20, 6) not null default 0,
  add column if not exists shares_received numeric(20, 6);

alter table public.investment_dividends
  add constraint investment_dividends_type_valid
    check (dividend_type in ('cash', 'stock')),
  add constraint investment_dividends_type_fields_valid
    check (
      (
        dividend_type = 'cash'
        and stock_dividend_rate = 0
        and shares_received is null
      )
      or
      (
        dividend_type = 'stock'
        and dividend_per_share = 0
        and received_amount is null
        and deduction_type is null
        and stock_dividend_rate > 0
        and (shares_received is null or shares_received > 0)
      )
    );
