-- Run this after supabase-schema.sql
-- This sets the existing Auth user as the one standard admin.

update public.profiles
set
  role = 'admin',
  first_name = 'Justin Mark',
  middle_name = 'V.',
  last_name = 'Manalo',
  suffix = null,
  department = 'HR',
  position_title = 'IT Support',
  is_approved = true,
  employment_status = 'active'
where email = 'justinmarkvmanalo07@gmail.com';

select
  id,
  email,
  role,
  first_name,
  middle_name,
  last_name,
  department,
  position_title,
  is_approved
from public.profiles
where email = 'justinmarkvmanalo07@gmail.com';
