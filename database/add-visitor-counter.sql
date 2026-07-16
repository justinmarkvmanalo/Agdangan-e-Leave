-- Visitor counter for landing page
-- Run this in Supabase SQL Editor

create table if not exists public.visitor_counter (
  id bigint primary key default 1,
  total_visits bigint not null default 0,
  constraint single_row check (id = 1)
);

alter table public.visitor_counter enable row level security;

drop policy if exists visitor_counter_select_all on public.visitor_counter;
create policy visitor_counter_select_all
on public.visitor_counter
for select
to anon, authenticated
using (true);

-- Insert initial row if not exists
insert into public.visitor_counter (id, total_visits)
values (1, 0)
on conflict (id) do nothing;

-- Atomic increment function
create or replace function public.increment_visitor_counter()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update public.visitor_counter
  set total_visits = total_visits + 1
  where id = 1
  returning total_visits into new_count;

  return new_count;
end;
$$;

-- Function to just read the count
create or replace function public.get_visitor_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select total_visits from public.visitor_counter where id = 1;
$$;
