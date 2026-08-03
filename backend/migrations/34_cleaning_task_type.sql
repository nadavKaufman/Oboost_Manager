-- =============================================================
-- OBoost Manager — Cleaning task type + auto-clean on completion
-- Run after 33_open_machine_visibility_for_employees.sql.
--
-- Adds a minimal, constrained task_type column ('general' | 'cleaning')
-- so cleaning tasks can be distinguished reliably from general tasks —
-- never inferred from the title. A cleaning task must be linked to a
-- machine (enforced both in create_task() and as a table CHECK, since
-- there is no direct INSERT grant on tasks and create_task() is the
-- only write path — the CHECK is defense in depth).
--
-- complete_task() is extended to call the existing mark_machine_cleaned()
-- RPC when completing a cleaning task, in the same transaction as the
-- completion itself: either both the task-completion and the cleaning
-- update commit together, or (if mark_machine_cleaned() raises, e.g.
-- because the machine somehow became inactive) neither does. Reusing
-- mark_machine_cleaned() means the authorization rule for "may this
-- user clean this machine" (03_rls.sql / 33_...sql: manager, or the
-- machine is active) is defined in exactly one place.
--
-- Repeated completion is already blocked by complete_task()'s existing
-- idempotency guard ("Task is already completed."), which fires before
-- the cleaning step ever runs a second time — so no separate dedup
-- logic is needed to avoid duplicate cleaning_logs rows.
-- =============================================================

alter table public.tasks
  add column if not exists task_type text not null default 'general'
    check (task_type in ('general', 'cleaning'));

alter table public.tasks
  add constraint tasks_cleaning_requires_machine
  check (task_type <> 'cleaning' or machine_id is not null);

-- create_task(): new p_task_type param, defaulting to 'general' so
-- existing callers are unaffected. A cleaning task must specify a
-- machine. Old 5-arg signature is dropped since PostgREST resolves
-- RPC calls by name + argument names, and keeping both would be
-- ambiguous/confusing for no benefit.
drop function if exists public.create_task(text, uuid, text, uuid, date);

create or replace function public.create_task(
  p_title       text,
  p_assigned_to uuid,
  p_description text default '',
  p_machine_id  uuid default null,
  p_due_date    date default null,
  p_task_type   text default 'general'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() <> 'manager' then
    raise exception 'Not authorized to create tasks.';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Task title is required.';
  end if;

  if not exists (select 1 from public.profiles where id = p_assigned_to) then
    raise exception 'Assigned employee not found.';
  end if;

  if p_task_type not in ('general', 'cleaning') then
    raise exception 'Invalid task type.';
  end if;

  if p_task_type = 'cleaning' and p_machine_id is null then
    raise exception 'A cleaning task must be linked to a machine.';
  end if;

  insert into public.tasks (title, description, assigned_to, assigned_by, machine_id, due_date, task_type)
  values (p_title, coalesce(p_description, ''), p_assigned_to, auth.uid(), p_machine_id, p_due_date, p_task_type)
  returning id into v_task_id;

  return v_task_id;
end;
$$;

revoke execute on function public.create_task(text, uuid, text, uuid, date, text) from public;
revoke execute on function public.create_task(text, uuid, text, uuid, date, text) from anon;
grant  execute on function public.create_task(text, uuid, text, uuid, date, text) to authenticated;

-- complete_task(): unchanged signature/authorization for completing the
-- task itself; additionally triggers the existing cleaning logic when
-- the task is a cleaning task linked to a machine.
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
  v_task_type   text;
  v_machine_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select assigned_to, status, task_type, machine_id
  into v_assigned_to, v_status, v_task_type, v_machine_id
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
  -- completion_notes / completion_photo_url of an already-completed
  -- task, and from ever running the cleaning step below more than once.
  if v_status = 'completed' then
    raise exception 'Task is already completed.';
  end if;

  update public.tasks
  set status               = 'completed',
      completed_at         = now(),
      completion_notes     = p_completion_notes,
      completion_photo_url = p_completion_photo_url
  where id = p_task_id;

  if v_task_type = 'cleaning' and v_machine_id is not null then
    perform public.mark_machine_cleaned(v_machine_id);
  end if;
end;
$$;

revoke execute on function public.complete_task(uuid, text, text) from public;
revoke execute on function public.complete_task(uuid, text, text) from anon;
grant  execute on function public.complete_task(uuid, text, text) to authenticated;
