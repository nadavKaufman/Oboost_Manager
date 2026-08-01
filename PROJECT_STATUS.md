# OBoost Manager — Project Status

## 1. Already Done (before today)

- React 19 + TypeScript + Vite project scaffold
- React Router v7
- Pure CSS only (no UI libraries)
- Internal OBoost Operations Portal concept locked in
- Navbar, Sidebar, TopBar, Header, DashboardLayout components
- Dashboard page with StatCard, MachineTable, EmployeeTable
- MachineCard + MachineGrid components
- Landing page
- Mock machines data (`src/data/mockMachines.ts`)
- Mock users/employees data (`src/data/mockUsers.ts`)
- TypeScript types for machines, roles, status (`src/types/machine.ts`)
- `getMachineStatus()` utility function
- Build passes

---

## 2. Added Today

### Package installed
- `@supabase/supabase-js` ^2 — the only package added

### Files created
| File | Purpose |
|------|---------|
| `backend/migrations/01_schema.sql` | All database tables with columns, types, constraints |
| `backend/migrations/02_triggers.sql` | auto-create profile on signup, updated_at, status history logging, fault escalation |
| `backend/migrations/03_rls.sql` | Row Level Security policies for all 6 tables |
| `backend/migrations/04_cron.sql` | Daily pg_cron job to update cleaning_status |
| `.env.example` | Template for required environment variables |
| `src/lib/supabase.ts` | Typed Supabase client singleton + full Database type definition |
| `PROJECT_STATUS.md` | This file |

### Database tables designed
- `profiles` — extends auth.users (id, full_name, role, avatar_url)
- `machines` — name, location, model, fault_status, last_cleaned_at, next_cleaning_due_at, cleaning_status, is_active
- `machine_assignments` — many-to-many with history (is_active flag, unassigned_at)
- `cleaning_logs` — append-only log of every cleaning event
- `maintenance_reports` — fault reports with severity and resolution tracking
- `machine_status_history` — append-only audit log of all status changes

### Key decisions locked
- Cleaning interval: fixed at **21 days** for all machines (no per-machine config)
- `cleaning_status` stored in `machines` table: `clean` | `needs_cleaning` | `overdue`
- Cron transitions:
  - `clean → needs_cleaning` when `next_cleaning_due_at <= now()`
  - `needs_cleaning → overdue` when `next_cleaning_due_at <= now() - 7 days`
- Role hierarchy: `employee < manager` (simplified from four roles — see Phase 5)
- Authorization is database-based (RLS), not hardcoded in the frontend
- `service_role` key is never exposed in the frontend or any `VITE_` variable

---

## 3. Foundation Complete — Current State

### Live (Supabase-backed)
- Auth session and profile (name, role) — from `auth.users` + `profiles` table
- Dashboard welcome heading — shows authenticated user's `full_name`
- Dashboard machine table — fetches from `public.machines` on mount; fallback to `mockMachines` if empty or error

### Still Mock-Only
- `src/data/mockUsers.ts` — employee table still uses 4 hardcoded employees
- `EmployeeTable` in dashboard — not connected to DB
- `MachineCard` / `MachineGrid` components — not in the main dashboard flow
- Assigned employee column — shows `'—'` for all live machines (assignments not fetched yet)
- "Mark as Cleaned" button — updates local state only, no DB write
- "Report Issue" button — local toggle only, no DB write

---

## 4. Manual Supabase Setup — Completed

| Item | Status |
|------|--------|
| Supabase project created (`oboost-manager`, eu-central-1) | Done |
| Migration `01_schema.sql` | Ran successfully |
| Migration `02_triggers.sql` | Ran successfully |
| Migration `03_rls.sql` | Ran successfully |
| Migration `04_cron.sql` | Ran successfully |
| Real Supabase login | Working |
| Profile: `Nadav Kaufman`, role = `manager` | Set |
| Seed machines inserted into `public.machines` | Done |
| Dashboard welcome heading uses auth profile name | Done (falls back to mock if profile not loaded) |

Dashboard machine table now fetches from `public.machines` (live). Employee table still uses mock data.

---

## 5. Added in Phase 2 — Auth MVP

### Files created
| File | Purpose |
|------|---------|
| `src/context/AuthContext.tsx` | Supabase session + profile (full_name, role) in React context; exposes `session`, `profile`, `loading`, `signOut` |
| `src/pages/Login.tsx` | Email + password sign-in form; redirects to `/dashboard` on success |
| `src/components/auth/ProtectedRoute.tsx` | Redirects to `/login` if no active session; renders nothing while auth is loading |

### Files modified
| File | Change |
|------|--------|
| `src/App.tsx` | Wrapped routes in `AuthProvider`; added `/login` route; protected `/dashboard` with `ProtectedRoute` |
| `src/components/layout/DashboardLayout.tsx` | Reads `AuthContext` for real name/role/signOut; falls back to `currentUser` prop if profile not loaded |
| `src/components/layout/TopBar.tsx` | Added optional `onLogout` prop; renders "Sign out" button when provided |
| `src/styles/landing.css` | Added login page CSS (`.login-page`, `.login-card`, `.login-form`, etc.) |
| `src/styles/layout.css` | Added `.topbar__logout` button styles |

### Auth behaviour
- `/` — landing page, always public
- `/login` — login form, always public
- `/dashboard` — requires active Supabase session; redirects to `/login` if not authenticated
- On sign-in: session stored by Supabase SDK → `AuthContext` picks it up → profile fetched from `profiles` table → TopBar shows real name + role
- On sign-out: session cleared → `ProtectedRoute` redirects to `/login`

---

## 6. Phase 3 — Live Machine Data (Completed)

### Files modified
| File | Change |
|------|--------|
| `src/lib/supabase.ts` | Added `getMachines()` — queries `public.machines` (active only), maps DB columns to frontend `Machine` type |
| `src/pages/Dashboard.tsx` | `useEffect` on mount calls `getMachines()`; replaces `mockMachines` with live rows if any returned; fallback stays on error or empty result |

### Mapping decisions
- `last_cleaned_at` (timestamptz) → `lastCleaned` (date string, `split('T')[0]`); null → `'2000-01-01'` (renders as overdue)
- `cleaningIntervalDays` → hardcoded `21` (project-wide constant, not stored in DB)
- `assignedEmployeeId` → `''` (machine_assignments join not wired yet; shows `'—'` in table)
- `fault_status` / `maintenance_notes` → renamed to camelCase

---

## 7. Not Implemented Yet

| Feature | Status |
|---------|--------|
| Employee table from Supabase (`profiles`) | Not started |
| Assigned employee column (machine_assignments join) | Not started |
| "Mark as Cleaned" action (DB) | Not started |
| "File Maintenance Report" action (DB) | Not started |
| Machine assignment UI (manager) | Not started |
| Users management page | Not started |
| Machine detail page | Not started |
| Live cleaning_logs display | Not started |
| Live maintenance_reports display | Not started |

---

## 8. Next Recommended Step

**Phase 4 — Wire mutations and replace employee mock data**

Option A (mutations first):
1. Wire "Mark as Cleaned" → insert into `cleaning_logs`, update `machines.last_cleaned_at`
2. Wire "Report Issue" → insert into `maintenance_reports`

Option B (employee data first):
1. Replace `MOCK_EMPLOYEES` with a `getEmployees()` query from `profiles`
2. Wire assigned employee column via `machine_assignments` join

---

## 9. Commands to Run Locally

```bash
# Development server (requires .env.local with Supabase credentials)
npm run dev

# Type check + production build
npm run build

# Preview production build
npm run preview
```

To connect Supabase:
```bash
# Copy the template
cp .env.example .env.local
# Then edit .env.local and fill in your real values
```

---

## 10. Manual Supabase Steps (All Complete)

Do these in the Supabase Dashboard before running any migrations:

1. **Create Supabase project**
   - Name: `oboost-manager`
   - Region: `eu-central-1` (Frankfurt) — closest to Israel

2. **Enable extensions**
   - Dashboard → Database → Extensions
   - Enable: `pg_cron`
   - (`uuid-ossp` is NOT required — the schema uses `gen_random_uuid()` which is built-in)

3. **Run migrations in order**
   - Dashboard → SQL Editor → New query
   - Run `01_schema.sql` → verify tables appear
   - Run `02_triggers.sql` → verify triggers created
   - Run `03_rls.sql` → verify RLS enabled on all tables
   - Run `04_cron.sql` → verify with `select * from cron.job;`

4. **Copy API credentials**
   - Dashboard → Settings → API
   - Copy Project URL → `VITE_SUPABASE_URL` in `.env.local`
   - Copy `anon public` key → `VITE_SUPABASE_ANON_KEY` in `.env.local`
   - Keep `service_role` key safe and private — never use it in frontend code

5. **Test auth**
   - Dashboard → Authentication → Users
   - Create a test user manually to verify the `handle_new_user` trigger creates a `profiles` row

6. **Set first manager**
   - After creating your first user, run in SQL Editor:
     ```sql
     update public.profiles set role = 'manager' where id = '<your-user-uuid>';
     ```
   - All new signups default to `employee` role

---

## 11. Phase 4 — Sidebar Routing (Completed)

Sidebar links now navigate to real, protected pages instead of all pointing at `/dashboard`. Pages are structural placeholders only — no data fetching or Supabase logic yet.

### Files created
| File | Purpose |
|------|---------|
| `src/pages/Machines.tsx` | Placeholder page at `/machines`, wrapped in `DashboardLayout` |
| `src/pages/Employees.tsx` | Placeholder page at `/employees`, wrapped in `DashboardLayout` |
| `src/pages/Reports.tsx` | Placeholder page at `/reports`, wrapped in `DashboardLayout` |

### Files modified
| File | Change |
|------|--------|
| `src/App.tsx` | Added protected `/machines`, `/employees`, `/reports` routes (same `ProtectedRoute` pattern as `/dashboard`) |
| `src/components/layout/Sidebar.tsx` | Fixed `NAV_ITEMS` paths (Machines/Employees/Reports no longer all point to `/dashboard`); generalized active-link check to `location.pathname === item.path` for all items, not just Overview |
| `src/styles/dashboard.css` | Added `.placeholder-panel` style reused by all three new pages |

### Still not implemented
- Real content for Machines/Employees/Reports pages (data fetching, tables, forms)

---

## 12. Phase 5 — Role Simplification (Completed)

Reduced the role system from four roles (`employee`, `worker`, `admin`, `manager`) to two (`employee`, `manager`). Existing `admin` profiles are migrated to `manager` (no functionality lost); existing `worker` profiles are migrated to `employee`.

### Files created
| File | Purpose |
|------|---------|
| `supabase/migrations/05_role_simplification.sql` | Live-DB migration: converts existing `admin`→`manager` and `worker`→`employee` rows, tightens the `profiles.role` CHECK constraint to `('employee', 'manager')`, redefines `is_admin_or_manager()` to check `role = 'manager'` only |

`01_schema.sql` through `04_cron.sql` are treated as immutable, already-applied migration history and were **not** edited — `05_role_simplification.sql` is the only file altering the live database, and must be run manually in the Supabase SQL Editor (see section 10 workflow) after `04_cron.sql`.

### Files modified
| File | Change |
|------|--------|
| `src/types/machine.ts` | `UserRole` narrowed to `'manager' \| 'employee'` |
| `src/lib/supabase.ts` | `UserRole` narrowed to `'employee' \| 'manager'` (mirrors new DB constraint) |
| `src/components/layout/Sidebar.tsx` | `ROLE_RANK` reduced to `{ employee: 0, manager: 1 }`; Employees nav item now requires `minRole: 'manager'` (was `'admin'`) |
| `src/components/layout/TopBar.tsx` | `ROLE_LABEL` reduced to Manager/Employee only |
| `src/components/dashboard/EmployeeTable.tsx` | `ROLE_LABEL` reduced to Manager/Employee only |
| `src/components/dashboard/MachineTable.tsx` | "Mark as Working" visibility now checks `currentUserRole === 'manager'` only (was admin-or-manager); "Assigned Worker" column renamed to "Assigned Employee" |
| `src/data/mockUsers.ts` | Sara Cohen `admin`→`manager`; Yossi Ben-David and Dan Mizrahi `worker`→`employee` |
| `src/pages/Landing.tsx` | Marketing copy updated to describe two roles instead of four |
| `PROJECT_STATUS.md` | This section, plus role-hierarchy and "assigned worker" references updated |

### Security note
RLS elevated access (`is_admin_or_manager()`) now means **manager only** — a narrowing, not a weakening, of access. The function name is kept unchanged deliberately so no RLS policy needed to be dropped or recreated; only its body was redefined via `CREATE OR REPLACE FUNCTION`.

### Deployment ordering
Run `05_role_simplification.sql` before or together with deploying this frontend change. If old `worker`/`admin` values remain in the live DB while the frontend only recognizes `employee`/`manager`, role-based UI (nav filtering, role labels) would break for those accounts until the migration runs.
