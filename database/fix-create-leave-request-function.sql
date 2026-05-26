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
  credit_earned_vacation numeric(10,2),
  credit_earned_sick numeric(10,2),
  credit_balance_vacation numeric(10,2),
  credit_balance_sick numeric(10,2),
  recommendation text,
  recommendation_details text,
  approved_with_pay_days integer,
  approved_without_pay_days integer,
  approved_other_details text,
  disapproval_details text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.leave_requests add column if not exists office_department text;
alter table public.leave_requests add column if not exists applicant_last_name text;
alter table public.leave_requests add column if not exists applicant_first_name text;
alter table public.leave_requests add column if not exists applicant_middle_name text;
alter table public.leave_requests add column if not exists filing_date date;
alter table public.leave_requests add column if not exists position_title text;
alter table public.leave_requests add column if not exists salary_display text;
alter table public.leave_requests add column if not exists other_leave_details text;
alter table public.leave_requests add column if not exists vacation_location text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists vacation_location_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists sick_leave_details text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists sick_leave_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists leave_purpose_details text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists leave_purpose_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists commutation text;

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
  p_days_requested integer,
  p_other_leave_details text,
  p_vacation_location text[],
  p_vacation_location_notes jsonb,
  p_sick_leave_details text[],
  p_sick_leave_notes jsonb,
  p_leave_purpose_details text[],
  p_leave_purpose_notes jsonb,
  p_commutation text,
  p_reason text
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
    days_requested,
    other_leave_details,
    vacation_location,
    vacation_location_notes,
    sick_leave_details,
    sick_leave_notes,
    leave_purpose_details,
    leave_purpose_notes,
    commutation,
    reason
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
    p_days_requested,
    nullif(trim(coalesce(p_other_leave_details, '')), ''),
    coalesce(p_vacation_location, '{}'::text[]),
    coalesce(p_vacation_location_notes, '{}'::jsonb),
    coalesce(p_sick_leave_details, '{}'::text[]),
    coalesce(p_sick_leave_notes, '{}'::jsonb),
    coalesce(p_leave_purpose_details, '{}'::text[]),
    coalesce(p_leave_purpose_notes, '{}'::jsonb),
    nullif(trim(coalesce(p_commutation, '')), ''),
    trim(p_reason)
  )
  returning * into new_request;

  return new_request;
end;
$$;

grant execute on function public.create_leave_request(
  bigint,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  date,
  date,
  integer,
  text,
  text[],
  jsonb,
  text[],
  jsonb,
  text[],
  jsonb,
  text,
  text
) to anon, authenticated, service_role;
