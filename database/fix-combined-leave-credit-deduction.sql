-- Fixes credit deduction for combined leave types.
-- Example: vacation + mandatory-forced for 8 days deducts only 3 vacation credits.

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
