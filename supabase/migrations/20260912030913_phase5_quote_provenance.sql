-- Additive metadata only; existing prices and original investment records are untouched.
alter table public.investment_securities
  add column current_price_source text check (current_price_source in ('manual','realtime_trade','realtime_bid','closing')),
  add column current_price_time time,
  add column quote_fetched_at timestamptz;

create function public.save_investment_quote(
  p_workspace_id uuid, p_security_id uuid, p_price numeric, p_date date,
  p_time time, p_source text, p_market text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_price is null or p_price <= 0 or p_price::text in ('NaN','Infinity','-Infinity')
    or p_date is null or p_date > (now() at time zone 'Asia/Taipei')::date
    or p_source is null or p_source not in ('realtime_trade','realtime_bid','closing')
    or p_market is null or upper(trim(p_market)) not in ('TWSE','TPEX')
  then raise exception 'INVALID_QUOTE'; end if;
  if not exists(select 1 from public.user_workspaces where user_id=auth.uid() and workspace_id=p_workspace_id)
  then raise exception 'WORKSPACE_FORBIDDEN' using errcode='42501'; end if;

  update public.investment_securities set current_price=p_price,current_price_date=p_date,
    current_price_time=p_time,current_price_source=p_source,quote_fetched_at=now(),
    market=upper(trim(p_market)),updated_at=now()
  where id=p_security_id and workspace_id=p_workspace_id
    and (current_price_date is null or p_date>current_price_date or
      (p_date=current_price_date and
        (current_price_time is null or (p_time is not null and p_time>=current_price_time))));
  get diagnostics affected=row_count;
  return affected=1;
end;
$$;
revoke all on function public.save_investment_quote(uuid,uuid,numeric,date,time,text,text) from public,anon;
grant execute on function public.save_investment_quote(uuid,uuid,numeric,date,time,text,text) to authenticated;
