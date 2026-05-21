-- Optional admin update for the basic table-based schema.
-- Run this after supabase-schema.sql if you want to replace the default seeded admin details.

update hrm.admins
set
  email = 'justinmarkvmanalo07@gmail.com',
  password = 'password123',
  first_name = 'Justin Mark',
  middle_name = 'V.',
  last_name = 'Manalo',
  suffix = null,
  department = 'HR',
  position_title = 'IT Support',
  is_active = true
where email = 'admin@agdangan.gov.ph';

select
  id,
  email,
  first_name,
  middle_name,
  last_name,
  department,
  position_title,
  is_active
from hrm.admins
where email = 'justinmarkvmanalo07@gmail.com';
