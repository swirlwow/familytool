-- A settled entry's financial fields and split allocation stay immutable, but
-- descriptive fields do not affect settlement totals and may be corrected.
create or replace function public.update_ledger_entry_with_details(
  p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric,
  p_category_id uuid, p_pay_method text, p_merchant text, p_note text,
  p_payer_id uuid, p_splits jsonb, p_consumption_content text
) returns void language plpgsql security invoker
set search_path = pg_catalog, public, private as $$
declare
  v_entry public.ledger_entries%rowtype;
  v_is_settled boolean;
  v_existing_splits jsonb;
  v_requested_splits jsonb;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if char_length(p_consumption_content) > 1000 then
    raise exception 'consumption content too long';
  end if;

  if coalesce(jsonb_typeof(p_splits), 'array') <> 'array' then
    raise exception 'splits must be an array';
  end if;

  select * into v_entry
  from public.ledger_entries
  where id = p_entry_id and workspace_id = p_workspace_id
  for update;

  if v_entry.id is null then
    raise exception 'ledger entry not found';
  end if;

  select exists (
    select 1
    from public.ledger_splits ls
    join public.settlement_items si
      on si.workspace_id = ls.workspace_id and si.split_id = ls.id
    where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id
  ) into v_is_settled;

  if not v_is_settled then
    perform public.update_ledger_entry_atomic(
      p_workspace_id, p_entry_id, p_entry_date, p_type, p_amount,
      p_category_id, p_pay_method, p_merchant, p_note, p_payer_id, p_splits
    );
    update public.ledger_entries
    set consumption_content = nullif(btrim(p_consumption_content), '')
    where id = p_entry_id and workspace_id = p_workspace_id;
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('payer_id', ls.payer_id, 'amount', ls.amount)
      order by ls.payer_id, ls.amount
    ),
    '[]'::jsonb
  ) into v_existing_splits
  from public.ledger_splits ls
  where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('payer_id', x.payer_id, 'amount', x.amount)
      order by x.payer_id, x.amount
    ),
    '[]'::jsonb
  ) into v_requested_splits
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  if p_entry_date is distinct from v_entry.entry_date
     or p_type is distinct from v_entry.type
     or p_amount is distinct from v_entry.amount
     or p_category_id is distinct from v_entry.category_id
     or p_pay_method is distinct from v_entry.pay_method
     or p_payer_id is distinct from v_entry.payer_id
     or v_requested_splits is distinct from v_existing_splits then
    raise exception 'settled ledger entry financial fields cannot be edited';
  end if;

  update public.ledger_entries
  set merchant = p_merchant,
      note = p_note,
      consumption_content = nullif(btrim(p_consumption_content), '')
  where id = p_entry_id and workspace_id = p_workspace_id;
end;
$$;

notify pgrst, 'reload schema';
