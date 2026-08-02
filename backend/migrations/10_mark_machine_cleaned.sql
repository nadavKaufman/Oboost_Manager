-- =============================================================
-- OBoost Manager — Mark Machine Cleaned (atomic RPC)
-- Run after 09_role_simplification.sql in the Supabase SQL Editor.
--
-- Persists "Mark Cleaned": updates machines.last_cleaned_at /
-- next_cleaning_due_at / cleaning_status and inserts one
-- cleaning_logs row, in a single atomic call.
--
-- security definer: the machines UPDATE policy is manager-only,
-- but an employee with an active assignment to the machine should
-- still be able to mark their own machine clean. This function
-- bridges that gap by performing its own authorization check
-- (mirroring the existing "cleaning_logs: insert assigned or
-- elevated" policy) instead of relying on the table-level policy.
-- Role model is two roles only: employee, manager.
-- =============================================================

create or replace function public.mark_machine_cleaned(p_machine_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid                 uuid := auth.uid();
  v_previous_cleaned_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  if not (
    public.get_my_role() = 'manager'
    or exists (
      select 1
      from public.machine_assignments ma
      where ma.machine_id = p_machine_id
        and ma.user_id    = v_uid
        and ma.is_active  = true
    )
  ) then
    raise exception 'Not authorized to clean this machine.';
  end if;

  -- Lock the row and capture its prior last_cleaned_at before updating.
  select last_cleaned_at
  into v_previous_cleaned_at
  from public.machines
  where id = p_machine_id
  for update;

  if not found then
    raise exception 'Machine does not exist.';
  end if;

  update public.machines
  set last_cleaned_at      = now(),
      next_cleaning_due_at = now() + interval '21 days',
      cleaning_status      = 'clean'
  where id = p_machine_id;

  insert into public.cleaning_logs (machine_id, cleaned_by, cleaned_at, previous_cleaned_at)
  values (p_machine_id, v_uid, now(), v_previous_cleaned_at);
end;
$$;

revoke execute on function public.mark_machine_cleaned(uuid) from public;
revoke execute on function public.mark_machine_cleaned(uuid) from anon;
grant  execute on function public.mark_machine_cleaned(uuid) to authenticated;
