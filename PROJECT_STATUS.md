# OBoost Manager — Project Status

This document tracks what is actually implemented right now. See `README.md` for setup, architecture, and stack details.

## 1. Stack

- React 19 + TypeScript + Vite
- React Router v7
- Pure CSS — no UI component library
- Supabase (PostgreSQL, Auth, Row Level Security, pg_cron)

## 2. Folder structure

```
src/
  components/
    auth/ProtectedRoute.tsx
    dashboard/MachineTable.tsx, StatCard.tsx, StatStrip.tsx, MachineIcon.tsx, BroomIcon.tsx, CleaningTaskBadge.tsx, CollapsibleSection.tsx
    layout/Sidebar.tsx, TopBar.tsx, DashboardLayout.tsx, LoadingScreen.tsx
  context/AuthContext.tsx
  lib/supabase.ts
  pages/Login.tsx, Dashboard.tsx, Machines.tsx, MachineDetails.tsx, ReportMalfunction.tsx, Employees.tsx, Reports.tsx, Tasks.tsx, Inventory.tsx, MyMachines.tsx, MyTasks.tsx, MyActivity.tsx, NotFound.tsx
  types/machine.ts
  styles/

backend/
  migrations/         01 through 36, hand-run in the Supabase SQL Editor in order
```

Database migrations live in `backend/migrations/` (not `supabase/migrations/` — that path no longer exists).

## 3. Migrations (`backend/migrations/`)

| File | Purpose |
|---|---|
| `01_schema.sql` | Core tables: profiles, machines, machine_assignments, cleaning_logs, maintenance_reports, machine_status_history |
| `02_triggers.sql` | Auto-create profile on signup; `updated_at` triggers; status-history logging; fault escalation on high-severity reports |
| `03_rls.sql` | Row Level Security policies for all tables in `01_schema.sql` |
| `04_cron.sql` | Daily pg_cron job that recomputes `cleaning_status` |
| `05_employees.sql` | Adds the `employees` table (1:1 with `profiles`) and its RLS policies |
| `06_admin_user.sql` | **Template.** Promotes a manager account by email — edit the placeholder email/name before running |
| `07_employees_feature.sql` | Widens the `profiles` update policy so managers can change roles (needed for the Add Employee flow) |
| `08_fix_admin_login.sql` | **Template.** Repairs a manually-created auth user missing its `auth.identities` row — edit the placeholder email before running |
| `09_role_simplification.sql` | Collapses the original four-role model (`employee`, `worker`, `admin`, `manager`) down to two (`employee`, `manager`); redefines `is_admin_or_manager()` to mean "is manager" |
| `10_mark_machine_cleaned.sql` | Atomic `security definer` RPC that persists "Mark Cleaned": updates `machines` and inserts into `cleaning_logs` in one call, with its own authorization check |
| `11`–`14` | Base table grants (`machines` UPDATE, `employees` INSERT) and machine-details columns/history grants that RLS alone doesn't cover — PostgREST also requires a table-level grant |
| `15_machine_assignment_rpcs.sql` | `assign_employee_to_machine()` / `unassign_employee_from_machine()`, manager-only |
| `16_malfunction_rpcs.sql` | Original `report_machine_malfunction()` / resolution RPCs, assignment-gated (later opened up by `33`) |
| `17`–`18` | Public storage bucket for machine images / malfunction photos; resolving a report must go through its RPC, not a direct update |
| `19_orange_inventory.sql`, `20_spare_parts.sql` | `inventory_items` / `inventory_transactions` — orange cartons, then spare parts reusing the same schema |
| `21_tasks.sql`, `22_inventory_stock_guard.sql` | `tasks` table with `create_task()` / `complete_task()` RPCs; guard against inventory going negative |
| `26`–`31` | Employee profile photos, remaining SELECT/INSERT grants, and storage bucket/policy fixes |
| `32_machines_select_grant.sql`, `33_open_machine_visibility_for_employees.sql` | `machines` SELECT grant; removes `machine_assignments` as the authorization gate — any authenticated user can now view/clean/report on any active machine (see §4/§6/§7) |
| `34_cleaning_task_type.sql` | Adds `tasks.task_type` (`general`/`cleaning`); completing a cleaning task now calls `mark_machine_cleaned()` in the same transaction |
| `35_machine_image_and_malfunction_photo_columns.sql` | Re-asserts `image_url`/`photo_url` columns and forces a PostgREST schema-cache reload |
| `36_employee_directory_visibility.sql` | Adds `employees.show_in_directory` |

All files are treated as applied history against the live database and are not rewritten in place; further schema changes should be added as new numbered files.

## 4. Role model

Two roles only: `employee`, `manager`. Enforced by a CHECK constraint on `profiles.role` and by RLS via `is_admin_or_manager()` (legacy name; the function itself now checks `role = 'manager'` exclusively). Manager routes: `/dashboard`, `/machines`, `/employees`, `/reports`, `/tasks`. Employee routes: `/my-machines`, `/my-tasks`, `/my-activity`. `/inventory` is shared by both roles. `/machines/:id` and `/machines/:id/report-malfunction` are open to any authenticated user. Since migration `33`, access to a machine's data/actions no longer depends on `machine_assignments` — any authenticated user can act on any active machine; managers additionally see inactive machines.

## 5. Page-by-page status

| Route | Status |
|---|---|
| `/login` | Email/password sign-in, public |
| `/` | Redirects to `/dashboard` (no standalone landing page) |
| `/dashboard` | **Live, manager-only.** Summary overview: stat cards (Total, Clean, Needs Cleaning, Overdue, Team) computed from live Supabase data, plus a fault alert banner. No full machine table here — see `/machines`. |
| `/machines` | **Live, manager-only.** Full machine table sourced from Supabase. Mark Cleaned and Mark as Working are both persisted. |
| `/machines/:id` | **Live.** Machine detail: cleaning history and malfunction history, sourced from Supabase. |
| `/machines/:id/report-malfunction` | **Live.** Persists a malfunction report via `report_machine_malfunction()` (description, fault type, severity, optional photo). |
| `/employees` | **Live, manager-only.** Employee list sourced from Supabase (`employees` joined with `profiles.role`). Managers can add new employees, which creates a real Supabase Auth account. |
| `/reports` | **Live, manager-only.** Tab-based history: Cleaning, Malfunctions, Orange Inventory, Spare Parts, Tasks — each paginated from Supabase. |
| `/tasks` | **Live, manager-only.** Create and assign tasks (general or cleaning) to an employee, optionally linked to a machine and a due date. |
| `/inventory` | **Live.** Orange-carton and spare-parts stock and transaction recording. |
| `/my-machines` | **Live, employee-facing.** The employee-facing equivalent of `/machines`. |
| `/my-tasks` | **Live, employee-facing.** An employee's own assigned tasks; completes with optional notes and a photo. |
| `/my-activity` | **Live, employee-facing.** An employee's own cleaning/malfunction activity history. |

All routes above except `/login` are behind `ProtectedRoute` and require an authenticated session. Unmatched paths render `NotFound`.

## 6. Mark Cleaned persistence

Implemented via the `mark_machine_cleaned` Postgres RPC (migration 10, superseded by migration 33). A single atomic call updates `machines.last_cleaned_at` / `next_cleaning_due_at` / `cleaning_status` and inserts a `cleaning_logs` row. The RPC performs its own authorization check (manager, or the machine is active) rather than relying solely on table-level RLS, since the `machines` UPDATE policy is manager-only but any authenticated user should still be able to clean an active machine. Completing a `cleaning`-type task (migration 34) calls this same RPC in the same transaction as the task completion.

## 7. Mark as Working

Implemented via `markMachineWorking()` in `src/lib/supabase.ts` — a direct `UPDATE` on `machines.fault_status`. Manager-only in the UI (`MachineTable.tsx` gates the button on `currentUserRole === 'manager'`) and enforced independently by the `machines: update elevated only` RLS policy.

## 8. Known incomplete features

- **Machine assignments** — the `machine_assignments` table, its RPCs (`assign_employee_to_machine` / `unassign_employee_from_machine`), and its RLS policies all exist, and assignment data is fetched into the app (`assignedEmployeeIds`), but no UI currently creates or displays an assignment. As of migration `33` this table is no longer used as an authorization gate either, so it's currently unused by the product.
- **No automated tests.**

## 9. Error handling policy

Raw Supabase/Postgres error messages are never shown to users. Every data-access function in `src/lib/supabase.ts` returns a short, generic, user-safe message on failure; the underlying error is logged with `console.error` only when `import.meta.env.DEV` is true. Applied consistently across `Login.tsx`, `Employees.tsx` (via `createEmployee`), `Machines.tsx`/`MyMachines.tsx` (via `markMachineWorking`/`markMachineCleaned`), `ReportMalfunction.tsx` (via `reportMachineMalfunction`), and `AuthContext.tsx`.

## 10. Deployment status

- **Primary target: Netlify**, under the project owner's own account. Build command `npm run build`, publish directory `dist`, SPA routing via `public/_redirects`.
- A generic `vercel.json` remains in the repo as an alternative path but is not the documented primary deployment.
- No production URL is live yet as of this writing.

## 11. Manual Supabase setup (for a fresh project)

1. Create a Supabase project.
2. Enable the `pg_cron` extension (Database → Extensions).
3. Run every file in `backend/migrations/` in order via the SQL Editor, 01 through 36 — editing the placeholder values in `06_admin_user.sql` and `08_fix_admin_login.sql` first if you need them.
4. Copy the Project URL and `anon public` key into `.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Never use the `service_role` key in this frontend.
5. Create your first user via signup or the Supabase Dashboard, then promote them to `manager`:
   ```sql
   update public.profiles set role = 'manager' where id = '<your-user-uuid>';
   ```
