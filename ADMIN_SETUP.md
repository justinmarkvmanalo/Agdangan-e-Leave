# Single Admin Setup

This project is configured for one standard admin account only.

Admin identity:
- Name: `Justin Mark V Manalo`
- Email: `justinmarkvmanalo07@gmail.com`

Password handling:
- The password is intentionally not stored in this repository.
- Use the password you selected when creating the Supabase Auth user.

Steps in Supabase:
1. Open your Supabase project dashboard.
2. Go to `Authentication` -> `Users`.
3. Create one email/password user with:
   - Email: `justinmarkvmanalo07@gmail.com`
   - Password: your chosen admin password
4. After the auth user is created, open the SQL editor and run:

```sql
update public.profiles
set
  role = 'admin',
  first_name = 'Justin Mark V',
  last_name = 'Manalo',
  department = 'HR',
  position_title = 'Municipal Administrator'
where email = 'justinmarkvmanalo07@gmail.com';
```

5. Confirm that only one admin exists:

```sql
select id, email, role, first_name, last_name
from public.profiles
where role = 'admin';
```

Notes:
- The schema includes a unique partial index so only one admin profile can exist.
- Admin self-registration is not part of the website flow.
- Employees should remain `role = 'employee'`.
