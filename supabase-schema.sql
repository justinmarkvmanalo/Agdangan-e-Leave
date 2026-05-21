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
  leave_credits numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id bigint generated always as identity primary key,
  employee_id bigint not null references public.employees(id) on delete cascade,
  reviewed_by_admin_id bigint references public.admins(id) on delete set null,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days_requested integer not null check (days_requested > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

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
    leave_credits
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
    coalesce(p_leave_credits, 0)
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
