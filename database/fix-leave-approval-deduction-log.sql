-- Logs leave-approval credit deductions and stores only the relevant credit snapshot column.
-- Run this in the Supabase SQL editor after backing up records you need.

alter table public.credit_deduction_logs alter column minutes set default 0;
alter table public.credit_deduction_logs drop constraint if exists credit_deduction_logs_minutes_check;
alter table public.credit_deduction_logs add constraint credit_deduction_logs_minutes_check check (minutes >= 0);

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
    credit_deduction_processed_at = null,
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
