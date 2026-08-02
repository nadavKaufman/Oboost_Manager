-- =============================================================
-- OBoost Manager — Malfunction reporting + resolution RPCs
-- Run after 15_machine_assignment_rpcs.sql.
--
-- report_machine_malfunction(): atomically inserts the report and
-- sets the machine to 'fault'. Authorization mirrors mark_machine_cleaned:
-- manager, or an employee actively assigned to the machine.
--
-- The existing maintenance_report_fault_escalation trigger (02_triggers.sql)
-- still fires on insert for high/critical severity, but since this
-- function unconditionally sets fault_status = 'fault' itself right
-- after, the trigger becomes a harmless no-op duplicate rather than
-- the mechanism this workflow depends on.
--
-- resolve_maintenance_report(): manager-only. Resolves the selected
-- report, then only clears the machine's fault_status if no other
-- open/in_progress report remains for that machine.
-- =============================================================

create or replace function public.report_machine_malfunction(
  p_machine_id  uuid,
  p_description text,
  p_fault_type  text default 'other',
  p_severity    text default 'low',
  p_photo_url   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_report_id uuid;
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
    raise exception 'Not authorized to report a malfunction for this machine.';
  end if;

  insert into public.maintenance_reports
    (machine_id, reported_by, description, fault_type, severity, photo_url)
  values
    (p_machine_id, v_uid, p_description, coalesce(p_fault_type, 'other'), coalesce(p_severity, 'low'), p_photo_url)
  returning id into v_report_id;

  update public.machines
  set fault_status = 'fault'
  where id = p_machine_id;

  return v_report_id;
end;
$$;

create or replace function public.resolve_maintenance_report(
  p_report_id        uuid,
  p_resolution_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_machine_id     uuid;
  v_remaining_open integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() <> 'manager' then
    raise exception 'Not authorized to resolve malfunction reports.';
  end if;

  select machine_id into v_machine_id
  from public.maintenance_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Malfunction report not found.';
  end if;

  update public.maintenance_reports
  set status           = 'resolved',
      resolved_by      = v_uid,
      resolved_at      = now(),
      resolution_notes = p_resolution_notes
  where id = p_report_id;

  -- Only clear the machine's malfunction state if no other report on
  -- this machine is still open or in progress.
  select count(*) into v_remaining_open
  from public.maintenance_reports
  where machine_id = v_machine_id
    and id <> p_report_id
    and status in ('open', 'in_progress');

  if v_remaining_open = 0 then
    update public.machines
    set fault_status = 'ok'
    where id = v_machine_id;
  end if;
end;
$$;

revoke execute on function public.report_machine_malfunction(uuid, text, text, text, text) from public;
revoke execute on function public.report_machine_malfunction(uuid, text, text, text, text) from anon;
grant  execute on function public.report_machine_malfunction(uuid, text, text, text, text) to authenticated;

revoke execute on function public.resolve_maintenance_report(uuid, text) from public;
revoke execute on function public.resolve_maintenance_report(uuid, text) from anon;
grant  execute on function public.resolve_maintenance_report(uuid, text) to authenticated;
