-- Agdangan e-Leave basic Supabase schema
-- No supabase.auth
-- No public.profiles
-- Integer auto-increment IDs with simple parent-child relationships

create table if not exists public.admins (
  id bigint generated always as identity primary key,
  email text not null unique,
  password text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  department text not null default 'HR',
  position_title text not null default 'Administrator',
  contact_no text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id bigint generated always as identity primary key,
  admin_id bigint references public.admins(id) on delete set null,
  employee_no text not null unique,
  email text not null unique,
  password text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  department text not null,
  position_title text not null,
  contact_no text,
  hire_date date,
  employment_status text not null default 'active' check (employment_status in ('active', 'inactive', 'suspended')),
  leave_credits numeric(10,3) not null default 0,
  last_credit_accrual_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  reviewed_by_admin_id bigint references public.admins(id) on delete set null,
  leave_type text not null,
  office_department text,
  applicant_last_name text,
  applicant_first_name text,
  applicant_middle_name text,
  filing_date date,
  position_title text,
  salary_display text,
  start_date date not null,
  end_date date not null,
  selected_leave_dates date[] not null default '{}'::date[],
  days_requested integer not null check (days_requested > 0),
  other_leave_details text,
  vacation_location text[] not null default '{}'::text[],
  vacation_location_notes jsonb not null default '{}'::jsonb,
  sick_leave_details text[] not null default '{}'::text[],
  sick_leave_notes jsonb not null default '{}'::jsonb,
  leave_purpose_details text[] not null default '{}'::text[],
  leave_purpose_notes jsonb not null default '{}'::jsonb,
  commutation text,
  reason text not null,
  credit_as_of date,
  credit_earned_vacation numeric(10,3),
  credit_earned_sick numeric(10,3),
  credit_balance_vacation numeric(10,3),
  credit_balance_sick numeric(10,3),
  recommendation text,
  recommendation_details text,
  recommendation_officer_name text,
  approved_with_pay_days integer,
  approved_without_pay_days integer,
  approved_other_details text,
  approval_authorized_official_name text,
  disapproval_details text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.credit_deduction_logs (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  employee_name text not null,
  employee_no text,
  minutes integer not null default 0 check (minutes >= 0),
  entries jsonb not null default '[]'::jsonb,
  deduction numeric(10,3) not null,
  reason text not null,
  before_credits numeric(10,3) not null,
  after_credits numeric(10,3) not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_deduction_logs_employee_created_idx
on public.credit_deduction_logs (employee_id, created_at desc);

alter table public.credit_deduction_logs alter column minutes set default 0;
alter table public.credit_deduction_logs drop constraint if exists credit_deduction_logs_minutes_check;
alter table public.credit_deduction_logs add constraint credit_deduction_logs_minutes_check check (minutes >= 0);

alter table public.leave_requests add column if not exists office_department text;
alter table public.leave_requests add column if not exists applicant_last_name text;
alter table public.leave_requests add column if not exists applicant_first_name text;
alter table public.leave_requests add column if not exists applicant_middle_name text;
alter table public.leave_requests add column if not exists filing_date date;
alter table public.leave_requests add column if not exists position_title text;
alter table public.leave_requests add column if not exists salary_display text;
alter table public.leave_requests add column if not exists other_leave_details text;
alter table public.leave_requests add column if not exists selected_leave_dates date[] not null default '{}'::date[];
alter table public.leave_requests add column if not exists vacation_location text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists vacation_location_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists sick_leave_details text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists sick_leave_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists leave_purpose_details text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists leave_purpose_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists commutation text;
alter table public.leave_requests add column if not exists credit_as_of date;
alter table public.employees alter column leave_credits type numeric(10,3);
alter table public.leave_requests add column if not exists credit_earned_vacation numeric(10,3);
alter table public.leave_requests add column if not exists credit_earned_sick numeric(10,3);
alter table public.leave_requests add column if not exists credit_balance_vacation numeric(10,3);
alter table public.leave_requests add column if not exists credit_balance_sick numeric(10,3);
alter table public.leave_requests alter column credit_earned_vacation type numeric(10,3);
alter table public.leave_requests alter column credit_earned_sick type numeric(10,3);
alter table public.leave_requests alter column credit_balance_vacation type numeric(10,3);
alter table public.leave_requests alter column credit_balance_sick type numeric(10,3);
alter table public.leave_requests add column if not exists recommendation text;
alter table public.leave_requests add column if not exists recommendation_details text;
alter table public.leave_requests add column if not exists recommendation_officer_name text;
alter table public.leave_requests add column if not exists approved_with_pay_days integer;
alter table public.leave_requests add column if not exists approved_without_pay_days integer;
alter table public.leave_requests add column if not exists approved_other_details text;
alter table public.leave_requests add column if not exists approval_authorized_official_name text;
alter table public.leave_requests add column if not exists disapproval_details text;
alter table public.employees add column if not exists last_credit_accrual_date date;
update public.employees
set last_credit_accrual_date = coalesce(last_credit_accrual_date, current_date)
where last_credit_accrual_date is null;

alter table public.admins enable row level security;
alter table public.employees enable row level security;
alter table public.leave_requests enable row level security;
alter table public.credit_deduction_logs enable row level security;

drop policy if exists credit_deduction_logs_select_all on public.credit_deduction_logs;
create policy credit_deduction_logs_select_all
on public.credit_deduction_logs
for select
to anon, authenticated
using (true);

drop policy if exists credit_deduction_logs_insert_all on public.credit_deduction_logs;
create policy credit_deduction_logs_insert_all
on public.credit_deduction_logs
for insert
to anon, authenticated
with check (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admins_set_updated_at on public.admins;
create trigger admins_set_updated_at
before update on public.admins
for each row
execute function public.set_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at
before update on public.leave_requests
for each row
execute function public.set_updated_at();

create or replace function public.next_employee_no()
returns text
language plpgsql
as $$
declare
  next_number bigint;
begin
  select coalesce(max(substring(employee_no from '[0-9]+$')::bigint), 0) + 1
  into next_number
  from public.employees;

  return 'EMP-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.login_user(
  p_email text,
  p_password text,
  p_role text default null
)
returns table (
  role text,
  user_id bigint,
  email text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role is null or p_role = 'admin' then
    return query
    select
      'admin'::text,
      a.id,
      a.email,
      trim(a.first_name || ' ' || a.last_name)
    from public.admins a
    where lower(a.email) = lower(p_email)
      and a.password = p_password
      and a.is_active = true
    limit 1;

    if found then
      return;
    end if;
  end if;

  if p_role is null or p_role = 'employee' then
    return query
    select
      'employee'::text,
      e.id,
      e.email,
      trim(e.first_name || ' ' || e.last_name)
    from public.employees e
    where lower(e.email) = lower(p_email)
      and e.password = p_password
      and e.employment_status = 'active'
    limit 1;
  end if;
end;
$$;

create or replace function public.change_own_password(
  p_role text,
  p_user_id bigint,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'New password must be at least 8 characters.';
  end if;

  if p_role = 'employee' then
    update public.employees
    set password = p_new_password
    where id = p_user_id
      and password = p_current_password
      and employment_status = 'active';

    get diagnostics updated_count = row_count;
    return updated_count = 1;
  end if;

  return false;
end;
$$;

create or replace function public.get_admin_profile(p_admin_id bigint)
returns public.admins
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_profile public.admins;
begin
  select *
  into admin_profile
  from public.admins
  where id = p_admin_id
    and is_active = true;

  return admin_profile;
end;
$$;

create or replace function public.get_employee_profile(p_employee_id bigint)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_profile public.employees;
begin
  perform public.apply_employee_monthly_leave_credit(p_employee_id);

  select *
  into employee_profile
  from public.employees
  where id = p_employee_id
    and employment_status = 'active';

  return employee_profile;
end;
$$;

create or replace function public.apply_employee_monthly_leave_credit(p_employee_id bigint)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_record public.employees;
  processing_anchor date;
  next_month_end date;
begin
  select *
  into employee_record
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    return null;
  end if;

  processing_anchor := coalesce(employee_record.last_credit_accrual_date, current_date);

  if processing_anchor > current_date then
    return employee_record;
  end if;

  next_month_end := (date_trunc('month', processing_anchor)::date + interval '1 month - 1 day')::date;
  if processing_anchor = next_month_end then
    next_month_end := (date_trunc('month', processing_anchor)::date + interval '2 month - 1 day')::date;
  end if;

  while next_month_end <= current_date loop
    update public.employees
    set
      leave_credits = round((coalesce(leave_credits, 0) + 1.25::numeric)::numeric, 3),
      last_credit_accrual_date = next_month_end
    where id = p_employee_id
    returning * into employee_record;

    next_month_end := (date_trunc('month', next_month_end + interval '1 day')::date + interval '1 month - 1 day')::date;
  end loop;

  return employee_record;
end;
$$;

create or replace function public.get_admin_employees(p_admin_id bigint)
returns setof public.employees
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_employee_monthly_leave_credit(e.id)
  from public.employees e
  where e.admin_id = p_admin_id;

  return query
  select e.*
  from public.employees e
  where e.admin_id = p_admin_id
  order by e.last_name asc, e.first_name asc;
end;
$$;

create or replace function public.get_employee_leave_requests(p_employee_id bigint)
returns setof public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_employee_monthly_leave_credit(p_employee_id);

  return query
  select lr.*
  from public.leave_requests lr
  where lr.employee_id = p_employee_id
  order by lr.created_at desc;
end;
$$;

create or replace function public.get_admin_leave_requests(p_admin_id bigint)
returns setof public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_employee_monthly_leave_credit(e.id)
  from public.employees e
  where e.admin_id = p_admin_id;

  return query
  select lr.*
  from public.leave_requests lr
  inner join public.employees e on e.id = lr.employee_id
  where e.admin_id = p_admin_id
  order by lr.created_at desc;
end;
$$;

create or replace function public.create_leave_request(
  p_employee_id bigint,
  p_leave_type text,
  p_office_department text,
  p_applicant_last_name text,
  p_applicant_first_name text,
  p_applicant_middle_name text,
  p_filing_date date,
  p_position_title text,
  p_salary_display text,
  p_start_date date,
  p_end_date date,
  p_selected_leave_dates date[],
  p_days_requested integer,
  p_other_leave_details text,
  p_vacation_location text[],
  p_vacation_location_notes jsonb,
  p_sick_leave_details text[],
  p_sick_leave_notes jsonb,
  p_leave_purpose_details text[],
  p_leave_purpose_notes jsonb,
  p_commutation text,
  p_reason text,
  p_recommendation_officer_name text default null,
  p_approval_authorized_official_name text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  new_request public.leave_requests;
begin
  insert into public.leave_requests (
    employee_id,
    leave_type,
    office_department,
    applicant_last_name,
    applicant_first_name,
    applicant_middle_name,
    filing_date,
    position_title,
    salary_display,
    start_date,
    end_date,
    selected_leave_dates,
    days_requested,
    other_leave_details,
    vacation_location,
    vacation_location_notes,
    sick_leave_details,
    sick_leave_notes,
    leave_purpose_details,
    leave_purpose_notes,
    commutation,
    reason,
    recommendation_officer_name,
    approval_authorized_official_name
  )
  values (
    p_employee_id,
    trim(p_leave_type),
    nullif(trim(coalesce(p_office_department, '')), ''),
    nullif(trim(coalesce(p_applicant_last_name, '')), ''),
    nullif(trim(coalesce(p_applicant_first_name, '')), ''),
    nullif(trim(coalesce(p_applicant_middle_name, '')), ''),
    p_filing_date,
    nullif(trim(coalesce(p_position_title, '')), ''),
    nullif(trim(coalesce(p_salary_display, '')), ''),
    p_start_date,
    p_end_date,
    coalesce(p_selected_leave_dates, '{}'::date[]),
    p_days_requested,
    nullif(trim(coalesce(p_other_leave_details, '')), ''),
    coalesce(p_vacation_location, '{}'::text[]),
    coalesce(p_vacation_location_notes, '{}'::jsonb),
    coalesce(p_sick_leave_details, '{}'::text[]),
    coalesce(p_sick_leave_notes, '{}'::jsonb),
    coalesce(p_leave_purpose_details, '{}'::text[]),
    coalesce(p_leave_purpose_notes, '{}'::jsonb),
    nullif(trim(coalesce(p_commutation, '')), ''),
    trim(p_reason),
    nullif(trim(coalesce(p_recommendation_officer_name, '')), ''),
    nullif(trim(coalesce(p_approval_authorized_official_name, '')), '')
  )
  returning * into new_request;

  return new_request;
end;
$$;

create or replace function public.update_leave_request_details(
  p_admin_id bigint,
  p_request_id bigint,
  p_leave_type text,
  p_office_department text,
  p_applicant_last_name text,
  p_applicant_first_name text,
  p_applicant_middle_name text,
  p_filing_date date,
  p_position_title text,
  p_salary_display text,
  p_start_date date,
  p_end_date date,
  p_selected_leave_dates date[],
  p_days_requested integer,
  p_other_leave_details text,
  p_vacation_location text[],
  p_vacation_location_notes jsonb,
  p_sick_leave_details text[],
  p_sick_leave_notes jsonb,
  p_leave_purpose_details text[],
  p_leave_purpose_notes jsonb,
  p_commutation text,
  p_reason text,
  p_credit_as_of date,
  p_credit_earned_vacation numeric,
  p_credit_earned_sick numeric,
  p_credit_balance_vacation numeric,
  p_credit_balance_sick numeric,
  p_recommendation text,
  p_recommendation_details text,
  p_recommendation_officer_name text,
  p_approved_with_pay_days integer,
  p_approved_without_pay_days integer,
  p_approved_other_details text,
  p_approval_authorized_official_name text,
  p_disapproval_details text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.leave_requests;
begin
  update public.leave_requests lr
  set
    leave_type = trim(p_leave_type),
    office_department = nullif(trim(coalesce(p_office_department, '')), ''),
    applicant_last_name = nullif(trim(coalesce(p_applicant_last_name, '')), ''),
    applicant_first_name = nullif(trim(coalesce(p_applicant_first_name, '')), ''),
    applicant_middle_name = nullif(trim(coalesce(p_applicant_middle_name, '')), ''),
    filing_date = p_filing_date,
    position_title = nullif(trim(coalesce(p_position_title, '')), ''),
    salary_display = nullif(trim(coalesce(p_salary_display, '')), ''),
    start_date = p_start_date,
    end_date = p_end_date,
    selected_leave_dates = coalesce(p_selected_leave_dates, '{}'::date[]),
    days_requested = p_days_requested,
    other_leave_details = nullif(trim(coalesce(p_other_leave_details, '')), ''),
    vacation_location = coalesce(p_vacation_location, '{}'::text[]),
    vacation_location_notes = coalesce(p_vacation_location_notes, '{}'::jsonb),
    sick_leave_details = coalesce(p_sick_leave_details, '{}'::text[]),
    sick_leave_notes = coalesce(p_sick_leave_notes, '{}'::jsonb),
    leave_purpose_details = coalesce(p_leave_purpose_details, '{}'::text[]),
    leave_purpose_notes = coalesce(p_leave_purpose_notes, '{}'::jsonb),
    commutation = nullif(trim(coalesce(p_commutation, '')), ''),
    reason = trim(coalesce(p_reason, '')),
    credit_as_of = p_credit_as_of,
    credit_earned_vacation = p_credit_earned_vacation,
    credit_earned_sick = p_credit_earned_sick,
    credit_balance_vacation = p_credit_balance_vacation,
    credit_balance_sick = p_credit_balance_sick,
    recommendation = nullif(trim(coalesce(p_recommendation, '')), ''),
    recommendation_details = nullif(trim(coalesce(p_recommendation_details, '')), ''),
    recommendation_officer_name = nullif(trim(coalesce(p_recommendation_officer_name, '')), ''),
    approved_with_pay_days = p_approved_with_pay_days,
    approved_without_pay_days = p_approved_without_pay_days,
    approved_other_details = nullif(trim(coalesce(p_approved_other_details, '')), ''),
    approval_authorized_official_name = nullif(trim(coalesce(p_approval_authorized_official_name, '')), ''),
    disapproval_details = nullif(trim(coalesce(p_disapproval_details, '')), ''),
    reviewed_by_admin_id = p_admin_id,
    reviewed_at = now()
  from public.employees e
  where lr.id = p_request_id
    and e.id = lr.employee_id
    and e.admin_id = p_admin_id
  returning lr.* into updated_request;

  return updated_request;
end;
$$;

create or replace function public.create_employee(
  p_admin_id bigint,
  p_email text,
  p_password text,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_suffix text,
  p_department text,
  p_position_title text,
  p_contact_no text,
  p_hire_date date,
  p_employment_status text,
  p_leave_credits numeric
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  new_employee public.employees;
begin
  insert into public.employees (
    admin_id,
    employee_no,
    email,
    password,
    first_name,
    middle_name,
    last_name,
    suffix,
    department,
    position_title,
    contact_no,
    hire_date,
    employment_status,
    leave_credits,
    last_credit_accrual_date
  )
  values (
    p_admin_id,
    public.next_employee_no(),
    lower(trim(p_email)),
    p_password,
    trim(p_first_name),
    nullif(trim(coalesce(p_middle_name, '')), ''),
    trim(p_last_name),
    nullif(trim(coalesce(p_suffix, '')), ''),
    trim(p_department),
    trim(p_position_title),
    nullif(trim(coalesce(p_contact_no, '')), ''),
    p_hire_date,
    coalesce(p_employment_status, 'active'),
    coalesce(p_leave_credits, 0),
    current_date
  )
  returning * into new_employee;

  return new_employee;
end;
$$;

create or replace function public.update_employee(
  p_employee_id bigint,
  p_email text,
  p_password text default null,
  p_first_name text default null,
  p_middle_name text default null,
  p_last_name text default null,
  p_suffix text default null,
  p_department text default null,
  p_position_title text default null,
  p_contact_no text default null,
  p_hire_date date default null,
  p_employment_status text default null,
  p_leave_credits numeric default null
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_employee public.employees;
begin
  update public.employees
  set
    email = lower(trim(coalesce(p_email, email))),
    password = coalesce(nullif(p_password, ''), password),
    first_name = coalesce(nullif(trim(coalesce(p_first_name, '')), ''), first_name),
    middle_name = case when p_middle_name is null then middle_name else nullif(trim(p_middle_name), '') end,
    last_name = coalesce(nullif(trim(coalesce(p_last_name, '')), ''), last_name),
    suffix = case when p_suffix is null then suffix else nullif(trim(p_suffix), '') end,
    department = coalesce(nullif(trim(coalesce(p_department, '')), ''), department),
    position_title = coalesce(nullif(trim(coalesce(p_position_title, '')), ''), position_title),
    contact_no = case when p_contact_no is null then contact_no else nullif(trim(p_contact_no), '') end,
    hire_date = coalesce(p_hire_date, hire_date),
    employment_status = coalesce(p_employment_status, employment_status),
    leave_credits = coalesce(p_leave_credits, leave_credits)
  where id = p_employee_id
  returning * into updated_employee;

  return updated_employee;
end;
$$;

create or replace function public.delete_employee(p_employee_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.employees
  where id = p_employee_id;
end;
$$;

create or replace function public.get_leave_credit_deduction_days(
  p_leave_type text,
  p_days_requested integer
)
returns integer
language sql
immutable
as $$
  with selected_leave_types as (
    select trim(leave_type) as leave_type
    from unnest(string_to_array(lower(coalesce(p_leave_type, '')), ',')) as raw_leave_type(leave_type)
    where trim(leave_type) <> ''
  ),
  credit_policy as (
    select case
      when exists (select 1 from selected_leave_types where leave_type in ('vacation', 'mandatory-forced')) then 'vacation'
      when exists (select 1 from selected_leave_types where leave_type in ('sick', 'wellness')) then 'sick'
      else null
    end as credit_column
  ),
  free_days as (
    select case credit_column
      when 'vacation' then case when exists (select 1 from selected_leave_types where leave_type = 'mandatory-forced') then 5 else 0 end
      when 'sick' then case when exists (select 1 from selected_leave_types where leave_type = 'wellness') then 5 else 0 end
      else coalesce(p_days_requested, 0)
    end as days
    from credit_policy
  )
  select greatest(coalesce(p_days_requested, 0) - coalesce((select days from free_days), coalesce(p_days_requested, 0)), 0);
$$;

create or replace function public.get_leave_credit_deduction_column(p_leave_type text)
returns text
language sql
immutable
as $$
  with selected_leave_types as (
    select trim(leave_type) as leave_type
    from unnest(string_to_array(lower(coalesce(p_leave_type, '')), ',')) as raw_leave_type(leave_type)
    where trim(leave_type) <> ''
  )
  select case
    when exists (select 1 from selected_leave_types where leave_type in ('vacation', 'mandatory-forced')) then 'vacation'
    when exists (select 1 from selected_leave_types where leave_type in ('sick', 'wellness')) then 'sick'
    else null
  end;
$$;

create or replace function public.update_leave_request_status(
  p_admin_id bigint,
  p_request_id bigint,
  p_status text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.leave_requests;
  employee_record public.employees;
  credits_before_deduction numeric(10,3);
  credits_after_deduction numeric(10,3);
  deduction_days integer;
  previous_credit_deduction numeric(10,3);
  approved_with_pay integer;
  approved_without_pay integer;
  updated_request public.leave_requests;
  employee_name text;
begin
  if p_status not in ('approved', 'rejected') then
    return null;
  end if;

  select lr.*
  into request_record
  from public.leave_requests lr
  inner join public.employees e on e.id = lr.employee_id
  where lr.id = p_request_id
    and e.admin_id = p_admin_id
  for update;

  if not found then
    return null;
  end if;

  employee_record := public.apply_employee_monthly_leave_credit(request_record.employee_id);
  deduction_days := public.get_leave_credit_deduction_days(request_record.leave_type, request_record.days_requested);
  previous_credit_deduction := case
    when request_record.credit_earned_vacation is not null
      and request_record.credit_balance_vacation is not null
      then greatest(request_record.credit_earned_vacation - request_record.credit_balance_vacation, 0)
    when request_record.credit_earned_sick is not null
      and request_record.credit_balance_sick is not null
      then greatest(request_record.credit_earned_sick - request_record.credit_balance_sick, 0)
    else deduction_days
  end;

  if request_record.status = 'approved'
    and p_status <> 'approved' then
    update public.employees
    set leave_credits = round((coalesce(leave_credits, 0) + coalesce(previous_credit_deduction, deduction_days, 0))::numeric, 3)
    where id = request_record.employee_id
    returning * into employee_record;
  end if;

  credits_before_deduction := round(coalesce(employee_record.leave_credits, 0)::numeric, 3);
  credits_after_deduction := credits_before_deduction;
  approved_with_pay := null;
  approved_without_pay := null;

  if p_status = 'approved' then
    if request_record.status <> 'approved' then
      credits_after_deduction := greatest(credits_before_deduction - deduction_days, 0);

      update public.employees
      set leave_credits = round(credits_after_deduction::numeric, 3)
      where id = request_record.employee_id
      returning * into employee_record;

      if deduction_days > 0 then
        employee_name := trim(concat_ws(' ',
          employee_record.first_name,
          employee_record.middle_name,
          employee_record.last_name,
          employee_record.suffix
        ));

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
          employee_record.id,
          coalesce(nullif(employee_name, ''), 'Employee'),
          employee_record.employee_no,
          0,
          '[]'::jsonb,
          round(deduction_days::numeric, 3),
          concat('Approved leave deduction for request #', request_record.id),
          credits_before_deduction,
          credits_after_deduction
        );
      end if;
    end if;

    approved_with_pay := least(
      request_record.days_requested,
      (request_record.days_requested - deduction_days) + floor(credits_before_deduction)::integer
    );
    approved_without_pay := greatest(request_record.days_requested - approved_with_pay, 0);
  end if;

  update public.leave_requests
  set
    status = p_status,
    reviewed_by_admin_id = p_admin_id,
    reviewed_at = now(),
    credit_as_of = current_date,
    credit_earned_vacation = case
      when public.get_leave_credit_deduction_column(request_record.leave_type) = 'vacation' then credits_before_deduction
      else null
    end,
    credit_earned_sick = case
      when public.get_leave_credit_deduction_column(request_record.leave_type) = 'sick' then credits_before_deduction
      else null
    end,
    credit_balance_vacation = case
      when public.get_leave_credit_deduction_column(request_record.leave_type) = 'vacation' then credits_after_deduction
      else null
    end,
    credit_balance_sick = case
      when public.get_leave_credit_deduction_column(request_record.leave_type) = 'sick' then credits_after_deduction
      else null
    end,
    recommendation = case when p_status = 'approved' then 'approved' else 'rejected' end,
    recommendation_details = case
      when p_status = 'approved' then request_record.recommendation_details
      when p_status = 'rejected' then coalesce(request_record.recommendation_details, 'Request disapproved.')
      else null
    end,
    approved_with_pay_days = case when p_status = 'approved' then coalesce(request_record.approved_with_pay_days, approved_with_pay) else null end,
    approved_without_pay_days = case when p_status = 'approved' then coalesce(request_record.approved_without_pay_days, approved_without_pay) else null end,
    approved_other_details = case when p_status = 'approved' then request_record.approved_other_details else null end,
    disapproval_details = case when p_status = 'rejected' then coalesce(request_record.disapproval_details, 'Rejected by administrator.') else null end
  where id = p_request_id
  returning * into updated_request;

  return updated_request;
end;
$$;

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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;

alter default privileges in schema public
grant execute on functions to anon, authenticated;

insert into public.admins (
  email,
  password,
  first_name,
  last_name,
  department,
  position_title
)
select
  'admin@agdangan.gov.ph',
  'password123',
  'System',
  'Administrator',
  'HR',
  'Municipal Administrator'
where not exists (
  select 1
  from public.admins
  where email = 'admin@agdangan.gov.ph'
);

-- Returns storage info for each table plus total database size
-- Uses actual count(*) for accurate row counts
create or replace function public.get_db_storage_info()
returns json
language plpgsql
security definer
as $$
declare
  result json;
  tbl record;
  tables_json json = '[]'::json;
  t_row_count bigint;
begin
  for tbl in
    select relname, relid
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relname in ('admins', 'employees', 'leave_requests', 'credit_deduction_logs')
    order by pg_total_relation_size(relid) desc
  loop
    execute format('select count(*) from %I', tbl.relname) into t_row_count;
    tables_json := tables_json || json_build_object(
      'table_name', tbl.relname,
      'row_count', t_row_count,
      'size', pg_size_pretty(pg_total_relation_size(tbl.relid)),
      'size_bytes', pg_total_relation_size(tbl.relid)
    )::json;
  end loop;

  select json_build_object(
    'total_size', pg_size_pretty(pg_database_size(current_database())),
    'total_size_bytes', pg_database_size(current_database()),
    'tables', tables_json
  ) into result;

  return result;
end;
$$;
