-- =============================================================
-- OBoost Manager — Storage bucket config upsert fix
-- Run after 29_task_completion_photo.sql.
--
-- 17_storage_setup.sql created the oboost-media bucket with
-- `on conflict (id) do nothing`. If the bucket already existed
-- (e.g. created once by hand via the Supabase dashboard, which
-- defaults to a *private*, unrestricted bucket) before that
-- migration ever ran, the insert silently no-oped and the bucket
-- was left public=false / without the intended size+mime limits —
-- every upload or read would then fail or misbehave regardless of
-- how correct the Storage policies are, across all four upload
-- features at once, since they all share this one bucket.
--
-- This re-applies the intended config unconditionally.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'oboost-media',
  'oboost-media',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
