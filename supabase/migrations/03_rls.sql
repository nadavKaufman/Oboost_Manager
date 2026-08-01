-- =============================================================
-- OBoost Manager — Row Level Security
-- Run after 02_triggers.sql.
-- Role hierarchy: employee < worker < admin < manager
-- =============================================================

-- ----------------------------------------------------------------
-- Helper: return the current user's role from profiles.
-- security definer + stable: cached per-query, safe for policy use.
-- ----------------------------------------------------------------
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.get_my_role() in ('admin', 'manager');
$$;

-- ================================================================
-- profiles
-- ================================================================
alter table public.profiles enable row level security;

-- SELECT: own row for anyone; all rows for admin/manager
create policy "profiles: select own or elevated"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin_or_manager()
  );

-- UPDATE: anyone can update their own name/avatar
-- Role changes require manager role (checked via with check)
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      -- role column unchanged — allow
      role = (select p.role from public.profiles p where p.id = auth.uid())
      -- or current user is a manager changing the role
      or public.get_my_role() = 'manager'
    )
  );

-- INSERT: blocked from clients (handled by handle_new_user trigger)
create policy "profiles: insert blocked"
  on public.profiles for insert
  with check (false);

-- DELETE: no one deletes profiles
create policy "profiles: delete blocked"
  on public.profiles for delete
  using (false);

-- ================================================================
-- machines
-- ================================================================
alter table public.machines enable row level security;

-- SELECT: admin/manager see all; others see only their assigned machines
create policy "machines: select own or elevated"
  on public.machines for select
  using (
    is_admin_or_manager()
    or exists (
      select 1 from public.machine_assignments ma
      where ma.machine_id = machines.id
        and ma.user_id    = auth.uid()
        and ma.is_active  = true
    )
  );

-- INSERT: admin and manager only
create policy "machines: insert elevated only"
  on public.machines for insert
  with check (public.is_admin_or_manager());

-- UPDATE: admin and manager only
create policy "machines: update elevated only"
  on public.machines for update
  using (public.is_admin_or_manager());

-- DELETE: no one (use is_active = false to decommission)
create policy "machines: delete blocked"
  on public.machines for delete
  using (false);

-- ================================================================
-- machine_assignments
-- ================================================================
alter table public.machine_assignments enable row level security;

-- SELECT: admin/manager see all; others see only their own assignments
create policy "machine_assignments: select own or elevated"
  on public.machine_assignments for select
  using (
    is_admin_or_manager()
    or user_id = auth.uid()
  );

-- INSERT/UPDATE: admin and manager only
create policy "machine_assignments: insert elevated only"
  on public.machine_assignments for insert
  with check (public.is_admin_or_manager());

create policy "machine_assignments: update elevated only"
  on public.machine_assignments for update
  using (public.is_admin_or_manager());

-- ================================================================
-- cleaning_logs
-- ================================================================
alter table public.cleaning_logs enable row level security;

-- SELECT: admin/manager see all; others see logs for their assigned machines
create policy "cleaning_logs: select own or elevated"
  on public.cleaning_logs for select
  using (
    is_admin_or_manager()
    or exists (
      select 1 from public.machine_assignments ma
      where ma.machine_id = cleaning_logs.machine_id
        and ma.user_id    = auth.uid()
        and ma.is_active  = true
    )
  );

-- INSERT: assigned users can log a clean; admin/manager always can
create policy "cleaning_logs: insert assigned or elevated"
  on public.cleaning_logs for insert
  with check (
    is_admin_or_manager()
    or exists (
      select 1 from public.machine_assignments ma
      where ma.machine_id = cleaning_logs.machine_id
        and ma.user_id    = auth.uid()
        and ma.is_active  = true
    )
  );

-- UPDATE/DELETE: append-only — no one modifies past logs
create policy "cleaning_logs: update blocked"
  on public.cleaning_logs for update
  using (false);

create policy "cleaning_logs: delete blocked"
  on public.cleaning_logs for delete
  using (false);

-- ================================================================
-- maintenance_reports
-- ================================================================
alter table public.maintenance_reports enable row level security;

-- SELECT: admin/manager see all; others see reports they filed
-- or reports for machines they are assigned to
create policy "maintenance_reports: select own or elevated"
  on public.maintenance_reports for select
  using (
    is_admin_or_manager()
    or reported_by = auth.uid()
    or exists (
      select 1 from public.machine_assignments ma
      where ma.machine_id = maintenance_reports.machine_id
        and ma.user_id    = auth.uid()
        and ma.is_active  = true
    )
  );

-- INSERT: assigned users or admin/manager
create policy "maintenance_reports: insert assigned or elevated"
  on public.maintenance_reports for insert
  with check (
    is_admin_or_manager()
    or exists (
      select 1 from public.machine_assignments ma
      where ma.machine_id = maintenance_reports.machine_id
        and ma.user_id    = auth.uid()
        and ma.is_active  = true
    )
  );

-- UPDATE: only admin/manager can resolve reports
create policy "maintenance_reports: update elevated only"
  on public.maintenance_reports for update
  using (public.is_admin_or_manager());

-- ================================================================
-- machine_status_history
-- ================================================================
alter table public.machine_status_history enable row level security;

-- SELECT: admin/manager see all; others see history for assigned machines
create policy "machine_status_history: select own or elevated"
  on public.machine_status_history for select
  using (
    is_admin_or_manager()
    or exists (
      select 1 from public.machine_assignments ma
      where ma.machine_id = machine_status_history.machine_id
        and ma.user_id    = auth.uid()
        and ma.is_active  = true
    )
  );

-- INSERT: blocked from clients — populated exclusively by triggers
create policy "machine_status_history: insert blocked"
  on public.machine_status_history for insert
  with check (false);

-- UPDATE/DELETE: no one
create policy "machine_status_history: update blocked"
  on public.machine_status_history for update
  using (false);

create policy "machine_status_history: delete blocked"
  on public.machine_status_history for delete
  using (false);
