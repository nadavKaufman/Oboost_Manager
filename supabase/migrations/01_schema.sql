-- =============================================================
-- OBoost Manager — Schema
-- Run this first in the Supabase SQL Editor.
-- Requires: pg_cron extension enabled (for 04_cron.sql).
-- gen_random_uuid() is built-in on PostgreSQL 15+ (no extension needed).
-- =============================================================

-- ----------------------------------------------------------------
-- profiles
-- 1:1 with auth.users. Auto-created by trigger in 02_triggers.sql.
-- ----------------------------------------------------------------
create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text        not null default '',
  role       text        not null default 'employee'
               check (role in ('employee', 'worker', 'admin', 'manager')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- machines
-- cleaning_status is always computed/stored; cleaning interval is
-- fixed at 21 days (not configurable per machine).
-- ----------------------------------------------------------------
create table public.machines (
  id                   uuid        primary key default gen_random_uuid(),
  name                 text        not null,
  location             text        not null default '',
  model                text        not null default '',
  fault_status         text        not null default 'ok'
                         check (fault_status in ('ok', 'fault', 'maintenance')),
  maintenance_notes    text        not null default '',
  last_cleaned_at      timestamptz,
  next_cleaning_due_at timestamptz,
  cleaning_status      text        not null default 'clean'
                         check (cleaning_status in ('clean', 'needs_cleaning', 'overdue')),
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- machine_assignments
-- Many-to-many: a machine can be assigned to multiple workers,
-- a worker can be assigned to multiple machines.
-- Historical rows are kept; only is_active=true rows are current.
-- ----------------------------------------------------------------
create table public.machine_assignments (
  id            uuid        primary key default gen_random_uuid(),
  machine_id    uuid        not null references public.machines(id)  on delete cascade,
  user_id       uuid        not null references public.profiles(id)  on delete cascade,
  assigned_by   uuid        not null references public.profiles(id),
  assigned_at   timestamptz not null default now(),
  unassigned_at timestamptz,
  is_active     boolean     not null default true
);

-- Prevent duplicate active assignments for the same (machine, user) pair.
-- Multiple inactive historical rows are allowed.
create unique index unique_active_assignment
  on public.machine_assignments (machine_id, user_id)
  where is_active = true;

-- ----------------------------------------------------------------
-- cleaning_logs
-- Append-only audit log. One row per cleaning event.
-- ----------------------------------------------------------------
create table public.cleaning_logs (
  id                  uuid        primary key default gen_random_uuid(),
  machine_id          uuid        not null references public.machines(id)  on delete cascade,
  cleaned_by          uuid        not null references public.profiles(id),
  cleaned_at          timestamptz not null default now(),
  notes               text        not null default '',
  previous_cleaned_at timestamptz
);

-- ----------------------------------------------------------------
-- maintenance_reports
-- ----------------------------------------------------------------
create table public.maintenance_reports (
  id               uuid        primary key default gen_random_uuid(),
  machine_id       uuid        not null references public.machines(id)  on delete cascade,
  reported_by      uuid        not null references public.profiles(id),
  reported_at      timestamptz not null default now(),
  fault_type       text        not null default 'other',
  description      text        not null default '',
  severity         text        not null default 'low'
                     check (severity in ('low', 'medium', 'high', 'critical')),
  status           text        not null default 'open'
                     check (status in ('open', 'in_progress', 'resolved', 'closed')),
  resolved_by      uuid        references public.profiles(id),
  resolved_at      timestamptz,
  resolution_notes text
);

-- ----------------------------------------------------------------
-- machine_status_history
-- Append-only audit log of cleaning_status and fault_status changes.
-- Populated exclusively by triggers (02_triggers.sql).
-- ----------------------------------------------------------------
create table public.machine_status_history (
  id         uuid        primary key default gen_random_uuid(),
  machine_id uuid        not null references public.machines(id) on delete cascade,
  changed_by uuid        references public.profiles(id),
  old_status text        not null,
  new_status text        not null,
  changed_at timestamptz not null default now(),
  reason     text        not null default ''
);
