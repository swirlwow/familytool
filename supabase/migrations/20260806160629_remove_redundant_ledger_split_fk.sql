-- The composite relationship includes workspace ownership and replaces the
-- legacy entry_id-only foreign key. Keeping both makes PostgREST embeds
-- ambiguous for ledger and settlement queries.
alter table public.ledger_splits
  drop constraint if exists ledger_splits_entry_id_fkey;
