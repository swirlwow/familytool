-- Run in a transaction after the migration. Caller MUST ROLLBACK afterwards.
-- Uses an existing membership for read-only source validation. Only integration
-- rows created by this test are touched, and all changes are rolled back.
do $$
declare member_id uuid;
begin
  select user_id into member_id from public.user_workspaces order by user_id limit 1;
  if member_id is null then raise exception 'TEST_REQUIRES_EXISTING_MEMBER'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',member_id,'role','authenticated')::text,true);
  assert not has_table_privilege('anon','public.google_calendar_connections','select');
  assert not has_function_privilege('anon','public.google_calendar_lock(uuid,uuid)','execute');
  assert not has_function_privilege('anon','public.google_calendar_snapshot(uuid)','execute');
end;
$$;
set local role authenticated;
do $$
declare workspace uuid; token uuid := gen_random_uuid(); snap jsonb; row_count integer;
begin
  select workspace_id into workspace from public.user_workspaces where user_id=auth.uid() order by workspace_id limit 1;
  snap := public.google_calendar_snapshot(workspace);
  select count(*) into row_count from public.notes where workspace_id=workspace and deleted_at is null;
  assert (snap->>'complete')::boolean;
  assert (snap->>'count')::integer = row_count;
  assert jsonb_array_length(snap->'rows') = row_count;
  assert public.google_calendar_lock(workspace,token);
  assert not public.google_calendar_lock(workspace,gen_random_uuid());
  update public.google_calendar_connections set ciphertext='test-ciphertext-not-a-credential'
    where workspace_id=workspace and user_id=auth.uid() and lock_token=token;
  assert found;
  update public.google_calendar_connections set lock_token=null,lock_until=null
    where workspace_id=workspace and user_id=auth.uid() and lock_token=gen_random_uuid();
  assert not found;
  begin
    perform public.google_calendar_snapshot('00000000-0000-4000-8000-000000000099');
    raise exception 'EXPECTED_FORBIDDEN';
  exception when others then
    if sqlerrm <> 'WORKSPACE_FORBIDDEN' then raise; end if;
  end;
end;
$$;
reset role;
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
end; $$;
set local role authenticated;
do $$ begin
  assert not exists(select 1 from public.google_calendar_connections);
  begin
    perform public.google_calendar_lock('00000000-0000-4000-8000-000000000099',gen_random_uuid());
    raise exception 'EXPECTED_FORBIDDEN';
  exception when others then
    if sqlerrm <> 'WORKSPACE_FORBIDDEN' then raise; end if;
  end;
end; $$;
reset role;
select 'PASS: anonymous denied; member snapshot complete; cross-workspace denied; concurrent lock denied; foreign release denied; outsider rows hidden' as verification;
