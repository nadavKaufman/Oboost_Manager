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
- Role hierarchy: `employee < worker < admin < manager`
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
- Assigned worker column — shows `'—'` for all live machines (assignments not fetched yet)
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
| Assigned worker column (machine_assignments join) | Not started |
| "Mark as Cleaned" action (DB) | Not started |
| "File Maintenance Report" action (DB) | Not started |
| Machine assignment UI (admin/manager) | Not started |
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
2. Wire assigned worker column via `machine_assignments` join

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
