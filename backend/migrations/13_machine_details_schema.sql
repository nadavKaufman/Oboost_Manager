-- =============================================================
-- OBoost Manager — Machine Details Schema
-- Run after 12_employees_insert_grant.sql in the Supabase SQL Editor.
--
-- Adds the fields needed for the machine details page (Phase B)
-- and malfunction photos (Phase D). Purely additive — no existing
-- column, constraint, or row is touched.
-- =============================================================

alter table public.machines
  add column if not exists address text not null default '';

alter table public.machines
  add column if not exists image_url text;

alter table public.maintenance_reports
  add column if not exists photo_url text;
