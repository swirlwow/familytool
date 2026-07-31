create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

alter table public.bill_templates
  add column if not exists name text,
  add column if not exists amount_default numeric,
  add column if not exists schedule_type text not null default 'monthly',
  add column if not exists due_day integer,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists amount_mode text not null default 'fixed',
  add column if not exists schedule_months smallint[],
  add column if not exists generate_day smallint not null default 1,
  add column if not exists payment_mode text not null default 'ledger',
  add column if not exists starts_on date not null default date_trunc('month', current_date)::date,
  add column if not exists ends_on date;

alter table public.bill_templates
  alter column name set not null;

alter table public.bill_instances
  add column if not exists template_id uuid references public.bill_templates(id) on delete set null,
  add column if not exists period text,
  add column if not exists due_date date,
  add column if not exists name_snapshot text,
  add column if not exists amount_due numeric,
  add column if not exists status text not null default 'unpaid',
  add column if not exists paid_total numeric not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists billing_start date,
  add column if not exists billing_end date,
  add column if not exists source text not null default 'manual',
  add column if not exists payment_mode text not null default 'ledger',
  add column if not exists paid_at timestamptz;

alter table public.bill_instances
  alter column period set not null,
  alter column due_date drop not null,
  alter column name_snapshot set not null,
  alter column amount_due drop not null;

alter table public.bill_templates
  add constraint bill_templates_amount_mode_check
    check (amount_mode in ('fixed', 'variable')) not valid,
  add constraint bill_templates_schedule_type_check
    check (schedule_type in ('monthly', 'months')) not valid,
  add constraint bill_templates_schedule_months_check
    check (
      schedule_type = 'monthly'
      or (
        schedule_months is not null
        and
        cardinality(schedule_months) > 0
        and schedule_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
      )
    ) not valid,
  add constraint bill_templates_generate_day_check
    check (generate_day between 1 and 28) not valid,
  add constraint bill_templates_due_day_check
    check (due_day is null or due_day between 1 and 31) not valid,
  add constraint bill_templates_payment_mode_check
    check (payment_mode in ('ledger', 'status_only')) not valid,
  add constraint bill_templates_fixed_amount_check
    check (
      (amount_mode = 'fixed' and amount_default is not null and amount_default >= 0)
      or (amount_mode = 'variable' and amount_default is null)
    ) not valid,
  add constraint bill_templates_active_range_check
    check (ends_on is null or ends_on >= starts_on) not valid;

alter table public.bill_instances
  add constraint bill_instances_period_check
    check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') not valid,
  add constraint bill_instances_status_check
    check (status in ('awaiting_details', 'unpaid', 'partial', 'paid')) not valid,
  add constraint bill_instances_source_check
    check (source in ('manual', 'template')) not valid,
  add constraint bill_instances_payment_mode_check
    check (payment_mode in ('ledger', 'status_only')) not valid,
  add constraint bill_instances_amount_due_check
    check (amount_due is null or amount_due >= 0) not valid,
  add constraint bill_instances_paid_total_check
    check (paid_total >= 0) not valid;

create unique index if not exists bill_instances_template_period_unique
  on public.bill_instances (workspace_id, template_id, period)
  where template_id is not null;

create index if not exists bill_templates_generation_lookup
  on public.bill_templates (active, starts_on, ends_on);

create or replace function private.generate_bill_instances(p_period date default current_date)
returns integer
language plpgsql
set search_path = private, public, pg_temp
as $$
declare
  v_period_start date := date_trunc('month', p_period)::date;
  v_period_end date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_inserted integer;
begin
  insert into public.bill_instances (
    workspace_id,
    template_id,
    period,
    due_date,
    name_snapshot,
    amount_due,
    status,
    paid_total,
    billing_start,
    billing_end,
    source,
    payment_mode
  )
  select
    template.workspace_id,
    template.id,
    to_char(v_period_start, 'YYYY-MM'),
    case
      when template.due_day is null then null
      else v_period_start + (
        least(template.due_day, extract(day from v_period_end)::integer) - 1
      )
    end,
    template.name,
    case
      when template.amount_mode = 'fixed' then template.amount_default
      else null
    end,
    case
      when template.amount_mode = 'variable' or template.due_day is null
        then 'awaiting_details'
      else 'unpaid'
    end,
    0,
    v_period_start,
    v_period_end,
    'template',
    template.payment_mode
  from public.bill_templates as template
  where template.active
    and template.starts_on <= v_period_end
    and (template.ends_on is null or template.ends_on >= v_period_start)
    and (
      template.schedule_type = 'monthly'
      or (
        template.schedule_type = 'months'
        and extract(month from v_period_start)::smallint = any(template.schedule_months)
      )
    )
  on conflict (workspace_id, template_id, period)
    where template_id is not null
    do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function private.generate_bill_instances(date) from public, anon, authenticated;

create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
  from cron.job
  where jobname = 'familytool-generate-monthly-bills';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'familytool-generate-monthly-bills',
    '5 0 1 * *',
    'select private.generate_bill_instances(current_date);'
  );
end;
$$;
