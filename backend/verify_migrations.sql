-- =====================================================================
-- OBoost Manager — Read-only migration/feature verification
-- Paste into Supabase SQL Editor and run once.
-- 100% read-only: only SELECT + system catalog lookups. No DDL/DML,
-- nothing is created, altered, or deleted.
-- =====================================================================

with checks(migration, category, object_name, present) as (
values

  -- ── 01 — base schema ────────────────────────────────────────────
  ('01', 'TABLE',  'public.profiles',                              to_regclass('public.profiles') is not null),
  ('01', 'TABLE',  'public.machines',                               to_regclass('public.machines') is not null),
  ('01', 'TABLE',  'public.machine_assignments',                    to_regclass('public.machine_assignments') is not null),
  ('01', 'TABLE',  'public.cleaning_logs',                          to_regclass('public.cleaning_logs') is not null),
  ('01', 'TABLE',  'public.maintenance_reports',                    to_regclass('public.maintenance_reports') is not null),
  ('01', 'TABLE',  'public.machine_status_history',                 to_regclass('public.machine_status_history') is not null),

  -- ── 02 — triggers/functions ─────────────────────────────────────
  ('02', 'FUNCTION', 'handle_updated_at()',              exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_updated_at')),
  ('02', 'FUNCTION', 'handle_new_user()',                exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_new_user')),
  ('02', 'FUNCTION', 'handle_cleaning_status_change()',  exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_cleaning_status_change')),
  ('02', 'FUNCTION', 'handle_fault_status_change()',     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_fault_status_change')),
  ('02', 'FUNCTION', 'handle_high_severity_report()',    exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_high_severity_report')),

  -- ── 03 — RLS core ───────────────────────────────────────────────
  ('03', 'FUNCTION', 'get_my_role()',                    exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_my_role')),
  ('03', 'FUNCTION', 'is_admin_or_manager()',             exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_admin_or_manager')),
  ('03', 'POLICY', 'profiles: select own or elevated',    exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles: select own or elevated')),
  ('03', 'POLICY', 'machines: select own or elevated',    exists (select 1 from pg_policies where schemaname='public' and tablename='machines' and policyname='machines: select own or elevated')),
  ('03', 'POLICY', 'machines: update elevated only',      exists (select 1 from pg_policies where schemaname='public' and tablename='machines' and policyname='machines: update elevated only')),
  ('03', 'POLICY', 'machine_assignments: select own or elevated', exists (select 1 from pg_policies where schemaname='public' and tablename='machine_assignments' and policyname='machine_assignments: select own or elevated')),
  ('03', 'POLICY', 'cleaning_logs: select own or elevated',       exists (select 1 from pg_policies where schemaname='public' and tablename='cleaning_logs' and policyname='cleaning_logs: select own or elevated')),
  ('03', 'POLICY', 'cleaning_logs: insert assigned or elevated',  exists (select 1 from pg_policies where schemaname='public' and tablename='cleaning_logs' and policyname='cleaning_logs: insert assigned or elevated')),
  ('03', 'POLICY', 'maintenance_reports: select own or elevated', exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_reports' and policyname='maintenance_reports: select own or elevated')),
  ('03', 'POLICY', 'maintenance_reports: insert assigned or elevated', exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_reports' and policyname='maintenance_reports: insert assigned or elevated')),
  ('03', 'POLICY', 'maintenance_reports: update elevated only',  exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_reports' and policyname='maintenance_reports: update elevated only')),

  -- ── 05 — employees ──────────────────────────────────────────────
  ('05', 'TABLE',  'public.employees',                             to_regclass('public.employees') is not null),
  ('05', 'POLICY', 'employees: select own or elevated',            exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees: select own or elevated')),
  ('05', 'POLICY', 'employees: insert elevated only',              exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees: insert elevated only')),

  -- ── 07 — profiles policy replaced ───────────────────────────────
  ('07', 'POLICY', 'profiles: update own or elevated (new)',       exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles: update own or elevated')),
  ('07', 'POLICY', 'profiles: update own (old, should be GONE)',   not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles: update own')),

  -- ── 09 — role simplification (employee/manager only) ────────────
  ('09', 'CONSTRAINT', 'profiles_role_check restricted to employee/manager',
      exists (
        select 1 from pg_constraint
        where conname = 'profiles_role_check'
          and pg_get_constraintdef(oid) ilike '%employee%'
          and pg_get_constraintdef(oid) ilike '%manager%'
          and pg_get_constraintdef(oid) not ilike '%worker%'
          and pg_get_constraintdef(oid) not ilike '%admin%'
      )),

  -- ── 10 — mark_machine_cleaned RPC ────────────────────────────────
  ('10', 'FUNCTION', 'mark_machine_cleaned(uuid)', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='mark_machine_cleaned')),
  ('10', 'EXEC GRANT', 'mark_machine_cleaned -> authenticated',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='mark_machine_cleaned' and has_function_privilege('authenticated', p.oid, 'EXECUTE'))),

  -- ── 11 — machines UPDATE grant ───────────────────────────────────
  ('11', 'GRANT', 'machines UPDATE -> authenticated',
      has_table_privilege('authenticated', 'public.machines', 'UPDATE')),

  -- ── 12 — employees INSERT grant ──────────────────────────────────
  ('12', 'GRANT', 'employees INSERT -> authenticated',
      has_table_privilege('authenticated', 'public.employees', 'INSERT')),

  -- ── 13 — machine details columns ─────────────────────────────────
  ('13', 'COLUMN', 'machines.address',            exists (select 1 from information_schema.columns where table_schema='public' and table_name='machines' and column_name='address')),
  ('13', 'COLUMN', 'machines.image_url',          exists (select 1 from information_schema.columns where table_schema='public' and table_name='machines' and column_name='image_url')),
  ('13', 'COLUMN', 'maintenance_reports.photo_url', exists (select 1 from information_schema.columns where table_schema='public' and table_name='maintenance_reports' and column_name='photo_url')),

  -- ── 14 — history/assignment grants ───────────────────────────────
  ('14', 'GRANT', 'machine_assignments SELECT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='machine_assignments' and grantee='authenticated' and privilege_type='SELECT')),
  ('14', 'GRANT', 'cleaning_logs SELECT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='cleaning_logs' and grantee='authenticated' and privilege_type='SELECT')),
  ('14', 'GRANT', 'maintenance_reports SELECT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='maintenance_reports' and grantee='authenticated' and privilege_type='SELECT')),
  ('14', 'GRANT', 'maintenance_reports UPDATE -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='maintenance_reports' and grantee='authenticated' and privilege_type='UPDATE')),

  -- ── 15 — machine assignment RPCs ─────────────────────────────────
  ('15', 'FUNCTION', 'assign_employee_to_machine(uuid,uuid)',   exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='assign_employee_to_machine')),
  ('15', 'FUNCTION', 'unassign_employee_from_machine(uuid,uuid)', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='unassign_employee_from_machine')),
  ('15', 'EXEC GRANT', 'assign_employee_to_machine -> authenticated',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='assign_employee_to_machine' and has_function_privilege('authenticated', p.oid, 'EXECUTE'))),

  -- ── 16 — malfunction RPCs ─────────────────────────────────────────
  ('16', 'FUNCTION', 'report_machine_malfunction(...)', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='report_machine_malfunction')),
  ('16', 'FUNCTION', 'resolve_maintenance_report(uuid,text)', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_maintenance_report')),
  ('16', 'EXEC GRANT', 'report_machine_malfunction -> authenticated',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='report_machine_malfunction' and has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  ('16', 'EXEC GRANT', 'resolve_maintenance_report -> authenticated',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resolve_maintenance_report' and has_function_privilege('authenticated', p.oid, 'EXECUTE'))),

  -- ── 17 — Storage ──────────────────────────────────────────────────
  ('17', 'STORAGE', 'oboost-media bucket exists + public',
      exists (select 1 from storage.buckets where id='oboost-media' and public = true)),
  ('17', 'STORAGE POLICY', 'manager upload machine images',
      exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='oboost-media: manager upload machine images')),
  ('17', 'STORAGE POLICY', 'user upload own malfunction photos',
      exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='oboost-media: user upload own malfunction photos')),

  -- ── 18 — resolution must go through RPC ───────────────────────────
  ('18', 'POLICY WITH CHECK', 'maintenance_reports update blocks direct status=resolved',
      exists (select 1 from pg_policies where schemaname='public' and tablename='maintenance_reports' and policyname='maintenance_reports: update elevated only' and with_check ilike '%resolved%')),

  -- ── 19 — orange inventory ──────────────────────────────────────────
  ('19', 'TABLE',  'public.inventory_items',        to_regclass('public.inventory_items') is not null),
  ('19', 'TABLE',  'public.inventory_transactions', to_regclass('public.inventory_transactions') is not null),
  ('19', 'DATA',   'orange_carton item seeded',     exists (select 1 from public.inventory_items where item_type='orange_carton')),
  ('19', 'POLICY', 'inventory_transactions: select own or elevated', exists (select 1 from pg_policies where schemaname='public' and tablename='inventory_transactions' and policyname='inventory_transactions: select own or elevated')),
  ('19', 'FUNCTION', 'get_orange_stock()',              exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_orange_stock')),
  ('19', 'FUNCTION', 'record_orange_delivery(...)',     exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_orange_delivery')),
  ('19', 'FUNCTION', 'record_orange_withdrawal(...)',   exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_orange_withdrawal')),
  ('19', 'FUNCTION', 'record_orange_adjustment(...)',   exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_orange_adjustment')),
  ('19', 'GRANT', 'inventory_items SELECT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='inventory_items' and grantee='authenticated' and privilege_type='SELECT')),
  ('19', 'GRANT', 'inventory_transactions SELECT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='inventory_transactions' and grantee='authenticated' and privilege_type='SELECT')),

  -- ── 20 — spare parts ────────────────────────────────────────────────
  ('20', 'POLICY', 'inventory_items: manager insert spare parts', exists (select 1 from pg_policies where schemaname='public' and tablename='inventory_items' and policyname='inventory_items: manager insert spare parts')),
  ('20', 'POLICY', 'inventory_items: manager update spare parts', exists (select 1 from pg_policies where schemaname='public' and tablename='inventory_items' and policyname='inventory_items: manager update spare parts')),
  ('20', 'GRANT', 'inventory_items INSERT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='inventory_items' and grantee='authenticated' and privilege_type='INSERT')),
  ('20', 'GRANT', 'inventory_items UPDATE -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='inventory_items' and grantee='authenticated' and privilege_type='UPDATE')),
  ('20', 'FUNCTION', 'get_spare_part_stock(uuid)',            exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_spare_part_stock')),
  ('20', 'FUNCTION', 'record_spare_part_delivery(...)',        exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_spare_part_delivery')),
  ('20', 'FUNCTION', 'record_spare_part_withdrawal(...)',      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_spare_part_withdrawal')),
  ('20', 'FUNCTION', 'record_spare_part_adjustment(...)',      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_spare_part_adjustment')),

  -- ── 21 — tasks ────────────────────────────────────────────────────────
  ('21', 'TABLE',  'public.tasks',                             to_regclass('public.tasks') is not null),
  ('21', 'POLICY', 'tasks: select own or elevated',             exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='tasks: select own or elevated')),
  ('21', 'GRANT',  'tasks SELECT -> authenticated',
      exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='tasks' and grantee='authenticated' and privilege_type='SELECT')),
  ('21', 'FUNCTION', 'create_task(...)',                       exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_task')),
  ('21', 'FUNCTION', 'complete_task(uuid,text)',                exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='complete_task')),
  ('21', 'BEHAVIOR', 'complete_task has idempotency guard (corrected version)',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='complete_task' and pg_get_functiondef(p.oid) ilike '%already completed%')),

  -- ── Informational only — not tied to a promised migration ──────────
  ('N/A', 'INFO', 'negative-stock guard on orange/spare-part withdrawal (NOT expected — informational only)',
      exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public'
          and p.proname in ('record_orange_withdrawal','record_spare_part_withdrawal')
          and (pg_get_functiondef(p.oid) ilike '%insufficient%' or pg_get_functiondef(p.oid) ilike '%negative%')
      ))
)
select
  migration,
  category,
  object_name,
  case when present then 'OK' else 'MISSING' end as status
from checks
order by
  case when migration = 'N/A' then 1 else 0 end,
  migration,
  category,
  object_name;
