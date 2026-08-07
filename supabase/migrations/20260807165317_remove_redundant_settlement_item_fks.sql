-- Composite foreign keys keep settlement items inside the same workspace.
-- The legacy single-column keys are redundant and make PostgREST embeds
-- ambiguous for settlement summary and reconciliation queries.
alter table public.settlement_items
  drop constraint if exists settlement_items_settlement_id_fkey,
  drop constraint if exists settlement_items_split_id_fkey;
