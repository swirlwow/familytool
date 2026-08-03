alter table public.notes
  add column if not exists title text not null default '',
  add column if not exists content text not null default '',
  add column if not exists note_date date,
  add column if not exists is_important boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz,
  add column if not exists date_from date,
  add column if not exists date_to date,
  add column if not exists owner text not null default U&'\5BB6\5EAD';

create index if not exists idx_notes_workspace_date_from
  on public.notes (workspace_id, date_from);

create index if not exists idx_notes_workspace_date_to
  on public.notes (workspace_id, date_to);

create index if not exists notes_deleted_at_idx
  on public.notes (workspace_id, deleted_at);

create index if not exists notes_note_date_idx
  on public.notes (workspace_id, note_date);

drop trigger if exists trg_notes_updated_at on public.notes;

create trigger trg_notes_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();
