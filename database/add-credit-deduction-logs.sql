create table if not exists public.credit_deduction_logs (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  employee_name text not null,
  employee_no text,
  minutes integer not null check (minutes > 0),
  entries jsonb not null default '[]'::jsonb,
  deduction numeric(10,3) not null,
  reason text not null,
  before_credits numeric(10,3) not null,
  after_credits numeric(10,3) not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_deduction_logs_employee_created_idx
on public.credit_deduction_logs (employee_id, created_at desc);

alter table public.credit_deduction_logs enable row level security;

create or replace function public.create_credit_deduction_log(
  p_employee_id bigint,
  p_employee_name text,
  p_employee_no text,
  p_minutes integer,
  p_entries jsonb,
  p_deduction numeric,
  p_reason text,
  p_before_credits numeric,
  p_after_credits numeric
)
returns public.credit_deduction_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  created_log public.credit_deduction_logs;
begin
  insert into public.credit_deduction_logs (
    employee_id,
    employee_name,
    employee_no,
    minutes,
    entries,
    deduction,
    reason,
    before_credits,
    after_credits
  )
  values (
    p_employee_id,
    trim(coalesce(p_employee_name, 'Employee')),
    nullif(trim(coalesce(p_employee_no, '')), ''),
    p_minutes,
    coalesce(p_entries, '[]'::jsonb),
    round(coalesce(p_deduction, 0)::numeric, 3),
    trim(coalesce(p_reason, 'Credit deduction')),
    round(coalesce(p_before_credits, 0)::numeric, 3),
    round(coalesce(p_after_credits, 0)::numeric, 3)
  )
  returning * into created_log;

  return created_log;
end;
$$;

create or replace function public.get_credit_deduction_logs(p_employee_id bigint)
returns table (
  id bigint,
  employee_id bigint,
  employee_name text,
  employee_no text,
  minutes integer,
  entries jsonb,
  deduction numeric,
  reason text,
  before_credits numeric,
  after_credits numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.employee_id,
    l.employee_name,
    l.employee_no,
    l.minutes,
    l.entries,
    l.deduction,
    l.reason,
    l.before_credits,
    l.after_credits,
    l.created_at
  from public.credit_deduction_logs l
  where l.employee_id = p_employee_id
  order by l.created_at desc, l.id desc;
$$;

grant select, insert, update, delete on public.credit_deduction_logs to anon, authenticated;
grant usage, select on sequence public.credit_deduction_logs_id_seq to anon, authenticated;
grant execute on function public.create_credit_deduction_log(bigint, text, text, integer, jsonb, numeric, text, numeric, numeric) to anon, authenticated;
grant execute on function public.get_credit_deduction_logs(bigint) to anon, authenticated;
