alter table public.ledger_merchants
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by workspace_id
      order by lower(name), created_at, id
    ) * 10 as next_sort_order
  from public.ledger_merchants
)
update public.ledger_merchants merchants
set sort_order = ranked.next_sort_order
from ranked
where merchants.id = ranked.id
  and merchants.sort_order = 0;

create index if not exists ledger_merchants_workspace_sort_idx
  on public.ledger_merchants(workspace_id, sort_order, created_at);
