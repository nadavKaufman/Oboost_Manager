-- =============================================================
-- OBoost Manager — machines.image_url / maintenance_reports.photo_url
-- Run after 34_cleaning_task_type.sql.
--
-- Both columns are already declared in 13_machine_details_schema.sql:
--   alter table public.machines add column if not exists image_url text;
--   alter table public.maintenance_reports add column if not exists photo_url text;
-- This migration does not introduce new schema — it re-asserts the
-- same two additive, idempotent statements (safe no-ops if 13 was
-- already applied) and forces PostgREST to reload its schema cache,
-- since the reported runtime errors ("Could not find the 'image_url'
-- column ... in the schema cache" / "column photo_url ... does not
-- exist") are exactly the errors PostgREST raises either when a
-- column is genuinely missing, or when it exists but the API layer's
-- cached schema hasn't picked it up yet.
--
-- No existing column, constraint, or row is touched either way.
-- =============================================================

alter table public.machines
  add column if not exists image_url text;

alter table public.maintenance_reports
  add column if not exists photo_url text;

notify pgrst, 'reload schema';
