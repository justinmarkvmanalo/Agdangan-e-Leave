-- Agdangan e-Leave Supabase schema
-- Use Supabase Auth for login credentials.
-- Use public.profiles for admin and employee data.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'employee');
create type public.employment_status as enum ('active', 'inactive', 'resigned');
create type public.leave_type as enum (
  'vacation',
  'sick',
  'emergency',
  'maternity',
  'paternity',
  'special'
);
create type public.leave_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_no text unique,
  role public.user_role not null default 'employee',
  email text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  department text not null,
  position_title text not null,
  contact_no text,
  employment_status public.employment_status not null default 'active',
  hire_date date,
  leave_credits numeric(10,2) not null default 0,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_no_required_for_employee check (
    role = 'admin' or employee_no is not null
  )
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  days_requested numeric(10,2) not null,
  reason text not null,
  status public.leave_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_leave_dates check (end_date >= start_date),
  constraint valid_days_requested check (days_requested > 0)
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_employee_no on public.profiles(employee_no);
create index if not exists idx_leave_requests_employee_id on public.leave_requests(employee_id);
create index if not exists idx_leave_requests_status on public.leave_requests(status);
create unique index if not exists only_one_admin_allowed
on public.profiles (role)
where role = 'admin';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    employee_no,
    role,
    email,
    first_name,
    middle_name,
    last_name,
    suffix,
    department,
    position_title,
    contact_no
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'employee_no',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'employee'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    new.raw_user_meta_data ->> 'middle_name',
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'suffix',
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'position_title', ''),
    new.raw_user_meta_data ->> 'contact_no'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_leave_requests_updated_at on public.leave_requests;
create trigger set_leave_requests_updated_at
before update on public.leave_requests
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.leave_requests enable row level security;

drop policy if exists "users_can_view_own_profile" on public.profiles;
create policy "users_can_view_own_profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "users_can_update_own_profile" on public.profiles;
create policy "users_can_update_own_profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users_can_insert_own_profile" on public.profiles;
create policy "users_can_insert_own_profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "admins_can_view_all_profiles" on public.profiles;
create policy "admins_can_view_all_profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "admins_can_update_all_profiles" on public.profiles;
create policy "admins_can_update_all_profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "employees_can_create_own_leave_requests" on public.leave_requests;
create policy "employees_can_create_own_leave_requests"
on public.leave_requests
for insert
to authenticated
with check (employee_id = auth.uid());

drop policy if exists "employees_can_view_own_leave_requests" on public.leave_requests;
create policy "employees_can_view_own_leave_requests"
on public.leave_requests
for select
to authenticated
using (employee_id = auth.uid());

drop policy if exists "employees_can_update_pending_own_leave_requests" on public.leave_requests;
create policy "employees_can_update_pending_own_leave_requests"
on public.leave_requests
for update
to authenticated
using (employee_id = auth.uid() and status = 'pending')
with check (employee_id = auth.uid() and status = 'pending');

drop policy if exists "admins_can_manage_all_leave_requests" on public.leave_requests;
create policy "admins_can_manage_all_leave_requests"
on public.leave_requests
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Standard admin account policy:
-- This project is limited to one admin row only.
-- The unique partial index above blocks a second admin profile.
--
-- Admin account target:
-- {
--   "role": "admin",
--   "first_name": "Justin Mark V",
--   "last_name": "Manalo",
--   "department": "HR",
--   "position_title": "Municipal Administrator"
-- }
--
-- Signup metadata example for an employee account:
-- {
--   "employee_no": "EMP-001",
--   "role": "employee",
--   "first_name": "Juan",
--   "last_name": "Dela Cruz",
--   "department": "Treasury",
--   "position_title": "Administrative Aide"
-- }
