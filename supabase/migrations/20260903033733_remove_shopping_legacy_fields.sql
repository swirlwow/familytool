-- The only remaining shopping_items rows are user-deleted legacy records.
-- Remove them permanently before dropping the superseded single-source fields.
delete from public.shopping_items
where deleted_at is not null;

alter table public.shopping_items
  drop column if exists url,
  drop column if exists estimated_price,
  drop column if exists platform;
