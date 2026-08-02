-- =============================================================
-- OBoost Manager — Machine assignment RPCs
-- Run after 14_machine_history_grants.sql.
--
-- Assign/unassign are manager-only actions. Both are implemented
-- as atomic, security-definer functions rather than plain client
-- inserts/updates so that:
--   - reassigning a previously-unassigned employee safely reactivates
--     their existing history row instead of creating a duplicate
--   - the manager-only check can't be bypassed by calling the table
--     API directly (no INSERT/UPDATE grant is given on
--     machine_assignments to authenticated at all — see 14).
-- =============================================================

create or replace function public.assign_employee_to_machine(p_machine_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() <> 'manager' then
    raise exception 'Not authorized to assign employees.';
  end if;

  -- Reactivate the most recent inactive assignment row for this pair,
  -- if one exists. Selecting by primary key + LIMIT 1 guarantees at
  -- most one row is ever touched, so this can never violate the
  -- unique-active-assignment index even if older inactive history
  -- rows exist for the same (machine_id, user_id) pair.
  update public.machine_assignments
  set is_active     = true,
      unassigned_at = null,
      assigned_by   = auth.uid(),
      assigned_at   = now()
  where id = (
    select id
    from public.machine_assignments
    where machine_id = p_machine_id
      and user_id    = p_user_id
      and is_active  = false
    order by unassigned_at desc nulls last, assigned_at desc
    limit 1
  );

  if not found then
    -- No inactive row to reactivate. Insert a new one, but only if
    -- this pair isn't already actively assigned (defensive; the
    -- partial unique index on (machine_id, user_id) where is_active
    -- also guarantees this at the storage level).
    insert into public.machine_assignments (machine_id, user_id, assigned_by)
    select p_machine_id, p_user_id, auth.uid()
    where not exists (
      select 1 from public.machine_assignments
      where machine_id = p_machine_id and user_id = p_user_id and is_active = true
    );
  end if;
end;
$$;

create or replace function public.unassign_employee_from_machine(p_machine_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() <> 'manager' then
    raise exception 'Not authorized to unassign employees.';
  end if;

  -- Deactivate rather than delete, preserving assignment history.
  update public.machine_assignments
  set is_active     = false,
      unassigned_at = now()
  where machine_id = p_machine_id
    and user_id    = p_user_id
    and is_active  = true;
end;
$$;

revoke execute on function public.assign_employee_to_machine(uuid, uuid) from public;
revoke execute on function public.assign_employee_to_machine(uuid, uuid) from anon;
grant  execute on function public.assign_employee_to_machine(uuid, uuid) to authenticated;

revoke execute on function public.unassign_employee_from_machine(uuid, uuid) from public;
revoke execute on function public.unassign_employee_from_machine(uuid, uuid) from anon;
grant  execute on function public.unassign_employee_from_machine(uuid, uuid) to authenticated;
