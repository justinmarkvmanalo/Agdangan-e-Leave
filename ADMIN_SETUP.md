# Basic Supabase Schema Setup

This project now uses a simple table-based schema. It does not use `supabase.auth`, UUID user IDs, or the default `public.profiles` pattern.

Schema name:
- `hrm`

Main tables:
- `hrm.admins`
- `hrm.employees`
- `hrm.leave_requests`

Relationship flow:
- One admin can manage many employees through `employees.admin_id`
- One employee can have many leave requests through `leave_requests.employee_id`
- One admin can review many leave requests through `leave_requests.reviewed_by_admin_id`

Setup steps in Supabase:
1. Open your Supabase project dashboard.
2. Go to the SQL editor.
3. Run the full SQL file from [database/basic_schema.sql](/C:/Users/Justin%20Mark/OneDrive/Desktop/Agdangan%20e-Leave/database/basic_schema.sql:1).
4. Go to `Project Settings` -> `API`.
5. Add `hrm` to the exposed schemas list if it is not exposed yet.
6. Keep using your project URL and anon key in `supabase-config.js`.

Default seeded admin:
- Email: `admin@agdangan.gov.ph`
- Password: `password123`

Notes:
- Table IDs are `bigint generated always as identity`, so they auto-increment.
- Employee numbers are generated as `EMP-0001`, `EMP-0002`, and so on.
- This is a basic project-style schema. Passwords are stored as plain text because you asked to avoid Auth and keep it simple.
- If you want this to be production-safe later, the next step is password hashing plus server-side access control.
