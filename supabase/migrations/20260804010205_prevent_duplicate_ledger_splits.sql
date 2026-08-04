-- Reject ambiguous allocations without rewriting or deleting any existing row.
create unique index if not exists ledger_splits_entry_payer_unique
  on public.ledger_splits (workspace_id, entry_id, payer_id);
