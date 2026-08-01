-- =============================================================
-- OBoost Manager — Triggers
-- Run after 01_schema.sql.
-- =============================================================

-- ----------------------------------------------------------------
-- updated_at helper (not security definer — caller already has permission)
-- ----------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger machines_updated_at
  before update on public.machines
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------
-- Auto-create a profiles row when a new auth user is created.
-- security definer: runs as function owner to bypass RLS
-- (profiles has INSERT blocked for clients).
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'employee'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- Log cleaning_status changes to machine_status_history.
-- security definer: machine_status_history has INSERT blocked for clients.
-- ----------------------------------------------------------------
create or replace function public.handle_cleaning_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.cleaning_status is distinct from new.cleaning_status then
    insert into public.machine_status_history
      (machine_id, changed_by, old_status, new_status, reason)
    values (
      new.id,
      null,
      old.cleaning_status,
      new.cleaning_status,
      case when new.cleaning_status = 'clean' then 'machine_cleaned' else 'cron_update' end
    );
  end if;
  return new;
end;
$$;

create trigger machines_cleaning_status_history
  after update of cleaning_status on public.machines
  for each row execute function public.handle_cleaning_status_change();

-- ----------------------------------------------------------------
-- Log fault_status changes to machine_status_history.
-- security definer: same reason as above.
-- ----------------------------------------------------------------
create or replace function public.handle_fault_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.fault_status is distinct from new.fault_status then
    insert into public.machine_status_history
      (machine_id, changed_by, old_status, new_status, reason)
    values (
      new.id,
      null,
      old.fault_status,
      new.fault_status,
      'fault_status_change'
    );
  end if;
  return new;
end;
$$;

create trigger machines_fault_status_history
  after update of fault_status on public.machines
  for each row execute function public.handle_fault_status_change();

-- ----------------------------------------------------------------
-- When a high/critical maintenance report is filed, set the machine
-- fault_status to 'fault' automatically.
-- security definer: the reporter may be a worker/employee who lacks
-- UPDATE permission on machines.
-- ----------------------------------------------------------------
create or replace function public.handle_high_severity_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity in ('high', 'critical') then
    update public.machines
    set fault_status = 'fault'
    where id = new.machine_id
      and fault_status = 'ok';
  end if;
  return new;
end;
$$;

create trigger maintenance_report_fault_escalation
  after insert on public.maintenance_reports
  for each row execute function public.handle_high_severity_report();
