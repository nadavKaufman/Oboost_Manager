-- =============================================================
-- OBoost Manager — machines INSERT grant (Add Machine)
-- Run after 27_employees_select_grant.sql.
--
-- "machines: insert elevated only" RLS (03_rls.sql) already
-- restricts creation to managers, but — the same recurring gap as
-- machines UPDATE (11), employees INSERT (12)/SELECT (27) — no base
-- INSERT grant was ever added for authenticated, so a manager could
-- never actually create a machine even though RLS already allowed it.
-- =============================================================

grant insert on public.machines to authenticated;
