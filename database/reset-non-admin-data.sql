-- Deletes all non-admin data and resets IDs for the cleared tables.
-- Run this in the Supabase SQL editor only after backing up any records you need.
-- This keeps public.admins and the existing admin IDs unchanged.

begin;

truncate table
  public.credit_deduction_logs,
  public.leave_requests,
  public.employees
restart identity cascade;

commit;
