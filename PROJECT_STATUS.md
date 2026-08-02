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
    dashboard/MachineTable.tsx, StatCard.tsx
    layout/Sidebar.tsx, TopBar.tsx, DashboardLayout.tsx, Header.tsx
  context/AuthContext.tsx
  data/mockMachines.ts
  lib/supabase.ts
  pages/Landing.tsx, Login.tsx, Dashboard.tsx, Machines.tsx, Employees.tsx, Reports.tsx
  types/machine.ts
  styles/

backend/
  migrations/         01 through 10, hand-run in the Supabase SQL Editor in order
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

All ten files are treated as applied history against the live database and are not rewritten in place; further schema changes should be added as new numbered files.

## 4. Role model

Two roles only: `employee`, `manager`. Enforced by a CHECK constraint on `profiles.role` and by RLS via `is_admin_or_manager()` (legacy name; the function itself now checks `role = 'manager'` exclusively).

## 5. Page-by-page status

| Route | Status |
|---|---|
| `/` | Landing page — public, static marketing content |
| `/login` | Email/password sign-in, public |
| `/dashboard` | **Live.** Summary overview: stat cards (Total, Clean, Needs Cleaning, Overdue, Team) computed from live Supabase data, plus a fault alert banner. No full machine table here — see `/machines`. |
| `/machines` | **Live.** Full machine table sourced from Supabase. Mark Cleaned and Mark as Working are both persisted. Report Issue is local-only (see §7). |
| `/employees` | **Live.** Employee list sourced from Supabase (`employees` joined with `profiles.role`). Managers can add new employees, which creates a real Supabase Auth account. |
| `/reports` | **Not implemented.** Honest empty-state page — no maintenance/cleaning-history data is queried or shown. |

All four internal routes are behind `ProtectedRoute` and require an authenticated session.

## 6. Mark Cleaned persistence

Implemented via the `mark_machine_cleaned` Postgres RPC (migration 10). A single atomic call updates `machines.last_cleaned_at` / `next_cleaning_due_at` / `cleaning_status` and inserts a `cleaning_logs` row. The RPC performs its own authorization check (manager, or an employee with an active assignment to that machine) rather than relying solely on table-level RLS, since the `machines` UPDATE policy is manager-only but employees should still be able to clean their own assigned machines.

## 7. Mark as Working

Implemented via `markMachineWorking()` in `src/lib/supabase.ts` — a direct `UPDATE` on `machines.fault_status`. Manager-only in the UI (`MachineTable.tsx` gates the button on `currentUserRole === 'manager'`) and enforced independently by the `machines: update elevated only` RLS policy.

## 8. Known incomplete features

- **Report Issue** — UI-only toggle in `MachineTable.tsx`, not persisted to `maintenance_reports`.
- **Machine assignments** — the `machine_assignments` table and its RLS policies exist, but nothing in the UI writes to it. The "Assigned Employee" column always shows `—`.
- **Reports page** — no real functionality yet; honest empty state only.
- **No automated tests.**

## 9. Error handling policy

Raw Supabase/Postgres error messages are never shown to users. Every data-access function in `src/lib/supabase.ts` returns a short, generic, user-safe message on failure; the underlying error is logged with `console.error` only when `import.meta.env.DEV` is true. Applied consistently across `Login.tsx`, `Employees.tsx` (via `createEmployee`), `Machines.tsx` (via `markMachineWorking`/`markMachineCleaned`), and `AuthContext.tsx`.

## 10. Deployment status

- **Primary target: Netlify**, under the project owner's own account. Build command `npm run build`, publish directory `dist`, SPA routing via `public/_redirects`.
- A generic `vercel.json` remains in the repo as an alternative path but is not the documented primary deployment.
- No production URL is live yet as of this writing.

## 11. Manual Supabase setup (for a fresh project)

1. Create a Supabase project.
2. Enable the `pg_cron` extension (Database → Extensions).
3. Run every file in `backend/migrations/` in order via the SQL Editor, 01 through 10 — editing the placeholder values in `06_admin_user.sql` and `08_fix_admin_login.sql` first if you need them.
4. Copy the Project URL and `anon public` key into `.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Never use the `service_role` key in this frontend.
5. Create your first user via signup or the Supabase Dashboard, then promote them to `manager`:
   ```sql
   update public.profiles set role = 'manager' where id = '<your-user-uuid>';
   ```
