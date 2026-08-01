import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Domain types — mirror the database check constraints exactly
// ---------------------------------------------------------------------------
export type UserRole       = 'employee' | 'manager';
export type FaultStatus    = 'ok' | 'fault' | 'maintenance';
export type CleaningStatus = 'clean' | 'needs_cleaning' | 'overdue';
export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus   = 'open' | 'in_progress' | 'resolved' | 'closed';

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
          model:                string;
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
          model?:                string;
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
          model?:                string;
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
        };
        Update: {
          fault_type?:       string;
          description?:      string;
          severity?:         ReportSeverity;
          status?:           ReportStatus;
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
import type { Machine } from '../types/machine';

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
}

export async function getEmployees(): Promise<EmployeeRecord[]> {
  const result = await supabase
    .from('employees')
    .select('employee_id, first_name, last_name, email, phone_number, hire_date, job_title, created_at, profiles (role)')
    .order('first_name');

  type EmpRow = {
    employee_id:  string;
    first_name:   string;
    last_name:    string;
    email:        string;
    phone_number: string;
    hire_date:    string | null;
    job_title:    string;
    created_at:   string;
    profiles:     { role: UserRole } | null;
  };
  const data = result.data as EmpRow[] | null;

  if (result.error) {
    console.error('[oboost] Supabase employees error:', result.error.message);
    return [];
  }
  if (!data || data.length === 0) {
    console.log('[oboost] Employees loaded: 0');
    return [];
  }
  console.log('[oboost] Employees loaded:', data.length);

  return data.map(row => ({
    employee_id:  row.employee_id,
    first_name:   row.first_name,
    last_name:    row.last_name,
    email:        row.email,
    phone_number: row.phone_number,
    hire_date:    row.hire_date,
    job_title:    row.job_title,
    created_at:   row.created_at,
    role:         row.profiles?.role ?? 'employee',
  }));
}

export interface CreateEmployeeInput {
  firstName:   string;
  lastName:    string;
  email:       string;
  phoneNumber: string;
  hireDate:    string | null;
  jobTitle:    string;
  role:        UserRole;
  password:    string;
}

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: `${input.firstName} ${input.lastName}`.trim() },
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: 'No user was created.' };

  const { error: empError } = await supabase.from('employees').insert({
    employee_id:  data.user.id,
    first_name:   input.firstName,
    last_name:    input.lastName,
    email:        input.email,
    phone_number: input.phoneNumber,
    hire_date:    input.hireDate,
    job_title:    input.jobTitle,
  });
  if (empError) return { error: empError.message };

  const { error: roleError } = await supabase
    .from('profiles')
    .update({ role: input.role })
    .eq('id', data.user.id);
  if (roleError) return { error: roleError.message };

  return { error: null };
}

export async function getMachines(): Promise<Machine[]> {
  console.log('[oboost] Fetching machines...');
  const result = await supabase
    .from('machines')
    .select('*')
    .eq('is_active', true)
    .order('name');

  // Cast needed: custom Database type omits auxiliary Supabase fields
  // (Views, Enums, Functions) so generic inference collapses to never.
  type MachineRow = Database['public']['Tables']['machines']['Row'];
  const data = result.data as MachineRow[] | null;

  if (result.error) {
    console.error('[oboost] Supabase machines error:', result.error.message);
    return [];
  }
  if (!data || data.length === 0) {
    console.log('[oboost] Machines loaded: 0');
    return [];
  }
  console.log('[oboost] Machines loaded:', data.length);

  return data.map(row => ({
    id: row.id,
    name: row.name,
    location: row.location,
    model: row.model,
    lastCleaned: row.last_cleaned_at?.split('T')[0] ?? '2000-01-01',
    cleaningIntervalDays: 21,
    assignedEmployeeId: '',
    faultStatus: row.fault_status,
    maintenanceNotes: row.maintenance_notes,
  }));
}

export async function markMachineWorking(machineId: string): Promise<{ error: string | null }> {
  // Cast needed: same generic collapse-to-never issue as getMachines() above,
  // affecting the update() argument type too.
  const { error } = await (supabase.from('machines') as any)
    .update({ fault_status: 'ok' })
    .eq('id', machineId);

  if (error) {
    console.error('[oboost] markMachineWorking error:', error.message);
    return { error: 'Could not update the machine. Please try again.' };
  }
  return { error: null };
}
