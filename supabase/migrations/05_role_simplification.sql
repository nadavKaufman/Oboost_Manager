-- =============================================================
-- OBoost Manager — Role Simplification
-- Run after 04_cron.sql, against the existing live database.
--
-- Reduces the role system from four roles (employee, worker, admin,
-- manager) down to two (employee, manager).
--   admin  -> manager   (keeps elevated access, no functionality lost)
--   worker -> employee
--
-- Order matters: existing rows are migrated to valid values BEFORE
-- the CHECK constraint is tightened, otherwise the ALTER TABLE would
-- fail against any row still holding 'worker' or 'admin'.
-- =============================================================

-- ----------------------------------------------------------------
-- 1. Migrate existing profile rows to the new two-role model.
-- ----------------------------------------------------------------
update public.profiles set role = 'manager'  where role = 'admin';
update public.profiles set role = 'employee' where role = 'worker';

-- ----------------------------------------------------------------
-- 2. Replace the role CHECK constraint so only the two remaining
--    roles are valid going forward.
-- ----------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('employee', 'manager'));

-- ----------------------------------------------------------------
-- 3. Redefine is_admin_or_manager() to mean "is manager".
--    Name is kept unchanged deliberately: every RLS policy in
--    03_rls.sql calls it by name, so CREATE OR REPLACE here means
--    zero policies need to be dropped or recreated.
-- ----------------------------------------------------------------
create or replace function public.is_admin_or_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.get_my_role() = 'manager';
$$;
