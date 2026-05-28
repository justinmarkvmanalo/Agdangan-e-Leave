alter table public.employees
  alter column leave_credits type numeric(10,3);

alter table public.leave_requests
  alter column credit_earned_vacation type numeric(10,3),
  alter column credit_earned_sick type numeric(10,3),
  alter column credit_balance_vacation type numeric(10,3),
  alter column credit_balance_sick type numeric(10,3);

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
  approved_with_pay integer;
  approved_without_pay integer;
  updated_request public.leave_requests;
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

  if request_record.status = 'approved'
    and p_status <> 'approved' then
    update public.employees
    set leave_credits = round((coalesce(leave_credits, 0) + request_record.days_requested)::numeric, 3)
    where id = request_record.employee_id
    returning * into employee_record;
  end if;

  credits_before_deduction := round(coalesce(employee_record.leave_credits, 0)::numeric, 3);
  credits_after_deduction := credits_before_deduction;
  approved_with_pay := null;
  approved_without_pay := null;

  if p_status = 'approved' then
    if request_record.status <> 'approved' then
      credits_after_deduction := greatest(credits_before_deduction - request_record.days_requested, 0);

      update public.employees
      set leave_credits = round(credits_after_deduction::numeric, 3)
      where id = request_record.employee_id
      returning * into employee_record;
    end if;

    approved_with_pay := least(floor(credits_before_deduction)::integer, request_record.days_requested);
    approved_without_pay := greatest(request_record.days_requested - approved_with_pay, 0);
  end if;

  update public.leave_requests
  set
    status = p_status,
    reviewed_by_admin_id = p_admin_id,
    reviewed_at = now(),
    credit_as_of = current_date,
    credit_earned_vacation = credits_before_deduction,
    credit_earned_sick = credits_before_deduction,
    credit_balance_vacation = credits_after_deduction,
    credit_balance_sick = credits_after_deduction,
    credit_deduction_processed_at = null,
    recommendation = case when p_status = 'approved' then 'approved' else 'rejected' end,
    recommendation_details = case when p_status = 'rejected' then 'Request disapproved.' else null end,
    approved_with_pay_days = case when p_status = 'approved' then approved_with_pay else null end,
    approved_without_pay_days = case when p_status = 'approved' then approved_without_pay else null end,
    approved_other_details = null,
    disapproval_details = case when p_status = 'rejected' then 'Rejected by administrator.' else null end
  where id = p_request_id
  returning * into updated_request;

  return updated_request;
end;
$$;
