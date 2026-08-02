-- =============================================================
-- OBoost Manager — Grants for machine history / assignments
-- Run after 13_machine_details_schema.sql.
--
-- machine_assignments, cleaning_logs, and maintenance_reports have
-- always had correct RLS policies, but — like machines (11) and
-- employees (12) before them — were never given the base grant a
-- client-side query needs before RLS is even evaluated. Phase B/D
-- are the first features to read these tables directly, so this
-- closes that gap proactively instead of hitting it as a bug later.
--
-- No RLS policy is created, changed, or removed here.
-- =============================================================

-- Needed both for the machine details page's own assignment display,
-- and because the RLS policies on machines/cleaning_logs/maintenance_reports
-- reference machine_assignments via a plain subquery (not a security-definer
-- function), which is evaluated with the caller's own privileges.
grant select on public.machine_assignments to authenticated;

-- Cleaning history display. INSERT is intentionally not granted:
-- cleaning_logs is only ever written via the mark_machine_cleaned()
-- RPC, which runs as its own owner and does not need this grant.
grant select on public.cleaning_logs to authenticated;

-- Malfunction history display, and the "mark in progress" transition
-- (a plain single-column update, already correctly gated by the
-- existing "maintenance_reports: update elevated only" RLS policy).
-- INSERT and the "resolved" transition go through dedicated RPCs
-- instead (15/16), so INSERT is intentionally not granted here.
grant select, update on public.maintenance_reports to authenticated;
