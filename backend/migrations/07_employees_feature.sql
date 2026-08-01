-- =============================================================
-- OBoost Manager — Employees Feature
-- Run after 06_admin_user.sql in the Supabase SQL Editor.
--
-- The employees table (05_employees.sql) lets admins/managers
-- manage staff. Creating an employee from the frontend creates
-- an auth user (signUp), inserts into employees, and updates the
-- profile role. This requires admins/managers to be able to update
-- profiles rows — including changing roles.
--
-- The original "profiles: update own" policy only allowed MANAGERS
-- to change roles. Replace it so ADMINS can too (manager kept).
-- =============================================================

drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: update own or elevated"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin_or_manager())
  with check (
    public.is_admin_or_manager()
    or (
      id = auth.uid()
      and role = (select p.role from public.profiles p where p.id = auth.uid())
    )
  );
