-- Remote migration version: 20261029030948 (bill_notes_zero_due).
-- Additive only: notes belong to each monthly bill, not to a payment/ledger entry.
alter table public.bill_instances add column if not exists note text;
alter table public.bill_instances add constraint bill_instances_note_length_check
  check (note is null or char_length(note) <= 2000);
comment on column public.bill_instances.note is 'Optional bill-only notes; independent of ledger payment notes.';
-- Existing amount_due >= 0 constraint already permits an explicitly entered zero.
-- RLS, grants, payment functions and existing financial records remain unchanged.
