-- =============================================================
-- OBoost Manager — employees.show_in_directory
-- Run after 35_machine_image_and_malfunction_photo_columns.sql.
--
-- Additive, idempotent: adds one nullable-free boolean column with a
-- default, nothing else. No RLS, RPC, or grant changes — the existing
-- table-level grants/policies on public.employees already cover any
-- column added to it. Existing rows all get true (no behavior change
-- for any current employee); only rows explicitly flipped to false
-- are excluded from directory listings.
-- =============================================================

alter table public.employees
  add column if not exists show_in_directory boolean not null default true;

notify pgrst, 'reload schema';
