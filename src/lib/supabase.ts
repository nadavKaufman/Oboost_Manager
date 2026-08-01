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
      };
    };
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
