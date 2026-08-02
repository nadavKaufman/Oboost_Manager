-- =============================================================
-- OBoost Manager — Task completion photo (Task 7)
-- Run after 28_machines_insert_grant.sql.
--
-- Adds an optional completion_photo_url column and threads it
-- through complete_task(), which already guards against completing
-- a task twice (see 21_tasks.sql) — that same guard makes the photo
-- immutable too, since the whole row becomes unwritable once
-- status = 'completed'.
-- =============================================================

alter table public.tasks add column completion_photo_url text;

create or replace function public.complete_task(
  p_task_id uuid,
  p_completion_notes text default null,
  p_completion_photo_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_to uuid;
  v_status      text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select assigned_to, status into v_assigned_to, v_status
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Task not found.';
  end if;

  if not (public.get_my_role() = 'manager' or v_assigned_to = auth.uid()) then
    raise exception 'Not authorized to complete this task.';
  end if;

  -- Idempotency guard: prevents a repeated call (double-click, retry,
  -- or a direct RPC call) from overwriting the original completed_at /
  -- completion_notes / completion_photo_url of an already-completed task.
  if v_status = 'completed' then
    raise exception 'Task is already completed.';
  end if;

  update public.tasks
  set status               = 'completed',
      completed_at         = now(),
      completion_notes     = p_completion_notes,
      completion_photo_url = p_completion_photo_url
  where id = p_task_id;
end;
$$;

drop function if exists public.complete_task(uuid, text);

revoke execute on function public.complete_task(uuid, text, text) from public;
revoke execute on function public.complete_task(uuid, text, text) from anon;
grant  execute on function public.complete_task(uuid, text, text) to authenticated;

-- Task completion photos: any authenticated user, but only inside
-- their own uid folder — tasks/{auth.uid()}/... — same convention as
-- malfunction photos (17_storage_setup.sql).
create policy "oboost-media: user upload own task completion photos"
  on storage.objects for insert
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'tasks'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
