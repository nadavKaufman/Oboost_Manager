# OBoost Manager

An internal operations portal for managing self-service machines across multiple locations — cleaning schedules, fault tracking, and staff records in one place.

## Business problem

OBoost operates self-service machines across several locations. Without a shared system, staff had no reliable way to know which machines were due for cleaning, which had open faults, or who was assigned where. OBoost Manager gives managers and employees a single source of truth for machine status and staff records, replacing ad-hoc tracking with a real-time, role-aware dashboard.

## Main features

- **Machine tracking** — every machine's cleaning status (Clean / Needs Cleaning / Overdue) and fault status (OK / Fault / Maintenance), computed from a fixed 21-day cleaning cycle.
- **Mark Cleaned** — persists a cleaning event to Supabase: updates the machine's status and cleaning dates and appends an audit-log row, in a single atomic database call.
- **Mark as Working** — managers can clear a machine's fault status once it's repaired.
- **Employee management** — managers can view all staff and add new employees, which creates a real Supabase Auth account, an employee record, and a role.
- **Role-aware navigation and access** — UI and database access both respect a two-role model (see below).

## Role model

The app uses exactly two roles:

- **employee** — default role for new sign-ups. Sees their own dashboard and machine data.
- **manager** — elevated role. Can see all machines and staff, add employees, and clear machine faults.

Authorization is enforced at the database level with Postgres Row Level Security (RLS), not just hidden in the UI.

## Technology stack

- [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) (build tool and dev server)
- Pure CSS — no UI component library
- [Supabase](https://supabase.com/) — hosted PostgreSQL, Auth, and RLS
- PostgreSQL (via Supabase)
- Supabase Auth (email/password)
- Row Level Security (RLS) for database-enforced authorization
- pg_cron — scheduled daily job to recompute machine cleaning status

## Application architecture

```
src/
  components/
    auth/            ProtectedRoute
    dashboard/        MachineTable, StatCard
    layout/           Sidebar, TopBar, DashboardLayout, Header
  context/            AuthContext (session, profile, loading, signOut)
  data/               mockMachines.ts (fallback data when Supabase is empty/unreachable)
  lib/                supabase.ts (typed client + all data-access functions)
  pages/              Landing, Login, Dashboard, Machines, Employees, Reports
  types/              Shared domain types (Machine, Employee, UserRole, ...)
  styles/             Plain CSS, one file per area

backend/
  migrations/         Ordered, hand-run SQL migrations (see below)
```

- **Routing**: React Router v7. `/`, `/login` are public; `/dashboard`, `/machines`, `/employees`, `/reports` are behind `ProtectedRoute`, which redirects unauthenticated users to `/login`.
- **State**: local React state (`useState`/`useEffect`) per page, no global store. Each protected page independently fetches what it needs from Supabase.
- **Data access**: all Supabase calls live in `src/lib/supabase.ts`. Pages never call the Supabase client directly.

## Database tables

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`. Stores `full_name` and `role` (`employee` \| `manager`). |
| `employees` | 1:1 with `profiles`. Staff details: name, email, phone, hire date, job title. |
| `machines` | Machine name, location, model, fault status, cleaning status, last/next cleaning dates. |
| `machine_assignments` | Many-to-many machine ↔ staff assignment history (not yet used by the UI). |
| `cleaning_logs` | Append-only audit log — one row per cleaning event. |
| `maintenance_reports` | Fault reports with severity and resolution tracking (not yet used by the UI). |
| `machine_status_history` | Append-only audit log of status transitions, populated by triggers. |

## Authentication and authorization

- **Authentication**: Supabase Auth, email/password. `AuthContext` wraps the app and exposes `session`, `profile`, `loading`, and `signOut`.
- **Route protection**: `ProtectedRoute` renders nothing while auth is loading and redirects to `/login` if there's no session.
- **Authorization**: enforced at the database layer via RLS policies on every table, using a `is_admin_or_manager()` SQL helper that — despite its legacy name — now checks for the `manager` role only. The frontend also hides manager-only UI (e.g. the Employees nav item, "Mark as Working"), but the database is the actual authority: RLS would reject the request even if the UI check were bypassed.
- **Elevated writes**: "Mark Cleaned" persists through a single `security definer` Postgres function (`mark_machine_cleaned`) that performs its own authorization check and atomically updates `machines` and inserts into `cleaning_logs`.

## Local setup

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in your own Supabase project's values:
   ```bash
   cp .env.example .env.local
   ```
3. In the Supabase SQL Editor, run every file in `backend/migrations/` **in numeric order** (`01_schema.sql` through `10_mark_machine_cleaned.sql`). Migrations `06_admin_user.sql` and `08_fix_admin_login.sql` are templates — edit the placeholder email/name at the top before running them, to promote your own first manager account.
4. Start the dev server:
   ```bash
   npm run dev
   ```

## Required environment variables

Set these in `.env.local` (never commit this file):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The Supabase `service_role` key must never be used in this frontend or placed in any `VITE_`-prefixed variable.

## Build and development commands

```bash
npm run dev       # start the Vite dev server
npm run build     # type-check (tsc -b) and produce a production build in dist/
npm run preview   # preview the production build locally
npm run lint       # run ESLint
```

## Currently implemented

- Email/password login, logout, and protected routing
- Live machine list from Supabase with mock-data fallback
- Mark Cleaned — persisted to Supabase (status, dates, and audit log updated atomically)
- Mark as Working — persisted, manager-only
- Employee list and employee creation — persisted to Supabase, manager-only
- Role-based UI gating backed by database-level RLS
- Overview dashboard with live stat cards

## Future improvements

Being transparent about what isn't finished yet:

- **Report Issue** is currently a local UI toggle only — it is not persisted to `maintenance_reports`.
- **Machine assignments** — the `machine_assignments` table exists and is covered by RLS, but no UI writes to it yet; the "Assigned Employee" column is not yet populated from real assignment data.
- **Reports page** is an honest empty state — no cleaning-history or maintenance-report views are implemented yet.
- No automated test suite yet.

## Deployment

Primary deployment target: **Netlify**.

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **SPA routing**: handled by `public/_redirects` (`/* /index.html 200`), so client-side routes resolve correctly on refresh/direct navigation.
- **Environment variables to add in Netlify**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Supabase Dashboard → Authentication → URL Configuration**: update the **Site URL** to your Netlify URL, and add it (plus any preview-deploy URLs you use) to **Redirect URLs**, so auth flows redirect back to the right place after login.

A generic `vercel.json` is also kept in the repo (build command, `dist` output, SPA rewrite) as an alternative deployment path, but Netlify is the documented and supported one.

## Screenshots

_Screenshots have not been captured yet — placeholder for future addition._
