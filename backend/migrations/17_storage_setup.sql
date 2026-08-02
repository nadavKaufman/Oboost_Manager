-- =============================================================
-- OBoost Manager — Storage setup for machine images and malfunction photos
-- Run after 16_malfunction_rpcs.sql.
--
-- One shared public bucket. Public only for READS (Supabase serves
-- public-bucket objects via URL without evaluating storage.objects
-- RLS for GET requests) — every write path is still explicitly
-- gated below, and file size/type are also enforced at the bucket
-- level as a second line of defense behind the frontend validation.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'oboost-media',
  'oboost-media',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Machine images: manager-only, must live under machines/{machine_id}/...
create policy "oboost-media: manager upload machine images"
  on storage.objects for insert
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'machines'
    and public.is_admin_or_manager()
  );

-- Malfunction photos: any authenticated user, but only inside their
-- own uid folder — malfunctions/{auth.uid()}/... — so no one can
-- write into another user's folder.
create policy "oboost-media: user upload own malfunction photos"
  on storage.objects for insert
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'malfunctions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
