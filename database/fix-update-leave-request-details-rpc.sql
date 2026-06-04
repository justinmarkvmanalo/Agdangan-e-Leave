-- Recreates the admin leave-request update RPC expected by assets/js/app.js.
-- Run this in the Supabase SQL editor if the dashboard shows:
-- "Could not find the function public.update_leave_request_details(...)"

alter table public.leave_requests add column if not exists office_department text;
alter table public.leave_requests add column if not exists applicant_last_name text;
alter table public.leave_requests add column if not exists applicant_first_name text;
alter table public.leave_requests add column if not exists applicant_middle_name text;
alter table public.leave_requests add column if not exists filing_date date;
alter table public.leave_requests add column if not exists position_title text;
alter table public.leave_requests add column if not exists salary_display text;
alter table public.leave_requests add column if not exists selected_leave_dates date[] not null default '{}'::date[];
alter table public.leave_requests add column if not exists other_leave_details text;
alter table public.leave_requests add column if not exists vacation_location text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists vacation_location_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists sick_leave_details text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists sick_leave_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists leave_purpose_details text[] not null default '{}'::text[];
alter table public.leave_requests add column if not exists leave_purpose_notes jsonb not null default '{}'::jsonb;
alter table public.leave_requests add column if not exists commutation text;
alter table public.leave_requests add column if not exists credit_as_of date;
alter table public.leave_requests add column if not exists credit_earned_vacation numeric(10,3);
alter table public.leave_requests add column if not exists credit_earned_sick numeric(10,3);
alter table public.leave_requests add column if not exists credit_balance_vacation numeric(10,3);
alter table public.leave_requests add column if not exists credit_balance_sick numeric(10,3);
alter table public.leave_requests add column if not exists recommendation text;
alter table public.leave_requests add column if not exists recommendation_details text;
alter table public.leave_requests add column if not exists recommendation_officer_name text;
alter table public.leave_requests add column if not exists approved_with_pay_days integer;
alter table public.leave_requests add column if not exists approved_without_pay_days integer;
alter table public.leave_requests add column if not exists approved_other_details text;
alter table public.leave_requests add column if not exists approval_authorized_official_name text;
alter table public.leave_requests add column if not exists disapproval_details text;

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
