-- =============================================================
-- OBoost Manager — Restore missing Storage INSERT policies
-- Run after 30_storage_bucket_upsert_fix.sql.
--
-- Manual verification against the live project found the
-- oboost-media bucket exists (public) with only two of the four
-- INSERT policies from 17_storage_setup.sql / 26_employee_photos.sql
-- / 29_task_completion_photo.sql present:
--   present: "oboost-media: manager upload employee photos"
--            "oboost-media: user upload own task completion photos"
--   missing: "oboost-media: manager upload machine images"
--            "oboost-media: user upload own malfunction photos"
--
-- This migration re-adds only the two missing policies, verbatim
-- from 17_storage_setup.sql. `drop policy if exists` + `create
-- policy` makes it safe to run again without erroring or
-- duplicating; the two already-present policies are not touched.
-- =============================================================

drop policy if exists "oboost-media: manager upload machine images" on storage.objects;

create policy "oboost-media: manager upload machine images"
  on storage.objects for insert
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'machines'
    and public.is_admin_or_manager()
  );

drop policy if exists "oboost-media: user upload own malfunction photos" on storage.objects;

create policy "oboost-media: user upload own malfunction photos"
  on storage.objects for insert
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'malfunctions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
