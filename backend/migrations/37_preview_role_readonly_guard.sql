-- =============================================================
-- OBoost Manager — Read-only Preview role
-- Run after 36_employee_directory_visibility.sql.
--
-- Adds a third role, 'preview', for a single, publicly-documented
-- demo account. Preview reads the same live data a manager sees
-- (including inactive machines and full name resolution across
-- cleaning/malfunction/inventory/task history), but is blocked from
-- every write path:
--
--   - Every RPC that already requires get_my_role() = 'manager'
--     already rejects 'preview' with zero changes, since is_admin_
--     or_manager()/get_my_role() checks are unaffected by this file.
--   - Only the 5 RPCs that do NOT already have a manager-only check
--     (mark_machine_cleaned, report_machine_malfunction,
--     record_orange_withdrawal, record_spare_part_withdrawal,
--     complete_task — all open to "any authenticated user" by
--     product design) get an explicit preview guard added below,
--     each redefined from its latest superseding migration
--     (33 / 33 / 22 / 22 / 34 respectively) so no later fix is
--     accidentally reverted.
--   - The one direct-table write gap (profiles: update own) is
--     closed with one WITH CHECK addition.
--   - The two Storage policies open to "any authenticated user"
--     (malfunction photos, task completion photos) are closed to
--     preview the same way. The two manager-only Storage policies
--     already exclude preview automatically.
--
-- Employee email/phone are never exposed to preview: the existing
-- "employees: select own or elevated" policy is left untouched (it
-- already denies preview, which has no employees row and fails
-- is_admin_or_manager()), and a new SECURITY DEFINER function,
-- get_preview_employee_directory(), is the only path preview has to
-- employee data — email and phone are never selected by it.
--
-- This migration does not create the preview Auth user or set any
-- profile's role to 'preview' — that is a separate, one-time SQL
-- statement run after the account is created manually, per instruction.
--
-- Wrapped in a single transaction: every statement below is
-- transactional DDL, so either all of it applies or none of it does —
-- a failure partway through cannot leave the database in a mixed state.
-- =============================================================

begin;

-- ----------------------------------------------------------------
-- 1. Widen the role CHECK constraint.
-- ----------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('employee', 'manager', 'preview'));

-- ----------------------------------------------------------------
-- 2. Read-access widening — SELECT only, additive OR-clauses.
--    No INSERT/UPDATE/DELETE policy is touched in this section.
-- ----------------------------------------------------------------

-- machines: preview sees every machine, active or inactive (a real
-- manager already does; every other authenticated user already sees
-- active ones via the existing is_active branch from migration 33).
alter policy "machines: select own or elevated"
  on public.machines
  using (
    public.is_admin_or_manager()
    or is_active = true
    or public.get_my_role() = 'preview'
  );

-- cleaning_logs: preview also sees history for inactive machines,
-- matching full manager visibility.
alter policy "cleaning_logs: select own or elevated"
  on public.cleaning_logs
  using (
    public.is_admin_or_manager()
    or exists (
      select 1 from public.machines m
      where m.id = cleaning_logs.machine_id
        and m.is_active = true
    )
    or public.get_my_role() = 'preview'
  );

-- maintenance_reports: same as cleaning_logs above.
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
    or public.get_my_role() = 'preview'
  );

-- profiles: without this, every actor-name lookup used across the
-- app (cleaned_by, reported_by, resolved_by, recorded_by, assigned_to/
-- assigned_by) would resolve to "—" for preview, since those lookups
-- query profiles by id for someone other than the caller.
alter policy "profiles: select own or elevated"
  on public.profiles
  using (
    id = auth.uid()
    or public.is_admin_or_manager()
    or public.get_my_role() = 'preview'
  );

-- tasks: without this, the Tasks page would be empty for preview.
alter policy "tasks: select own or elevated"
  on public.tasks
  using (
    public.is_admin_or_manager()
    or assigned_to = auth.uid()
    or public.get_my_role() = 'preview'
  );

-- inventory_transactions: without this, Inventory/Reports movement
-- history would be empty for preview.
alter policy "inventory_transactions: select own or elevated"
  on public.inventory_transactions
  using (
    public.is_admin_or_manager()
    or recorded_by = auth.uid()
    or public.get_my_role() = 'preview'
  );

-- machine_assignments is deliberately left unchanged: a code search
-- (grep for assignedEmployeeIds / machine_assignments / assign*Machine
-- across every .tsx file) confirmed no page currently renders assigned-
-- employee data, so there is nothing for preview to see there.

-- ----------------------------------------------------------------
-- 3. Preview write guards — only the 5 RPCs that do not already
--    require get_my_role() = 'manager'. Bodies are the latest version
--    of each function (see header note for source migrations), with
--    only the guard block added.
-- ----------------------------------------------------------------

-- Latest base: 33_open_machine_visibility_for_employees.sql
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

  if public.get_my_role() = 'preview' then
    raise exception 'Read-only preview — changes are disabled.';
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

-- Latest base: 33_open_machine_visibility_for_employees.sql
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

  if public.get_my_role() = 'preview' then
    raise exception 'Read-only preview — changes are disabled.';
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

-- Latest base: 22_inventory_stock_guard.sql
create or replace function public.record_orange_withdrawal(p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id       uuid;
  v_txn_id        uuid;
  v_current_stock integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() = 'preview' then
    raise exception 'Read-only preview — changes are disabled.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  -- Lock the item row first: serializes concurrent withdrawals for
  -- this item so the stock check below can't race.
  select id into v_item_id
  from public.inventory_items
  where item_type = 'orange_carton'
  limit 1
  for update;

  select coalesce(sum(quantity), 0)::integer into v_current_stock
  from public.inventory_transactions
  where item_id = v_item_id;

  if v_current_stock - p_quantity < 0 then
    raise exception 'Insufficient stock.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (v_item_id, 'withdrawal', -p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

revoke execute on function public.record_orange_withdrawal(integer, text) from public;
revoke execute on function public.record_orange_withdrawal(integer, text) from anon;
grant  execute on function public.record_orange_withdrawal(integer, text) to authenticated;

-- Latest base: 22_inventory_stock_guard.sql
create or replace function public.record_spare_part_withdrawal(p_item_id uuid, p_quantity integer, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn_id        uuid;
  v_current_stock integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if public.get_my_role() = 'preview' then
    raise exception 'Read-only preview — changes are disabled.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number.';
  end if;

  -- Lock the item row first: serializes concurrent withdrawals for
  -- this item so the stock check below can't race.
  if not exists (
    select 1 from public.inventory_items
    where id = p_item_id and item_type = 'spare_part'
    for update
  ) then
    raise exception 'Spare part not found.';
  end if;

  select coalesce(sum(quantity), 0)::integer into v_current_stock
  from public.inventory_transactions
  where item_id = p_item_id;

  if v_current_stock - p_quantity < 0 then
    raise exception 'Insufficient stock.';
  end if;

  insert into public.inventory_transactions (item_id, transaction_type, quantity, recorded_by, notes)
  values (p_item_id, 'withdrawal', -p_quantity, auth.uid(), coalesce(p_notes, ''))
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

revoke execute on function public.record_spare_part_withdrawal(uuid, integer, text) from public;
revoke execute on function public.record_spare_part_withdrawal(uuid, integer, text) from anon;
grant  execute on function public.record_spare_part_withdrawal(uuid, integer, text) to authenticated;

-- Latest base: 34_cleaning_task_type.sql
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

  if public.get_my_role() = 'preview' then
    raise exception 'Read-only preview — changes are disabled.';
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

-- ----------------------------------------------------------------
-- 4. Close the one direct-table write gap: profiles' own-row update
--    (full_name / avatar_url) is allowed unconditionally today,
--    independent of elevation. Add the same preview exclusion here.
--    Base: 07_employees_feature.sql (the "or elevated" variant).
-- ----------------------------------------------------------------
alter policy "profiles: update own or elevated"
  on public.profiles
  using (id = auth.uid() or public.is_admin_or_manager())
  with check (
    public.is_admin_or_manager()
    or (
      id = auth.uid()
      and role = (select p.role from public.profiles p where p.id = auth.uid())
      and public.get_my_role() <> 'preview'
    )
  );

-- ----------------------------------------------------------------
-- 5. Sanitized employee directory for preview — email and phone are
--    never selected. Restricted to callers whose role is exactly
--    'preview'; execute is granted to authenticated only (anon/public
--    revoked) so no unauthenticated caller can reach it either.
-- ----------------------------------------------------------------
create or replace function public.get_preview_employee_directory(p_directory_only boolean default true)
returns table (
  employee_id uuid,
  first_name  text,
  last_name   text,
  job_title   text,
  hire_date   date,
  created_at  timestamptz,
  role        text,
  avatar_url  text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'preview' then
    raise exception 'Not authorized.';
  end if;

  return query
  select e.employee_id, e.first_name, e.last_name, e.job_title, e.hire_date, e.created_at, p.role, p.avatar_url
  from public.employees e
  join public.profiles p on p.id = e.employee_id
  where (not p_directory_only or e.show_in_directory = true);
end;
$$;

revoke execute on function public.get_preview_employee_directory(boolean) from public;
revoke execute on function public.get_preview_employee_directory(boolean) from anon;
grant  execute on function public.get_preview_employee_directory(boolean) to authenticated;

-- ----------------------------------------------------------------
-- 6. Storage — close the two upload policies open to "any
--    authenticated user". The two manager-only upload policies
--    (machine images, employee photos) already exclude preview
--    automatically, since preview is never 'manager'.
-- ----------------------------------------------------------------
alter policy "oboost-media: user upload own malfunction photos"
  on storage.objects
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'malfunctions'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.get_my_role() <> 'preview'
  );

alter policy "oboost-media: user upload own task completion photos"
  on storage.objects
  with check (
    bucket_id = 'oboost-media'
    and (storage.foldername(name))[1] = 'tasks'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.get_my_role() <> 'preview'
  );

commit;
