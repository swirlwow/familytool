alter table public.ledger_entries
  add column if not exists request_key text;

alter table public.settlements
  add column if not exists request_key text;

create unique index if not exists ledger_entries_workspace_request_key_unique
  on public.ledger_entries (workspace_id, request_key)
  where request_key is not null;

create unique index if not exists settlements_workspace_request_key_unique
  on public.settlements (workspace_id, request_key)
  where request_key is not null;

create or replace function private.assert_workspace_member(p_workspace_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_workspaces uw
    where uw.user_id = auth.uid()
      and uw.workspace_id = p_workspace_id
  ) then
    raise exception 'workspace access denied' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_workspace_member(uuid)
  from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.assert_workspace_member(uuid)
  to authenticated;

create or replace function public.create_ledger_entry_atomic(
  p_workspace_id uuid,
  p_entry_date date,
  p_type text,
  p_amount numeric,
  p_category_id uuid,
  p_pay_method text,
  p_merchant text,
  p_note text,
  p_bill_instance_id uuid,
  p_payer_id uuid,
  p_splits jsonb,
  p_request_key text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_entry_id uuid;
  v_split_total numeric;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_entry_date is null or p_type not in ('expense', 'income') or p_amount <= 0 then
    raise exception 'invalid ledger entry';
  end if;

  if p_request_key is not null then
    select id into v_entry_id
    from public.ledger_entries
    where workspace_id = p_workspace_id
      and request_key = p_request_key;
    if v_entry_id is not null then
      return v_entry_id;
    end if;
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.ledger_categories
    where id = p_category_id and workspace_id = p_workspace_id
  ) then
    raise exception 'category does not belong to workspace';
  end if;

  if p_payer_id is not null and not exists (
    select 1 from public.payers
    where id = p_payer_id and workspace_id = p_workspace_id
  ) then
    raise exception 'payer does not belong to workspace';
  end if;

  if coalesce(jsonb_typeof(p_splits), 'array') <> 'array' then
    raise exception 'splits must be an array';
  end if;

  select coalesce(sum(x.amount), 0)
    into v_split_total
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  if v_split_total > 0 then
    if p_type <> 'expense' or p_payer_id is null or v_split_total > p_amount then
      raise exception 'invalid split allocation';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_splits) as x(payer_id uuid, amount numeric)
      where x.payer_id is null
        or x.payer_id = p_payer_id
        or x.amount <= 0
        or not exists (
          select 1 from public.payers p
          where p.id = x.payer_id and p.workspace_id = p_workspace_id
        )
    ) then
      raise exception 'invalid split participant';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_splits) as x(payer_id uuid, amount numeric)
      group by x.payer_id
      having count(*) > 1
    ) then
      raise exception 'duplicate split participant';
    end if;
  end if;

  insert into public.ledger_entries (
    workspace_id, entry_date, type, amount, category_id, pay_method,
    merchant, note, bill_instance_id, payer_id, request_key
  ) values (
    p_workspace_id, p_entry_date, p_type, p_amount, p_category_id, p_pay_method,
    p_merchant, p_note, p_bill_instance_id, p_payer_id, p_request_key
  )
  returning id into v_entry_id;

  insert into public.ledger_splits (workspace_id, entry_id, payer_id, amount)
  select p_workspace_id, v_entry_id, x.payer_id, x.amount
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  return v_entry_id;
end;
$$;

create or replace function public.update_ledger_entry_atomic(
  p_workspace_id uuid,
  p_entry_id uuid,
  p_entry_date date,
  p_type text,
  p_amount numeric,
  p_category_id uuid,
  p_pay_method text,
  p_merchant text,
  p_note text,
  p_payer_id uuid,
  p_splits jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_locked_id uuid;
  v_split_total numeric;
begin
  perform private.assert_workspace_member(p_workspace_id);

  select id into v_locked_id
  from public.ledger_entries
  where id = p_entry_id and workspace_id = p_workspace_id
  for update;

  if v_locked_id is null then
    raise exception 'ledger entry not found';
  end if;

  if exists (
    select 1
    from public.ledger_splits ls
    join public.settlement_items si
      on si.workspace_id = ls.workspace_id and si.split_id = ls.id
    where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id
  ) then
    raise exception 'settled ledger entry cannot be edited';
  end if;

  if p_entry_date is null or p_type not in ('expense', 'income') or p_amount <= 0 then
    raise exception 'invalid ledger entry';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.ledger_categories
    where id = p_category_id and workspace_id = p_workspace_id
  ) then
    raise exception 'category does not belong to workspace';
  end if;

  if p_payer_id is not null and not exists (
    select 1 from public.payers
    where id = p_payer_id and workspace_id = p_workspace_id
  ) then
    raise exception 'payer does not belong to workspace';
  end if;

  select coalesce(sum(x.amount), 0)
    into v_split_total
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  if v_split_total > 0 and (
    p_type <> 'expense' or p_payer_id is null or v_split_total > p_amount
  ) then
    raise exception 'invalid split allocation';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
      as x(payer_id uuid, amount numeric)
    where x.payer_id is null
      or x.payer_id = p_payer_id
      or x.amount <= 0
      or not exists (
        select 1 from public.payers p
        where p.id = x.payer_id and p.workspace_id = p_workspace_id
      )
  ) then
    raise exception 'invalid split participant';
  end if;

  update public.ledger_entries
  set entry_date = p_entry_date,
      type = p_type,
      amount = p_amount,
      category_id = p_category_id,
      pay_method = p_pay_method,
      merchant = p_merchant,
      note = p_note,
      payer_id = p_payer_id
  where id = p_entry_id and workspace_id = p_workspace_id;

  delete from public.ledger_splits
  where workspace_id = p_workspace_id and entry_id = p_entry_id;

  insert into public.ledger_splits (workspace_id, entry_id, payer_id, amount)
  select p_workspace_id, p_entry_id, x.payer_id, x.amount
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);
end;
$$;

create or replace function public.delete_ledger_entry_atomic(
  p_workspace_id uuid,
  p_entry_id uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_workspace_member(p_workspace_id);

  if exists (
    select 1
    from public.ledger_splits ls
    join public.settlement_items si
      on si.workspace_id = ls.workspace_id and si.split_id = ls.id
    where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id
  ) then
    raise exception 'settled ledger entry cannot be deleted';
  end if;

  delete from public.ledger_entries
  where workspace_id = p_workspace_id and id = p_entry_id;

  if not found then
    raise exception 'ledger entry not found';
  end if;
end;
$$;

create or replace function public.pay_bill_to_ledger_atomic(
  p_workspace_id uuid,
  p_bill_instance_id uuid,
  p_pay_amount numeric,
  p_entry_date date,
  p_payer_id uuid,
  p_pay_method text,
  p_category_id uuid,
  p_merchant text,
  p_note text,
  p_splits jsonb,
  p_request_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_bill public.bill_instances%rowtype;
  v_entry_id uuid;
  v_next_paid numeric;
  v_next_status text;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_request_key is null or length(p_request_key) < 16 then
    raise exception 'request key is required';
  end if;

  select * into v_bill
  from public.bill_instances
  where id = p_bill_instance_id and workspace_id = p_workspace_id
  for update;

  if v_bill.id is null then
    raise exception 'bill not found';
  end if;

  if v_bill.payment_mode = 'status_only' then
    raise exception 'status-only bill cannot create ledger entry';
  end if;

  select id into v_entry_id
  from public.ledger_entries
  where workspace_id = p_workspace_id and request_key = p_request_key;

  if v_entry_id is not null then
    return jsonb_build_object(
      'ledger_entry_id', v_entry_id,
      'bill_instance_id', v_bill.id,
      'paid_total', v_bill.paid_total,
      'status', v_bill.status,
      'remaining', greatest(coalesce(v_bill.amount_due, 0) - v_bill.paid_total, 0),
      'already_processed', true
    );
  end if;

  if p_pay_amount <= 0
     or v_bill.amount_due is null
     or p_pay_amount > v_bill.amount_due - v_bill.paid_total then
    raise exception 'invalid payment amount';
  end if;

  v_entry_id := public.create_ledger_entry_atomic(
    p_workspace_id,
    p_entry_date,
    'expense',
    p_pay_amount,
    p_category_id,
    p_pay_method,
    p_merchant,
    coalesce(p_note, 'Bill payment: ' || v_bill.name_snapshot),
    p_bill_instance_id,
    p_payer_id,
    p_splits,
    p_request_key
  );

  v_next_paid := round(v_bill.paid_total + p_pay_amount, 2);
  v_next_status := case
    when v_next_paid >= v_bill.amount_due then 'paid'
    else 'partial'
  end;

  update public.bill_instances
  set paid_total = v_next_paid,
      status = v_next_status,
      paid_at = case when v_next_status = 'paid' then now() else paid_at end
  where id = v_bill.id and workspace_id = p_workspace_id;

  return jsonb_build_object(
    'ledger_entry_id', v_entry_id,
    'bill_instance_id', v_bill.id,
    'paid_total', v_next_paid,
    'status', v_next_status,
    'remaining', greatest(v_bill.amount_due - v_next_paid, 0),
    'already_processed', false
  );
end;
$$;

create or replace function public.create_settlement_atomic(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_amount numeric,
  p_note text,
  p_split_id uuid,
  p_request_key text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_settlement_id uuid;
  v_remaining numeric := p_amount;
  v_take numeric;
  v_split record;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_request_key is null or length(p_request_key) < 16 then
    raise exception 'request key is required';
  end if;

  if p_from is null or p_to is null or p_from > p_to
     or p_amount <= 0 or p_debtor_id = p_creditor_id then
    raise exception 'invalid settlement';
  end if;

  if not exists (
    select 1 from public.payers
    where id = p_debtor_id and workspace_id = p_workspace_id
  ) or not exists (
    select 1 from public.payers
    where id = p_creditor_id and workspace_id = p_workspace_id
  ) then
    raise exception 'settlement participant does not belong to workspace';
  end if;

  select id into v_settlement_id
  from public.settlements
  where workspace_id = p_workspace_id and request_key = p_request_key;
  if v_settlement_id is not null then
    return v_settlement_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_workspace_id::text || ':' || p_debtor_id::text || ':' || p_creditor_id::text,
      0
    )
  );

  select id into v_settlement_id
  from public.settlements
  where workspace_id = p_workspace_id and request_key = p_request_key;
  if v_settlement_id is not null then
    return v_settlement_id;
  end if;

  insert into public.settlements (
    workspace_id, debtor_id, creditor_id, amount, from_date, to_date,
    note, from_payer_id, to_payer_id, request_key
  ) values (
    p_workspace_id, p_debtor_id, p_creditor_id, p_amount, p_from, p_to,
    p_note, p_debtor_id, p_creditor_id, p_request_key
  )
  returning id into v_settlement_id;

  for v_split in
    select
      ls.id,
      greatest(
        ls.amount - coalesce((
          select sum(si.amount)
          from public.settlement_items si
          where si.workspace_id = p_workspace_id and si.split_id = ls.id
        ), 0),
        0
      ) as remaining_amount
    from public.ledger_splits ls
    join public.ledger_entries le
      on le.workspace_id = ls.workspace_id and le.id = ls.entry_id
    where ls.workspace_id = p_workspace_id
      and le.type = 'expense'
      and le.entry_date between p_from and p_to
      and ls.payer_id = p_debtor_id
      and le.payer_id = p_creditor_id
      and (p_split_id is null or ls.id = p_split_id)
    order by le.entry_date, ls.id
    for update of ls
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_split.remaining_amount);
    if v_take > 0 then
      insert into public.settlement_items (
        workspace_id, settlement_id, split_id, amount
      ) values (
        p_workspace_id, v_settlement_id, v_split.id, v_take
      );
      v_remaining := round(v_remaining - v_take, 2);
    end if;
  end loop;

  if p_split_id is not null and v_remaining > 0 then
    raise exception 'settlement exceeds split remaining amount';
  end if;

  return v_settlement_id;
end;
$$;

create or replace function public.undo_settlement_item_atomic(
  p_workspace_id uuid,
  p_item_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_item public.settlement_items%rowtype;
  v_header public.settlements%rowtype;
  v_next_amount numeric;
begin
  perform private.assert_workspace_member(p_workspace_id);

  select * into v_item
  from public.settlement_items
  where id = p_item_id and workspace_id = p_workspace_id
  for update;
  if v_item.id is null then
    raise exception 'settlement item not found';
  end if;

  select * into v_header
  from public.settlements
  where id = v_item.settlement_id and workspace_id = p_workspace_id
  for update;

  delete from public.settlement_items
  where id = v_item.id and workspace_id = p_workspace_id;

  v_next_amount := round(v_header.amount - v_item.amount, 2);
  if v_next_amount <= 0 then
    delete from public.settlements
    where id = v_header.id and workspace_id = p_workspace_id;
  else
    update public.settlements
    set amount = v_next_amount
    where id = v_header.id and workspace_id = p_workspace_id;
  end if;

  return v_header.id;
end;
$$;

create or replace function public.delete_settlement_atomic(
  p_workspace_id uuid,
  p_settlement_id uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_workspace_member(p_workspace_id);

  delete from public.settlements
  where id = p_settlement_id and workspace_id = p_workspace_id;
  if not found then
    raise exception 'settlement not found';
  end if;
end;
$$;

revoke all on function public.create_ledger_entry_atomic(
  uuid, date, text, numeric, uuid, text, text, text, uuid, uuid, jsonb, text
) from public, anon;
revoke all on function public.update_ledger_entry_atomic(
  uuid, uuid, date, text, numeric, uuid, text, text, text, uuid, jsonb
) from public, anon;
revoke all on function public.delete_ledger_entry_atomic(uuid, uuid)
  from public, anon;
revoke all on function public.pay_bill_to_ledger_atomic(
  uuid, uuid, numeric, date, uuid, text, uuid, text, text, jsonb, text
) from public, anon;
revoke all on function public.create_settlement_atomic(
  uuid, date, date, uuid, uuid, numeric, text, uuid, text
) from public, anon;
revoke all on function public.undo_settlement_item_atomic(uuid, uuid)
  from public, anon;
revoke all on function public.delete_settlement_atomic(uuid, uuid)
  from public, anon;

grant execute on function public.create_ledger_entry_atomic(
  uuid, date, text, numeric, uuid, text, text, text, uuid, uuid, jsonb, text
) to authenticated;
grant execute on function public.update_ledger_entry_atomic(
  uuid, uuid, date, text, numeric, uuid, text, text, text, uuid, jsonb
) to authenticated;
grant execute on function public.delete_ledger_entry_atomic(uuid, uuid)
  to authenticated;
grant execute on function public.pay_bill_to_ledger_atomic(
  uuid, uuid, numeric, date, uuid, text, uuid, text, text, jsonb, text
) to authenticated;
grant execute on function public.create_settlement_atomic(
  uuid, date, date, uuid, uuid, numeric, text, uuid, text
) to authenticated;
grant execute on function public.undo_settlement_item_atomic(uuid, uuid)
  to authenticated;
grant execute on function public.delete_settlement_atomic(uuid, uuid)
  to authenticated;
