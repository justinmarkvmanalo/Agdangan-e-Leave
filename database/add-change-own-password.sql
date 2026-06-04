-- Adds employee self-service password change for the table-based login system.
-- This keeps the existing plain-text password behavior.

create or replace function public.change_own_password(
  p_role text,
  p_user_id bigint,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'New password must be at least 8 characters.';
  end if;

  if p_role = 'employee' then
    update public.employees
    set password = p_new_password
    where id = p_user_id
      and password = p_current_password
      and employment_status = 'active';

    get diagnostics updated_count = row_count;
    return updated_count = 1;
  end if;

  return false;
end;
$$;

grant execute on function public.change_own_password(text, bigint, text, text) to anon, authenticated;
