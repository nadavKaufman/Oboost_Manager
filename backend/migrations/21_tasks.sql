-- =============================================================
-- OBoost Manager — Employee Tasks (Phase G)
-- Run after 20_spare_parts.sql.
--
-- All writes go through RPCs — there is no INSERT/UPDATE grant on
-- tasks for authenticated at all, so the only way to create a task
-- is create_task() (manager-only, stamps assigned_by itself) and the
-- only way to change one is complete_task() (own task or manager,
-- and it can only ever set status to 'completed' — there is no
-- "reopen" path).
-- =============================================================

create table public.tasks (
  id               uuid        primary key default gen_random_uuid(),
  title            text        not null,
  description      text        not null default '',
  assigned_to      uuid        not null references public.profiles(id),
  assigned_by      uuid        not null references public.profiles(id),
  machine_id       uuid        references public.machines(id),
  due_date         date,
  status           text        not null default 'pending' check (status in ('pending', 'completed')),
  completion_notes text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

alter table public.tasks enable row level security;

-- SELECT: managers see all; employees see only their own tasks.
create policy "tasks: select own or elevated"
  on public.tasks for select
  using (
    public.is_admin_or_manager()
    or assigned_to = auth.uid()
  );

-- No client INSERT/UPDATE/DELETE policy — see header note.
create policy "tasks: insert blocked"
  on public.tasks for insert
  with check (false);

create policy "tasks: update blocked"
  on public.tasks for update
  using (false);

create policy "tasks: delete blocked"
  on public.tasks for delete
  using (false);

grant select on public.tasks to authenticated;

create or replace function public.create_task(
  p_title       text,
  p_assigned_to uuid,
  p_description text default '',
  p_machine_id  uuid default null,
  p_due_date    date default null
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

  insert into public.tasks (title, description, assigned_to, assigned_by, machine_id, due_date)
  values (p_title, coalesce(p_description, ''), p_assigned_to, auth.uid(), p_machine_id, p_due_date)
  returning id into v_task_id;

  return v_task_id;
end;
$$;

create or replace function public.complete_task(p_task_id uuid, p_completion_notes text default null)
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
  -- completion_notes of an already-completed task.
  if v_status = 'completed' then
    raise exception 'Task is already completed.';
  end if;

  update public.tasks
  set status           = 'completed',
      completed_at     = now(),
      completion_notes = p_completion_notes
  where id = p_task_id;
end;
$$;

revoke execute on function public.create_task(text, uuid, text, uuid, date) from public;
revoke execute on function public.create_task(text, uuid, text, uuid, date) from anon;
grant  execute on function public.create_task(text, uuid, text, uuid, date) to authenticated;

revoke execute on function public.complete_task(uuid, text) from public;
revoke execute on function public.complete_task(uuid, text) from anon;
grant  execute on function public.complete_task(uuid, text) to authenticated;
