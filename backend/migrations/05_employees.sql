-- =============================================================
-- OBoost Manager — Employees Table
-- Run after 04_cron.sql in the Supabase SQL Editor.
-- employee_id is a 1:1 link to public.profiles (which is itself
-- 1:1 with auth.users).
-- =============================================================

create table public.employees (
  employee_id  uuid        primary key references public.profiles(id) on delete cascade,
  first_name   text        not null default '',
  last_name    text        not null default '',
  email        text        not null unique,
  phone_number text        not null default '',
  hire_date    date,
  job_title    text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger employees_updated_at
  before update on public.employees
  for each row execute function public.handle_updated_at();

-- ================================================================
-- Row Level Security
-- ================================================================
alter table public.employees enable row level security;

-- SELECT: own row for anyone; all rows for admin/manager
create policy "employees: select own or elevated"
  on public.employees for select
  using (
    employee_id = auth.uid()
    or public.is_admin_or_manager()
  );

-- INSERT: admin and manager only
create policy "employees: insert elevated only"
  on public.employees for insert
  with check (public.is_admin_or_manager());

-- UPDATE: admin/manager can update any row; employees can update their own
create policy "employees: update own or elevated"
  on public.employees for update
  using (
    employee_id = auth.uid()
    or public.is_admin_or_manager()
  );

-- DELETE: no one deletes employees
create policy "employees: delete blocked"
  on public.employees for delete
  using (false);
