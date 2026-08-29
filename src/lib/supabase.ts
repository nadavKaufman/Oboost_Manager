import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Domain types — mirror the database check constraints exactly
// ---------------------------------------------------------------------------
export type UserRole       = 'employee' | 'manager' | 'preview';
export type FaultStatus    = 'ok' | 'fault' | 'maintenance';
export type CleaningStatus = 'clean' | 'needs_cleaning' | 'overdue';
export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus   = 'open' | 'in_progress' | 'resolved' | 'closed';

// Shared display label for ReportStatus — keeps "in_progress" etc. from ever
// leaking onto screen as a raw enum value, wherever malfunction status is shown.
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'פתוח',
  in_progress: 'בטיפול',
  resolved: 'נפתר',
  closed: 'סגור',
};

// Shown for every mutation blocked for the read-only 'preview' role,
// both when the frontend intercepts a click before sending anything,
// and when a request still reaches the server and the RPC guard fires.
export const PREVIEW_BLOCKED_MESSAGE = 'מצב צפייה בלבד — לא ניתן לבצע שינויים.';

// The backend (RPC guards / RLS / triggers) still raises its error text in
// English — that surface isn't touched here. This maps the known raw
// messages it can return to their Hebrew equivalent before they reach the
// UI, so no English ever leaks through even when a request reaches the server.
function translateBackendError(message: string): string {
  if (message.includes('Insufficient stock')) return 'אין מספיק מלאי.';
  if (message.includes('Read-only preview')) return PREVIEW_BLOCKED_MESSAGE;
  if (message.includes('Not authenticated')) return 'לא מחוברים למערכת.';
  if (message.includes('Not authorized')) return 'אין לכם הרשאה לבצע פעולה זו.';
  if (message.includes('Machine does not exist')) return 'המכונה אינה קיימת.';
  if (message.includes('Task title is required')) return 'יש למלא כותרת למשימה.';
  if (message.includes('Assigned employee not found')) return 'העובד שהוקצה לא נמצא.';
  if (message.includes('cleaning task must be linked')) return 'משימת ניקיון חייבת להיות מקושרת למכונה.';
  return message;
}

// ---------------------------------------------------------------------------
// Database shape — used by createClient<Database> for end-to-end type safety
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id:         string;
          full_name:  string;
          role:       UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id:          string;
          full_name?:  string;
          role?:       UserRole;
          avatar_url?: string | null;
        };
        Update: {
          full_name?:  string;
          role?:       UserRole;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      employees: {
        Row: {
          employee_id:  string;
          first_name:   string;
          last_name:    string;
          email:        string;
          phone_number: string;
          hire_date:    string | null;
          job_title:    string;
          show_in_directory: boolean;
          created_at:   string;
          updated_at:   string;
        };
        Insert: {
          employee_id:  string;
          first_name?:  string;
          last_name?:   string;
          email:        string;
          phone_number?: string;
          hire_date?:   string | null;
          job_title?:   string;
          show_in_directory?: boolean;
        };
        Update: {
          first_name?:  string;
          last_name?:   string;
          email?:       string;
          phone_number?: string;
          hire_date?:   string | null;
          job_title?:   string;
        };
        Relationships: [];
      };
      machines: {
        Row: {
          id:                   string;
          name:                 string;
          location:             string;
          image_url:            string | null;
          fault_status:         FaultStatus;
          maintenance_notes:    string;
          last_cleaned_at:      string | null;
          next_cleaning_due_at: string | null;
          cleaning_status:      CleaningStatus;
          is_active:            boolean;
          created_at:           string;
          updated_at:           string;
        };
        Insert: {
          id?:                   string;
          name:                  string;
          location?:             string;
          image_url?:            string | null;
          fault_status?:         FaultStatus;
          maintenance_notes?:    string;
          last_cleaned_at?:      string | null;
          next_cleaning_due_at?: string | null;
          cleaning_status?:      CleaningStatus;
          is_active?:            boolean;
        };
        Update: {
          name?:                 string;
          location?:             string;
          image_url?:            string | null;
          fault_status?:         FaultStatus;
          maintenance_notes?:    string;
          last_cleaned_at?:      string | null;
          next_cleaning_due_at?: string | null;
          cleaning_status?:      CleaningStatus;
          is_active?:            boolean;
        };
        Relationships: [];
      };
      machine_assignments: {
        Row: {
          id:            string;
          machine_id:    string;
          user_id:       string;
          assigned_by:   string;
          assigned_at:   string;
          unassigned_at: string | null;
          is_active:     boolean;
        };
        Insert: {
          id?:            string;
          machine_id:     string;
          user_id:        string;
          assigned_by:    string;
          assigned_at?:   string;
          unassigned_at?: string | null;
          is_active?:     boolean;
        };
        Update: {
          unassigned_at?: string | null;
          is_active?:     boolean;
        };
        Relationships: [];
      };
      cleaning_logs: {
        Row: {
          id:                  string;
          machine_id:          string;
          cleaned_by:          string;
          cleaned_at:          string;
          notes:               string;
          previous_cleaned_at: string | null;
        };
        Insert: {
          id?:                  string;
          machine_id:           string;
          cleaned_by:           string;
          cleaned_at?:          string;
          notes?:               string;
          previous_cleaned_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      maintenance_reports: {
        Row: {
          id:               string;
          machine_id:       string;
          reported_by:      string;
          reported_at:      string;
          fault_type:       string;
          description:      string;
          severity:         ReportSeverity;
          status:           ReportStatus;
          photo_url:        string | null;
          resolved_by:      string | null;
          resolved_at:      string | null;
          resolution_notes: string | null;
        };
        Insert: {
          id?:          string;
          machine_id:   string;
          reported_by:  string;
          reported_at?: string;
          fault_type?:  string;
          description?: string;
          severity?:    ReportSeverity;
          status?:      ReportStatus;
          photo_url?:   string | null;
        };
        Update: {
          fault_type?:       string;
          description?:      string;
          severity?:         ReportSeverity;
          status?:           ReportStatus;
          photo_url?:        string | null;
          resolved_by?:      string | null;
          resolved_at?:      string | null;
          resolution_notes?: string | null;
        };
        Relationships: [];
      };
      machine_status_history: {
        Row: {
          id:         string;
          machine_id: string;
          changed_by: string | null;
          old_status: string;
          new_status: string;
          changed_at: string;
          reason:     string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id:          string;
          item_type:   'orange_carton' | 'spare_part';
          name:        string;
          description: string;
          unit:        string;
          is_active:   boolean;
          image_url:   string | null;
          created_at:  string;
          updated_at:  string;
        };
        Insert: {
          item_type:    'spare_part';
          name:         string;
          description?: string;
          unit?:        string;
          is_active?:   boolean;
          image_url?:   string | null;
        };
        Update: {
          name?:        string;
          description?: string;
          unit?:        string;
          is_active?:   boolean;
          image_url?:   string | null;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          id:               string;
          item_id:          string;
          transaction_type: InventoryTransactionType;
          quantity:         number;
          recorded_by:      string;
          notes:            string;
          created_at:       string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id:               string;
          title:            string;
          description:      string;
          assigned_to:      string;
          assigned_by:      string;
          machine_id:       string | null;
          due_date:         string | null;
          status:           TaskStatus;
          completion_notes: string | null;
          created_at:       string;
          completed_at:     string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Client singleton
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
// service_role key must never appear here or in any VITE_ variable.
// ---------------------------------------------------------------------------
const supabaseUrl     = import.meta.env['VITE_SUPABASE_URL']     as string | undefined;
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[oboost] Missing Supabase env vars.\n' +
    'Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
import { getMachineStatus, type Machine } from '../types/machine';

export interface EmployeeRecord {
  employee_id:  string;
  first_name:   string;
  last_name:    string;
  email:        string;
  phone_number: string;
  hire_date:    string | null;
  job_title:    string;
  role:         UserRole;
  created_at:   string;
  photoUrl:     string | null;
}

export interface GetEmployeesResult {
  employees: EmployeeRecord[];
  error: string | null;
}

export interface GetEmployeesOptions {
  // When true, restricts results to employees.show_in_directory = true —
  // used by the Employees directory page. Other callers (task-assignment
  // pickers, dashboard counts) omit this and see every employee, since a
  // hidden-from-directory account still behaves like a normal employee
  // everywhere else.
  directoryOnly?: boolean;
}

export async function getEmployees(options: GetEmployeesOptions = {}): Promise<GetEmployeesResult> {
  // Preview never reads the employees table directly (its RLS policy
  // doesn't grant that), so its data comes exclusively from a
  // SECURITY DEFINER function that never selects email/phone_number —
  // masked server-side, not filtered after the fact. Real managers and
  // employees are completely unaffected and fall through to the
  // existing direct query below, unchanged.
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (uid) {
    const { data: roleRow } = await supabase.from('profiles').select('role').eq('id', uid).single();
    if ((roleRow as { role: UserRole } | null)?.role === 'preview') {
      const result = await supabase.rpc('get_preview_employee_directory', {
        p_directory_only: options.directoryOnly === true,
      } as never);

      type PreviewRow = {
        employee_id: string;
        first_name:  string;
        last_name:   string;
        job_title:   string;
        hire_date:   string | null;
        created_at:  string;
        role:        UserRole;
        avatar_url:  string | null;
      };
      const rows = (result.data as PreviewRow[] | null) ?? [];

      if (result.error) {
        if (import.meta.env.DEV) console.error('[oboost] get_preview_employee_directory error:', result.error.message);
        return { employees: [], error: 'לא ניתן היה לטעון את העובדים. אנא נסו שוב.' };
      }

      return {
        employees: rows.map(row => ({
          employee_id:  row.employee_id,
          first_name:   row.first_name,
          last_name:    row.last_name,
          email:        '',
          phone_number: '',
          hire_date:    row.hire_date,
          job_title:    row.job_title,
          created_at:   row.created_at,
          photoUrl:     row.avatar_url,
          role:         row.role,
        })),
        error: null,
      };
    }
  }

  const base = supabase
    .from('employees')
    .select('employee_id, first_name, last_name, email, phone_number, hire_date, job_title, created_at, profiles (role, avatar_url)');

  const result = await (
    options.directoryOnly
      ? base.eq('show_in_directory', true).order('first_name')
      : base.order('first_name')
  );

  type EmpRow = {
    employee_id:  string;
    first_name:   string;
    last_name:    string;
    email:        string;
    phone_number: string;
    hire_date:    string | null;
    job_title:    string;
    created_at:   string;
    profiles:     { role: UserRole; avatar_url: string | null } | null;
  };
  const data = result.data as EmpRow[] | null;

  if (result.error) {
    if (import.meta.env.DEV) console.error('[oboost] Supabase employees error:', result.error.message);
    return { employees: [], error: withDevDetail('לא ניתן היה לטעון את העובדים. אנא נסו שוב.', result.error.message) };
  }
  if (!data || data.length === 0) {
    return { employees: [], error: null };
  }

  return {
    employees: data.map(row => ({
      employee_id:  row.employee_id,
      first_name:   row.first_name,
      last_name:    row.last_name,
      email:        row.email,
      phone_number: row.phone_number,
      hire_date:    row.hire_date,
      job_title:    row.job_title,
      created_at:   row.created_at,
      photoUrl:     row.profiles?.avatar_url ?? null,
      role:         row.profiles?.role ?? 'employee',
    })),
    error: null,
  };
}

export interface CreateEmployeeInput {
  firstName:   string;
  lastName:    string;
  email:       string;
  phoneNumber: string;
  hireDate:    string | null;
  jobTitle:    string;
  password:    string;
}

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<{ employeeId: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: `${input.firstName} ${input.lastName}`.trim() },
    },
  });

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] createEmployee signUp error:', error.message);
    return { employeeId: null, error: 'לא ניתן היה ליצור את חשבון העובד. אנא בדקו את הפרטים ונסו שוב.' };
  }
  if (!data.user) return { employeeId: null, error: 'לא ניתן היה ליצור את חשבון העובד. אנא נסו שוב.' };

  const { error: empError } = await supabase.from('employees').insert({
    employee_id:  data.user.id,
    first_name:   input.firstName,
    last_name:    input.lastName,
    email:        input.email,
    phone_number: input.phoneNumber,
    hire_date:    input.hireDate,
    job_title:    input.jobTitle,
  });
  if (empError) {
    if (import.meta.env.DEV) console.error('[oboost] createEmployee insert error:', empError.message);
    return { employeeId: null, error: 'החשבון נוצר, אך שמירת פרטי העובד נכשלה. אנא נסו שוב.' };
  }

  // No role assignment here: handle_new_user already creates the profile
  // with the default 'employee' role, and Add Employee must never be able
  // to create a manager.
  return { employeeId: data.user.id, error: null };
}

export interface UpdateEmployeeFields {
  firstName?:  string;
  lastName?:   string;
  phoneNumber?: string;
  jobTitle?:   string;
  hireDate?:   string | null;
}

// Editable fields only — email is deliberately excluded: it's tied to the
// auth user's login identity (auth.users.email), and changing it here
// would desync employees.email from the real sign-in address without
// actually updating it, since that requires a separate supabase.auth
// email-change flow this app doesn't implement.
export async function updateEmployee(
  employeeId: string,
  fields: UpdateEmployeeFields
): Promise<{ error: string | null }> {
  const payload: Database['public']['Tables']['employees']['Update'] = {};
  if (fields.firstName !== undefined) payload.first_name = fields.firstName;
  if (fields.lastName !== undefined) payload.last_name = fields.lastName;
  if (fields.phoneNumber !== undefined) payload.phone_number = fields.phoneNumber;
  if (fields.jobTitle !== undefined) payload.job_title = fields.jobTitle;
  if (fields.hireDate !== undefined) payload.hire_date = fields.hireDate;

  const { error } = await (supabase.from('employees') as any).update(payload).eq('employee_id', employeeId);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] updateEmployee error:', error.message);
    return { error: 'לא ניתן היה לעדכן את פרטי העובד. אנא נסו שוב.' };
  }
  return { error: null };
}

export interface GetMachinesResult {
  machines: Machine[];
  error: string | null;
}

export async function getMachines(): Promise<GetMachinesResult> {
  // No client-side is_active filter: RLS is the single source of truth
  // here — managers see every machine (active and inactive), employees
  // see only active ones, both from this same unfiltered query.
  const result = await supabase
    .from('machines')
    .select('*')
    .order('name');

  // Cast needed: custom Database type omits auxiliary Supabase fields
  // (Views, Enums, Functions) so generic inference collapses to never.
  type MachineRow = Database['public']['Tables']['machines']['Row'];
  const data = result.data as MachineRow[] | null;

  if (result.error) {
    if (import.meta.env.DEV) console.error('[oboost] Supabase machines error:', result.error.message);
    return { machines: [], error: 'לא ניתן היה לטעון את המכונות. אנא נסו שוב.' };
  }
  if (!data || data.length === 0) {
    return { machines: [], error: null };
  }

  const machineIds = data.map(row => row.id);
  const assignResult = await supabase
    .from('machine_assignments')
    .select('machine_id, user_id')
    .in('machine_id', machineIds)
    .eq('is_active', true);

  type AssignmentRow = { machine_id: string; user_id: string };
  const assignedByMachine = new Map<string, string[]>();
  ((assignResult.data as AssignmentRow[] | null) ?? []).forEach(row => {
    const list = assignedByMachine.get(row.machine_id) ?? [];
    list.push(row.user_id);
    assignedByMachine.set(row.machine_id, list);
  });

  const machines: Machine[] = data.map(row => ({
    id: row.id,
    name: row.name,
    location: row.location,
    imageUrl: row.image_url,
    isActive: row.is_active,
    lastCleaned: row.last_cleaned_at ? row.last_cleaned_at.split('T')[0] : null,
    cleaningIntervalDays: 21,
    nextCleaningDueAt: row.next_cleaning_due_at ?? '2000-01-01',
    assignedEmployeeIds: assignedByMachine.get(row.id) ?? [],
    faultStatus: row.fault_status,
    maintenanceNotes: row.maintenance_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  // Cleaning-priority order everywhere this list is shown: overdue first,
  // then due-soon, then clean. Stable sort keeps the existing name order
  // (set by the query above) within each group.
  const CLEANING_PRIORITY: Record<string, number> = { overdue: 0, due_soon: 1, clean: 2 };
  machines.sort((a, b) => CLEANING_PRIORITY[getMachineStatus(a).status] - CLEANING_PRIORITY[getMachineStatus(b).status]);

  return { machines, error: null };
}

export async function markMachineWorking(machineId: string): Promise<{ error: string | null }> {
  // Cast needed: same generic collapse-to-never issue as getMachines() above,
  // affecting the update() argument type too.
  const { error } = await (supabase.from('machines') as any)
    .update({ fault_status: 'ok' })
    .eq('id', machineId);

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] markMachineWorking error:', error.message);
    return { error: 'לא ניתן היה לעדכן את המכונה. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function markMachineCleaned(machineId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mark_machine_cleaned', { p_machine_id: machineId } as never);

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[oboost] markMachineCleaned error:', error.message);
    }
    if (error.message.includes('Read-only preview')) return { error: translateBackendError(error.message) };
    return { error: 'לא ניתן היה לסמן את המכונה כנוקתה. אנא נסו שוב.' };
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Machine details, assignments, editing (Phase B)
// ---------------------------------------------------------------------------

export interface MaintenanceReportRecord {
  id: string;
  reportedByName: string;
  reportedAt: string;
  description: string;
  faultType: string;
  severity: ReportSeverity;
  status: ReportStatus;
  photoUrl: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

export interface MachineDetails {
  machine: Machine;
  cleaningHistory: { id: string; cleanedAt: string; cleanedByName: string }[];
  malfunctionHistory: MaintenanceReportRecord[];
}

export async function getMachineDetails(
  machineId: string
): Promise<{ details: MachineDetails | null; error: string | null }> {
  const [machineRes, assignRes, cleaningRes, reportsRes] = await Promise.all([
    supabase.from('machines').select('*').eq('id', machineId).single(),
    supabase.from('machine_assignments').select('user_id').eq('machine_id', machineId).eq('is_active', true),
    supabase.from('cleaning_logs').select('id, cleaned_by, cleaned_at').eq('machine_id', machineId).order('cleaned_at', { ascending: false }),
    supabase.from('maintenance_reports').select('*').eq('machine_id', machineId).order('reported_at', { ascending: false }),
  ]);

  if (machineRes.error || !machineRes.data) {
    if (import.meta.env.DEV && machineRes.error) console.error('[oboost] getMachineDetails error:', machineRes.error.message);
    return { details: null, error: 'המכונה לא נמצאה, או שאין לכם גישה אליה.' };
  }

  type MachineRow = Database['public']['Tables']['machines']['Row'];
  const machineRow = machineRes.data as MachineRow;

  type AssignRow = { user_id: string };
  const assignRows = (assignRes.data as AssignRow[] | null) ?? [];

  type CleaningRow = { id: string; cleaned_by: string; cleaned_at: string };
  const cleaningRows = (cleaningRes.data as CleaningRow[] | null) ?? [];

  type ReportRow = Database['public']['Tables']['maintenance_reports']['Row'];
  const reportRows = (reportsRes.data as ReportRow[] | null) ?? [];

  const userIds = new Set<string>();
  cleaningRows.forEach(r => userIds.add(r.cleaned_by));
  reportRows.forEach(r => {
    userIds.add(r.reported_by);
    if (r.resolved_by) userIds.add(r.resolved_by);
  });

  let nameById = new Map<string, string>();
  if (userIds.size > 0) {
    const profilesRes = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(userIds));
    type ProfileRow = { id: string; full_name: string };
    nameById = new Map(
      ((profilesRes.data as ProfileRow[] | null) ?? []).map(p => [p.id, p.full_name || '—'])
    );
  }
  const nameFor = (id: string | null) => (id ? nameById.get(id) ?? '—' : '—');

  const machine: Machine = {
    id: machineRow.id,
    name: machineRow.name,
    location: machineRow.location,
    imageUrl: machineRow.image_url,
    isActive: machineRow.is_active,
    lastCleaned: machineRow.last_cleaned_at ? machineRow.last_cleaned_at.split('T')[0] : null,
    cleaningIntervalDays: 21,
    nextCleaningDueAt: machineRow.next_cleaning_due_at ?? '2000-01-01',
    assignedEmployeeIds: assignRows.map(r => r.user_id),
    faultStatus: machineRow.fault_status,
    maintenanceNotes: machineRow.maintenance_notes,
    createdAt: machineRow.created_at,
    updatedAt: machineRow.updated_at,
  };

  return {
    details: {
      machine,
      cleaningHistory: cleaningRows.map(r => ({
        id: r.id,
        cleanedAt: r.cleaned_at,
        cleanedByName: nameFor(r.cleaned_by),
      })),
      malfunctionHistory: reportRows.map(r => ({
        id: r.id,
        reportedByName: nameFor(r.reported_by),
        reportedAt: r.reported_at,
        description: r.description,
        faultType: r.fault_type,
        severity: r.severity,
        status: r.status,
        photoUrl: r.photo_url,
        resolvedByName: r.resolved_by ? nameFor(r.resolved_by) : null,
        resolvedAt: r.resolved_at,
        resolutionNotes: r.resolution_notes,
      })),
    },
    error: null,
  };
}

export interface UpdateMachineFields {
  name?: string;
  location?: string;
  maintenanceNotes?: string;
  isActive?: boolean;
}

export async function updateMachine(
  machineId: string,
  fields: UpdateMachineFields
): Promise<{ error: string | null }> {
  const payload: Database['public']['Tables']['machines']['Update'] = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.location !== undefined) payload.location = fields.location;
  if (fields.maintenanceNotes !== undefined) payload.maintenance_notes = fields.maintenanceNotes;
  if (fields.isActive !== undefined) payload.is_active = fields.isActive;

  const { error } = await (supabase.from('machines') as any).update(payload).eq('id', machineId);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] updateMachine error:', error.message);
    return { error: 'לא ניתן היה לעדכן את המכונה. אנא נסו שוב.' };
  }
  return { error: null };
}

export interface CreateMachineInput {
  name: string;
  location: string;
  maintenanceNotes: string;
  isActive: boolean;
}

export async function createMachine(input: CreateMachineInput): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('machines')
    .insert({
      name: input.name,
      location: input.location,
      maintenance_notes: input.maintenanceNotes,
      is_active: input.isActive,
    })
    .select('id')
    .single();

  if (error || !data) {
    if (import.meta.env.DEV && error) {
      // TEMPORARY diagnostic logging — remove once the root cause of the
      // createMachine() failure is confirmed and fixed.
      console.error('[oboost] createMachine error (full):', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    const devDetail = error
      ? `message="${error.message}" details="${error.details}" hint="${error.hint}" code="${error.code}"`
      : 'insert succeeded but no row was returned';
    return { id: null, error: withDevDetail('לא ניתן היה ליצור את המכונה. אנא נסו שוב.', devDetail) };
  }
  return { id: (data as { id: string }).id, error: null };
}

export async function assignEmployeeToMachine(machineId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('assign_employee_to_machine', {
    p_machine_id: machineId,
    p_user_id: userId,
  } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] assignEmployeeToMachine error:', error.message);
    return { error: 'לא ניתן היה לשייך את העובד. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function unassignEmployeeFromMachine(machineId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('unassign_employee_from_machine', {
    p_machine_id: machineId,
    p_user_id: userId,
  } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] unassignEmployeeFromMachine error:', error.message);
    return { error: 'לא ניתן היה לבטל את שיוך העובד. אנא נסו שוב.' };
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Image uploads — Supabase Storage, one shared bucket (Phase B / D)
// ---------------------------------------------------------------------------

const MEDIA_BUCKET = 'oboost-media';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'יש לבחור תמונה מסוג JPEG, PNG, WEBP או GIF.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be smaller than 5MB.';
  }
  return null;
}

function safeFileName(file: File): string {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}

// In DEV, surface the real Supabase error inline so a failure (missing
// bucket, missing Storage policy, missing table grant, etc.) is visible
// without opening devtools. PROD always keeps the generic message.
function withDevDetail(userMessage: string, detail: string): string {
  return import.meta.env.DEV ? `${userMessage} (dev: ${detail})` : userMessage;
}

export async function uploadMachineImage(
  machineId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  const path = `machines/${machineId}/${safeFileName(file)}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) {
    if (import.meta.env.DEV) console.error('[oboost] uploadMachineImage error:', uploadError.message);
    return { url: null, error: withDevDetail('לא ניתן היה להעלות את התמונה. אנא נסו שוב.', uploadError.message) };
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { error: imageSaveError } = await (supabase.from('machines') as any)
    .update({ image_url: data.publicUrl })
    .eq('id', machineId);

  if (imageSaveError) {
    if (import.meta.env.DEV) console.error('[oboost] uploadMachineImage save error:', imageSaveError.message);
    return {
      url: null,
      error: withDevDetail('התמונה הועלתה, אך שמירתה במכונה נכשלה. אנא נסו שוב.', imageSaveError.message),
    };
  }

  return { url: data.publicUrl, error: null };
}

export async function uploadEmployeePhoto(
  employeeId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  const path = `employees/${employeeId}/${safeFileName(file)}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) {
    if (import.meta.env.DEV) console.error('[oboost] uploadEmployeePhoto error:', uploadError.message);
    return { url: null, error: withDevDetail('לא ניתן היה להעלות את התמונה. אנא נסו שוב.', uploadError.message) };
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { error: saveError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', employeeId);

  if (saveError) {
    if (import.meta.env.DEV) console.error('[oboost] uploadEmployeePhoto save error:', saveError.message);
    return {
      url: null,
      error: withDevDetail('התמונה הועלתה, אך שמירתה בפרטי העובד נכשלה. אנא נסו שוב.', saveError.message),
    };
  }

  return { url: data.publicUrl, error: null };
}

export async function uploadMalfunctionPhoto(file: File): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { url: null, error: 'לא מחוברים למערכת.' };

  const path = `malfunctions/${uid}/${safeFileName(file)}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) {
    if (import.meta.env.DEV) console.error('[oboost] uploadMalfunctionPhoto error:', uploadError.message);
    return { url: null, error: withDevDetail('לא ניתן היה להעלות את התמונה. אנא נסו שוב.', uploadError.message) };
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ---------------------------------------------------------------------------
// Malfunction reporting + resolution (Phase D)
// ---------------------------------------------------------------------------

export interface ReportMalfunctionInput {
  machineId: string;
  description: string;
  faultType: string;
  severity: ReportSeverity;
  photoUrl: string | null;
}

export async function reportMachineMalfunction(input: ReportMalfunctionInput): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('report_machine_malfunction', {
    p_machine_id: input.machineId,
    p_description: input.description,
    p_fault_type: input.faultType,
    p_severity: input.severity,
    p_photo_url: input.photoUrl,
  } as never);

  if (error) {
    if (import.meta.env.DEV) {
      // TEMPORARY diagnostic logging — remove once the root cause of the
      // reportMachineMalfunction() failure is confirmed and fixed.
      console.error('[oboost] reportMachineMalfunction error (full):', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    if (
      error.message.includes('Not authenticated')
      || error.message.includes('Not authorized')
      || error.message.includes('Machine does not exist')
      || error.message.includes('Read-only preview')
    ) {
      return { error: translateBackendError(error.message) };
    }
    return { error: withDevDetail('לא ניתן היה לדווח על התקלה. אנא נסו שוב.', error.message) };
  }
  return { error: null };
}

export async function markMaintenanceReportInProgress(reportId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('maintenance_reports')
    .update({ status: 'in_progress' })
    .eq('id', reportId);

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] markMaintenanceReportInProgress error:', error.message);
    return { error: 'לא ניתן היה לעדכן את הדיווח. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function resolveMaintenanceReport(
  reportId: string,
  resolutionNotes: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('resolve_maintenance_report', {
    p_report_id: reportId,
    p_resolution_notes: resolutionNotes || null,
  } as never);

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] resolveMaintenanceReport error:', error.message);
    return { error: 'לא ניתן היה לפתור את הדיווח. אנא נסו שוב.' };
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Orange carton inventory (Phase E)
// ---------------------------------------------------------------------------

export type InventoryTransactionType = 'delivery' | 'withdrawal' | 'adjustment';

export interface InventoryTransactionRecord {
  id: string;
  type: InventoryTransactionType;
  quantity: number;
  recordedByName: string;
  notes: string;
  createdAt: string;
}

export interface OrangeInventoryData {
  currentStock: number;
  transactions: InventoryTransactionRecord[];
}

export async function getOrangeInventory(limit?: number): Promise<{ data: OrangeInventoryData | null; error: string | null }> {
  const [stockRes, itemRes] = await Promise.all([
    supabase.rpc('get_orange_stock' as never),
    supabase.from('inventory_items').select('id').eq('item_type', 'orange_carton').limit(1).single(),
  ]);

  if (stockRes.error || itemRes.error || !itemRes.data) {
    if (import.meta.env.DEV) {
      if (stockRes.error) console.error('[oboost] getOrangeInventory stock error:', stockRes.error.message);
      if (itemRes.error) console.error('[oboost] getOrangeInventory item error:', itemRes.error.message);
    }
    return { data: null, error: 'לא ניתן היה לטעון את המלאי. אנא נסו שוב.' };
  }

  const itemId = (itemRes.data as { id: string }).id;
  const currentStock = (stockRes.data as number | null) ?? 0;

  let txnQuery = supabase
    .from('inventory_transactions')
    .select('id, transaction_type, quantity, recorded_by, notes, created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (limit !== undefined) txnQuery = txnQuery.limit(limit);
  const txnRes = await txnQuery;

  type TxnRow = {
    id: string;
    transaction_type: InventoryTransactionType;
    quantity: number;
    recorded_by: string;
    notes: string;
    created_at: string;
  };
  const rows = (txnRes.data as TxnRow[] | null) ?? [];

  if (txnRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getOrangeInventory transactions error:', txnRes.error.message);
    return { data: null, error: 'לא ניתן היה לטעון את המלאי. אנא נסו שוב.' };
  }

  const userIds = Array.from(new Set(rows.map(r => r.recorded_by)));
  let nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const profilesRes = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    type ProfileRow = { id: string; full_name: string };
    nameById = new Map(((profilesRes.data as ProfileRow[] | null) ?? []).map(p => [p.id, p.full_name || '—']));
  }

  return {
    data: {
      currentStock,
      transactions: rows.map(r => ({
        id: r.id,
        type: r.transaction_type,
        quantity: r.quantity,
        recordedByName: nameById.get(r.recorded_by) ?? '—',
        notes: r.notes,
        createdAt: r.created_at,
      })),
    },
    error: null,
  };
}

export async function recordOrangeDelivery(quantity: number, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_orange_delivery', { p_quantity: quantity, p_notes: notes } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] recordOrangeDelivery error:', error.message);
    return { error: 'לא ניתן היה לרשום את הקבלה. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function recordOrangeWithdrawal(quantity: number, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_orange_withdrawal', { p_quantity: quantity, p_notes: notes } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] recordOrangeWithdrawal error:', error.message);
    if (error.message.includes('Insufficient stock') || error.message.includes('Read-only preview')) return { error: translateBackendError(error.message) };
    return { error: 'לא ניתן היה לרשום את המשיכה. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function recordOrangeAdjustment(quantity: number, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_orange_adjustment', { p_quantity: quantity, p_notes: notes } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] recordOrangeAdjustment error:', error.message);
    return { error: 'לא ניתן היה לרשום את ההתאמה. אנא נסו שוב.' };
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Spare parts inventory (Phase F) — same shared tables as orange cartons
// ---------------------------------------------------------------------------

export interface SparePartRecord {
  id: string;
  name: string;
  description: string;
  unit: string;
  isActive: boolean;
  currentStock: number;
}

export async function getSpareParts(): Promise<{ parts: SparePartRecord[]; error: string | null }> {
  const itemsRes = await supabase
    .from('inventory_items')
    .select('id, name, description, unit, is_active')
    .eq('item_type', 'spare_part')
    .order('name');

  type ItemRow = { id: string; name: string; description: string; unit: string; is_active: boolean };
  const items = (itemsRes.data as ItemRow[] | null) ?? [];

  if (itemsRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getSpareParts error:', itemsRes.error.message);
    return { parts: [], error: 'לא ניתן היה לטעון את חלקי החילוף. אנא נסו שוב.' };
  }
  if (items.length === 0) {
    return { parts: [], error: null };
  }

  const stockResults = await Promise.all(
    items.map(item => supabase.rpc('get_spare_part_stock', { p_item_id: item.id } as never))
  );

  return {
    parts: items.map((item, i) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      unit: item.unit,
      isActive: item.is_active,
      currentStock: (stockResults[i].data as number | null) ?? 0,
    })),
    error: null,
  };
}

export interface CreateSparePartInput {
  name: string;
  description: string;
  unit: string;
}

export async function createSparePart(input: CreateSparePartInput): Promise<{ error: string | null }> {
  const { error } = await supabase.from('inventory_items').insert({
    item_type: 'spare_part',
    name: input.name,
    description: input.description,
    unit: input.unit || 'unit',
  });

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] createSparePart error:', error.message);
    return { error: 'לא ניתן היה ליצור את חלק החילוף. אנא נסו שוב.' };
  }
  return { error: null };
}

export interface UpdateSparePartInput {
  name: string;
  description: string;
  unit: string;
}

// Same table/columns as createSparePart, and covered by the same existing
// RLS policy ("inventory_items: manager update spare parts", migration
// 20_spare_parts.sql) and `grant update on public.inventory_items to
// authenticated` — no schema/RLS/grant change needed for this.
export async function updateSparePart(id: string, input: UpdateSparePartInput): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ name: input.name, description: input.description, unit: input.unit || 'unit' })
    .eq('id', id);

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] updateSparePart error:', error.message);
    return { error: 'לא ניתן היה לעדכן את חלק החילוף. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function setSparePartActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('inventory_items').update({ is_active: isActive }).eq('id', id);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] setSparePartActive error:', error.message);
    return { error: 'לא ניתן היה לעדכן את חלק החילוף. אנא נסו שוב.' };
  }
  return { error: null };
}

export interface SparePartTransactionRecord {
  id: string;
  itemName: string;
  type: InventoryTransactionType;
  quantity: number;
  recordedByName: string;
  notes: string;
  createdAt: string;
}

export async function getSparePartTransactions(limit?: number): Promise<{ transactions: SparePartTransactionRecord[]; error: string | null }> {
  const itemsRes = await supabase.from('inventory_items').select('id, name').eq('item_type', 'spare_part');
  type ItemRow = { id: string; name: string };
  const items = (itemsRes.data as ItemRow[] | null) ?? [];

  if (itemsRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getSparePartTransactions items error:', itemsRes.error.message);
    return { transactions: [], error: 'לא ניתן היה לטעון את היסטוריית חלקי החילוף. אנא נסו שוב.' };
  }
  if (items.length === 0) {
    return { transactions: [], error: null };
  }

  const itemNameById = new Map(items.map(i => [i.id, i.name]));
  const itemIds = items.map(i => i.id);

  let txnQuery = supabase
    .from('inventory_transactions')
    .select('id, item_id, transaction_type, quantity, recorded_by, notes, created_at')
    .in('item_id', itemIds)
    .order('created_at', { ascending: false });
  if (limit !== undefined) txnQuery = txnQuery.limit(limit);
  const txnRes = await txnQuery;

  type TxnRow = {
    id: string;
    item_id: string;
    transaction_type: InventoryTransactionType;
    quantity: number;
    recorded_by: string;
    notes: string;
    created_at: string;
  };
  const rows = (txnRes.data as TxnRow[] | null) ?? [];

  if (txnRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getSparePartTransactions error:', txnRes.error.message);
    return { transactions: [], error: 'לא ניתן היה לטעון את היסטוריית חלקי החילוף. אנא נסו שוב.' };
  }

  const userIds = Array.from(new Set(rows.map(r => r.recorded_by)));
  let nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const profilesRes = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    type ProfileRow = { id: string; full_name: string };
    nameById = new Map(((profilesRes.data as ProfileRow[] | null) ?? []).map(p => [p.id, p.full_name || '—']));
  }

  return {
    transactions: rows.map(r => ({
      id: r.id,
      itemName: itemNameById.get(r.item_id) ?? '—',
      type: r.transaction_type,
      quantity: r.quantity,
      recordedByName: nameById.get(r.recorded_by) ?? '—',
      notes: r.notes,
      createdAt: r.created_at,
    })),
    error: null,
  };
}

export async function recordSparePartDelivery(itemId: string, quantity: number, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_spare_part_delivery', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_notes: notes,
  } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] recordSparePartDelivery error:', error.message);
    return { error: 'לא ניתן היה לרשום את הקבלה. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function recordSparePartWithdrawal(itemId: string, quantity: number, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_spare_part_withdrawal', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_notes: notes,
  } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] recordSparePartWithdrawal error:', error.message);
    if (error.message.includes('Insufficient stock') || error.message.includes('Read-only preview')) return { error: translateBackendError(error.message) };
    return { error: 'לא ניתן היה לרשום את המשיכה. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function recordSparePartAdjustment(itemId: string, quantity: number, notes: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_spare_part_adjustment', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_notes: notes,
  } as never);
  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] recordSparePartAdjustment error:', error.message);
    return { error: 'לא ניתן היה לרשום את ההתאמה. אנא נסו שוב.' };
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Employee tasks (Phase G)
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'completed';
export type TaskType = 'general' | 'cleaning';

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  assignedByName: string;
  machineId: string | null;
  machineName: string | null;
  dueDate: string | null;
  status: TaskStatus;
  taskType: TaskType;
  completionNotes: string | null;
  completionPhotoUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function getTasks(limit?: number): Promise<{ tasks: TaskRecord[]; error: string | null }> {
  let tasksQuery = supabase
    .from('tasks')
    .select('id, title, description, assigned_to, assigned_by, machine_id, due_date, status, task_type, completion_notes, completion_photo_url, created_at, completed_at')
    .order('created_at', { ascending: false });
  if (limit !== undefined) tasksQuery = tasksQuery.limit(limit);
  const tasksRes = await tasksQuery;

  type TaskRow = {
    id: string;
    title: string;
    description: string;
    assigned_to: string;
    assigned_by: string;
    machine_id: string | null;
    due_date: string | null;
    status: TaskStatus;
    task_type: TaskType;
    completion_notes: string | null;
    completion_photo_url: string | null;
    created_at: string;
    completed_at: string | null;
  };
  const rows = (tasksRes.data as TaskRow[] | null) ?? [];

  if (tasksRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getTasks error:', tasksRes.error.message);
    return { tasks: [], error: withDevDetail('לא ניתן היה לטעון את המשימות. אנא נסו שוב.', tasksRes.error.message) };
  }
  if (rows.length === 0) {
    return { tasks: [], error: null };
  }

  const userIds = Array.from(new Set([...rows.map(r => r.assigned_to), ...rows.map(r => r.assigned_by)]));
  let nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const profilesRes = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    type ProfileRow = { id: string; full_name: string };
    nameById = new Map(((profilesRes.data as ProfileRow[] | null) ?? []).map(p => [p.id, p.full_name || '—']));
  }

  const machineIds = Array.from(new Set(rows.map(r => r.machine_id).filter((id): id is string => !!id)));
  let machineNameById = new Map<string, string>();
  if (machineIds.length > 0) {
    const machinesRes = await supabase.from('machines').select('id, name').in('id', machineIds);
    type MachineNameRow = { id: string; name: string };
    machineNameById = new Map(((machinesRes.data as MachineNameRow[] | null) ?? []).map(m => [m.id, m.name]));
  }

  return {
    tasks: rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      assignedToId: r.assigned_to,
      assignedToName: nameById.get(r.assigned_to) ?? '—',
      assignedByName: nameById.get(r.assigned_by) ?? '—',
      machineId: r.machine_id,
      machineName: r.machine_id ? machineNameById.get(r.machine_id) ?? '—' : null,
      dueDate: r.due_date,
      status: r.status,
      taskType: r.task_type,
      completionNotes: r.completion_notes,
      completionPhotoUrl: r.completion_photo_url,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    })),
    error: null,
  };
}

export interface CreateTaskInput {
  title: string;
  description: string;
  assignedTo: string;
  machineId: string | null;
  dueDate: string | null;
  taskType: TaskType;
}

export async function createTask(input: CreateTaskInput): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('create_task', {
    p_title: input.title,
    p_assigned_to: input.assignedTo,
    p_description: input.description,
    p_machine_id: input.machineId,
    p_due_date: input.dueDate,
    p_task_type: input.taskType,
  } as never);

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] createTask error:', error.message);
    if (
      error.message.includes('Not authorized')
      || error.message.includes('Task title is required')
      || error.message.includes('Assigned employee not found')
      || error.message.includes('cleaning task must be linked')
    ) {
      return { error: translateBackendError(error.message) };
    }
    return { error: withDevDetail('לא ניתן היה ליצור את המשימה. אנא נסו שוב.', error.message) };
  }
  return { error: null };
}

export async function completeTask(
  taskId: string,
  completionNotes: string,
  completionPhotoUrl: string | null = null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('complete_task', {
    p_task_id: taskId,
    p_completion_notes: completionNotes || null,
    p_completion_photo_url: completionPhotoUrl,
  } as never);

  if (error) {
    if (import.meta.env.DEV) console.error('[oboost] completeTask error:', error.message);
    if (error.message.includes('Read-only preview')) return { error: translateBackendError(error.message) };
    return { error: 'לא ניתן היה להשלים את המשימה. אנא נסו שוב.' };
  }
  return { error: null };
}

export async function uploadTaskCompletionPhoto(file: File): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { url: null, error: 'לא מחוברים למערכת.' };

  const path = `tasks/${uid}/${safeFileName(file)}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) {
    if (import.meta.env.DEV) console.error('[oboost] uploadTaskCompletionPhoto error:', uploadError.message);
    return { url: null, error: withDevDetail('לא ניתן היה להעלות את התמונה. אנא נסו שוב.', uploadError.message) };
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ---------------------------------------------------------------------------
// Reports / activity history (Phase H)
//
// RLS on cleaning_logs / maintenance_reports scopes SELECT to elevated
// users or anyone assigned to the machine — broader than "my own
// actions". mineOnly here adds an explicit cleaned_by / reported_by
// filter on top of that so "My Activity" shows only what the current
// user actually did, not everything on machines they merely share.
// Manager (mineOnly = false) relies on RLS alone to see everything.
// ---------------------------------------------------------------------------

export interface CleaningHistoryRecord {
  id: string;
  machineName: string;
  cleanedByName: string;
  cleanedAt: string;
}

export async function getCleaningHistory(mineOnly: boolean, limit?: number): Promise<{ records: CleaningHistoryRecord[]; error: string | null }> {
  let query = supabase
    .from('cleaning_logs')
    .select('id, machine_id, cleaned_by, cleaned_at')
    .order('cleaned_at', { ascending: false });

  if (mineOnly) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { records: [], error: 'לא מחוברים למערכת.' };
    query = query.eq('cleaned_by', uid);
  }
  if (limit !== undefined) query = query.limit(limit);

  const logsRes = await query;
  type LogRow = { id: string; machine_id: string; cleaned_by: string; cleaned_at: string };
  const rows = (logsRes.data as LogRow[] | null) ?? [];

  if (logsRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getCleaningHistory error:', logsRes.error.message);
    return { records: [], error: 'לא ניתן היה לטעון את היסטוריית הניקיון. אנא נסו שוב.' };
  }
  if (rows.length === 0) {
    return { records: [], error: null };
  }

  const machineIds = Array.from(new Set(rows.map(r => r.machine_id)));
  const machinesRes = await supabase.from('machines').select('id, name').in('id', machineIds);
  type MachineNameRow = { id: string; name: string };
  const machineNameById = new Map(((machinesRes.data as MachineNameRow[] | null) ?? []).map(m => [m.id, m.name]));

  const userIds = Array.from(new Set(rows.map(r => r.cleaned_by)));
  let nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const profilesRes = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    type ProfileRow = { id: string; full_name: string };
    nameById = new Map(((profilesRes.data as ProfileRow[] | null) ?? []).map(p => [p.id, p.full_name || '—']));
  }

  return {
    records: rows.map(r => ({
      id: r.id,
      machineName: machineNameById.get(r.machine_id) ?? '—',
      cleanedByName: nameById.get(r.cleaned_by) ?? '—',
      cleanedAt: r.cleaned_at,
    })),
    error: null,
  };
}

export interface MalfunctionHistoryRecord {
  id: string;
  machineName: string;
  reportedByName: string;
  reportedAt: string;
  description: string;
  faultType: string;
  severity: ReportSeverity;
  status: ReportStatus;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

export async function getMalfunctionHistory(mineOnly: boolean, limit?: number): Promise<{ records: MalfunctionHistoryRecord[]; error: string | null }> {
  let query = supabase
    .from('maintenance_reports')
    .select('id, machine_id, reported_by, reported_at, description, fault_type, severity, status, resolved_by, resolved_at, resolution_notes')
    .order('reported_at', { ascending: false });

  if (mineOnly) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { records: [], error: 'לא מחוברים למערכת.' };
    query = query.eq('reported_by', uid);
  }
  if (limit !== undefined) query = query.limit(limit);

  const reportsRes = await query;
  type ReportRow = {
    id: string;
    machine_id: string;
    reported_by: string;
    reported_at: string;
    description: string;
    fault_type: string;
    severity: ReportSeverity;
    status: ReportStatus;
    resolved_by: string | null;
    resolved_at: string | null;
    resolution_notes: string | null;
  };
  const rows = (reportsRes.data as ReportRow[] | null) ?? [];

  if (reportsRes.error) {
    if (import.meta.env.DEV) console.error('[oboost] getMalfunctionHistory error:', reportsRes.error.message);
    return { records: [], error: 'לא ניתן היה לטעון את היסטוריית התקלות. אנא נסו שוב.' };
  }
  if (rows.length === 0) {
    return { records: [], error: null };
  }

  const machineIds = Array.from(new Set(rows.map(r => r.machine_id)));
  const machinesRes = await supabase.from('machines').select('id, name').in('id', machineIds);
  type MachineNameRow = { id: string; name: string };
  const machineNameById = new Map(((machinesRes.data as MachineNameRow[] | null) ?? []).map(m => [m.id, m.name]));

  const userIds = Array.from(new Set([
    ...rows.map(r => r.reported_by),
    ...rows.map(r => r.resolved_by).filter((id): id is string => !!id),
  ]));
  let nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const profilesRes = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    type ProfileRow = { id: string; full_name: string };
    nameById = new Map(((profilesRes.data as ProfileRow[] | null) ?? []).map(p => [p.id, p.full_name || '—']));
  }

  return {
    records: rows.map(r => ({
      id: r.id,
      machineName: machineNameById.get(r.machine_id) ?? '—',
      reportedByName: nameById.get(r.reported_by) ?? '—',
      reportedAt: r.reported_at,
      description: r.description,
      faultType: r.fault_type,
      severity: r.severity,
      status: r.status,
      resolvedByName: r.resolved_by ? nameById.get(r.resolved_by) ?? '—' : null,
      resolvedAt: r.resolved_at,
      resolutionNotes: r.resolution_notes,
    })),
    error: null,
  };
}
