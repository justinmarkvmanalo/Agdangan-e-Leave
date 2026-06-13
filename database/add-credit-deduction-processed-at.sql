-- Add missing credit_deduction_processed_at column
-- Run this in the Supabase SQL editor if you see:
--   column "credit_deduction_processed_at" of relation "leave_requests" does not exist

alter table public.leave_requests
  add column if not exists credit_deduction_processed_at timestamptz;

create index if not exists leave_requests_credit_deduction_processed_at_idx
  on public.leave_requests (credit_deduction_processed_at);
