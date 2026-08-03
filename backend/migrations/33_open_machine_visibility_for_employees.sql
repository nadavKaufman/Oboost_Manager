-- =============================================================
-- OBoost Manager — Open machine visibility to all employees
-- Run after 32_machines_select_grant.sql.
--
-- Product change: machine_assignments is no longer used as an
-- authorization gate for viewing machines, viewing cleaning/
-- malfunction history, marking a machine cleaned, or reporting a
-- malfunction. Every authenticated user can now do all of the
-- above for any ACTIVE machine; managers additionally keep full
-- visibility of inactive machines.
--
-- machine_assignments itself, its RLS policies, and its RPCs
-- (assign_employee_to_machine / unassign_employee_from_machine)
-- are untouched — the table and its history are kept intact for
-- task-assignment and possible future use, per instruction. Task
-- creation/assignment behavior is entirely unaffected by this file.
--
-- Manager-only actions are unaffected: machines INSERT/UPDATE RLS
-- (03_rls.sql), mark_machine_working (wherever it lives), and every
-- frontend manager-only gate are untouched.
-- =============================================================

-- machines: any authenticated user sees every active machine;
-- managers additionally see inactive ones. Replaces the previous
-- "assigned via machine_assignments OR elevated" check.
alter policy "machines: select own or elevated"
  on public.machines
  using (
    public.is_admin_or_manager()
    or is_active = true
  );

-- cleaning_logs: visible for any active machine, or everything for
-- a manager. Replaces the previous assignment-based check.
alter policy "cleaning_logs: select own or elevated"
  on public.cleaning_logs
  using (
    public.is_admin_or_manager()
    or exists (
      select 1 from public.machines m
      where m.id = cleaning_logs.machine_id
        and m.is_active = true
    )
  );

-- maintenance_reports: visible for any active machine, or a report
-- the user filed themself (kept as a fallback in case a machine is
-- later deactivated), or everything for a manager. Replaces the
-- previous assignment-based check.
alter policy "maintenance_reports: select own or elevated"
  on public.maintenance_reports
  using (
    public.is_admin_or_manager()
    or reported_by = auth.uid()
    or exists (
      select 1 from public.machines m
      where m.id = maintenance_reports.machine_id
        and m.is_active = true
    )
  );

-- mark_machine_cleaned(): any authenticated user may clean any
-- active machine; managers may still clean any machine at all.
-- Replaces the previous "manager OR actively assigned" check.
create or replace function public.mark_machine_cleaned(p_machine_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid                 uuid := auth.uid();
  v_previous_cleaned_at timestamptz;
  v_is_active            boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select last_cleaned_at, is_active
  into v_previous_cleaned_at, v_is_active
  from public.machines
  where id = p_machine_id
  for update;

  if not found then
    raise exception 'Machine does not exist.';
  end if;

  if not (public.get_my_role() = 'manager' or v_is_active) then
    raise exception 'Not authorized to clean this machine.';
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

-- report_machine_malfunction(): any authenticated user may report a
-- malfunction on any active machine; managers may still report on
-- any machine at all. Replaces the previous "manager OR actively
-- assigned" check.
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
  v_is_active boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select is_active into v_is_active
  from public.machines
  where id = p_machine_id;

  if not found then
    raise exception 'Machine does not exist.';
  end if;

  if not (public.get_my_role() = 'manager' or v_is_active) then
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

revoke execute on function public.report_machine_malfunction(uuid, text, text, text, text) from public;
revoke execute on function public.report_machine_malfunction(uuid, text, text, text, text) from anon;
grant  execute on function public.report_machine_malfunction(uuid, text, text, text, text) to authenticated;
