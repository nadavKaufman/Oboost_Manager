-- =============================================================
-- OBoost Manager — employees SELECT grant
-- Run after 26_employee_photos.sql.
--
-- employees has had an INSERT grant since 12_employees_insert_grant.sql
-- (needed for Add Employee), but SELECT was never explicitly granted —
-- the same recurring gap already found and fixed for machines (11),
-- machine_assignments/cleaning_logs/maintenance_reports (14). Without
-- it, getEmployees() gets a permission-denied error, which the
-- frontend's error handling silently turns into an empty array —
-- looking exactly like "no employees exist" (the manager task-creation
-- selector and the All Employees page both consume this same query).
--
-- RLS ("employees: select own or elevated") is completely unchanged
-- and still governs the actual row-level result: a manager sees every
-- row, a regular employee still only ever sees their own.
-- =============================================================

grant select on public.employees to authenticated;
