-- =============================================================
-- OBoost Manager — Require resolution to go through the RPC
-- Run after 17_storage_setup.sql.
--
-- Migration 14 granted UPDATE on maintenance_reports to authenticated
-- so managers can make the plain "mark in progress" transition
-- directly. That same grant technically also permits a manager to set
-- status = 'resolved' via a direct client update, bypassing
-- resolve_maintenance_report()'s atomic check for other still-open
-- reports on the same machine — which could leave machines.fault_status
-- out of sync with the report history.
--
-- This tightens the existing "maintenance_reports: update elevated
-- only" policy (03_rls.sql) with a WITH CHECK that blocks any direct
-- update from leaving a row with status = 'resolved'. The policy's
-- USING clause (who may attempt an update at all) is untouched, so
-- employee restrictions are unchanged and managers can still make
-- any other update (including open -> in_progress) directly.
--
-- resolve_maintenance_report() is SECURITY DEFINER, so it runs as its
-- owner and is not subject to this policy at all — it remains the
-- only path that can ever set status = 'resolved'.
-- =============================================================

alter policy "maintenance_reports: update elevated only"
  on public.maintenance_reports
  with check (
    public.is_admin_or_manager()
    and status <> 'resolved'
  );
