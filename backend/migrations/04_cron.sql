-- =============================================================
-- OBoost Manager — Scheduled Cron Job
-- Run after 03_rls.sql.
--
-- PREREQUISITE: pg_cron extension must be enabled first.
-- In Supabase Dashboard → Database → Extensions → enable pg_cron.
-- This file will error if pg_cron is not enabled.
--
-- Cleaning interval is fixed at 21 days for all machines.
-- =============================================================

-- ----------------------------------------------------------------
-- Daily job: update cleaning_status on all active machines.
--
-- Transitions (run once per day at 02:00 UTC):
--   clean         → needs_cleaning  when next_cleaning_due_at <= now()
--   needs_cleaning → overdue         when next_cleaning_due_at <= now() - interval '7 days'
--
-- Only rows that actually need to change are touched.
-- The UPDATE triggers handle_cleaning_status_change which appends
-- a row to machine_status_history automatically.
-- ----------------------------------------------------------------
select cron.schedule(
  'oboost-update-cleaning-status',   -- job name (unique)
  '0 2 * * *',                        -- every day at 02:00 UTC
  $$
    update public.machines
    set cleaning_status = case
      when cleaning_status = 'needs_cleaning'
        and next_cleaning_due_at <= now() - interval '7 days'
        then 'overdue'
      when cleaning_status = 'clean'
        and next_cleaning_due_at <= now()
        then 'needs_cleaning'
      else cleaning_status
    end
    where is_active = true
      and (
        (cleaning_status = 'clean'          and next_cleaning_due_at <= now())
        or
        (cleaning_status = 'needs_cleaning' and next_cleaning_due_at <= now() - interval '7 days')
      );
  $$
);

-- To verify the job was registered:
-- select * from cron.job;

-- To manually trigger a one-time run for testing:
-- select cron.run_job('oboost-update-cleaning-status');

-- To remove the job if needed:
-- select cron.unschedule('oboost-update-cleaning-status');
