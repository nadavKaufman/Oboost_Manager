-- =============================================================
-- OBoost Manager — Employee profile photos
-- Run after 22_inventory_stock_guard.sql.
--
-- No new column needed: public.profiles already has an unused
-- avatar_url column (from 01_schema.sql) — reused here instead of
-- adding a duplicate column on public.employees.
--
-- profiles never had a base UPDATE grant (deliberately, since
-- nothing needed it after the role-assignment step was removed from
-- createEmployee()). Managers setting another employee's avatar_url
-- is a genuine new need, so this adds it back. RLS is unchanged and
-- still fully gates who can update what: "profiles: update own or
-- elevated" already lets a manager update any row, and an employee
-- update only their own row and only if their own role is unchanged.
-- =============================================================

grant update on public.profiles to authenticated;

-- Employee photo uploads: manager-only, must live under
-- employees/{employee_id}/... in the existing shared bucket.
create policy "oboost-media: manager upload employee photos"
  on storage.objects for insert
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'employees'
    and public.is_admin_or_manager()
  );
