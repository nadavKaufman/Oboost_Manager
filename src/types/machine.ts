export type UserRole = 'manager' | 'employee' | 'preview';

export type FaultStatus = 'ok' | 'fault' | 'maintenance';

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  assignedMachineIds: string[];
  activeTaskCount: number;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface Machine {
  id: string;
  name: string;
  location: string;
  imageUrl: string | null;
  isActive: boolean;
  lastCleaned: string | null;
  cleaningIntervalDays: number;
  nextCleaningDueAt: string;
  assignedEmployeeIds: string[];
  faultStatus: FaultStatus;
  maintenanceNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type CleaningStatus = 'clean' | 'due_soon' | 'overdue';

export interface MachineStatus {
  status: CleaningStatus;
  daysSinceCleaned: number | null;
}

// Status is derived from full days since last_cleaned_at, not from the
// stored cleaning_status column, so a legacy DB value never surfaces
// in the UI and a null last_cleaned_at safely reads as overdue.
//
// There is deliberately no "days until due" / deadline concept exposed
// anywhere here — the product decision is to show only the current
// status plus how long ago the machine was cleaned, never a countdown.
export function getMachineStatus(machine: Machine): MachineStatus {
  if (!machine.lastCleaned) {
    return { status: 'overdue', daysSinceCleaned: null };
  }

  const now = new Date();
  const last = new Date(machine.lastCleaned);
  const daysSinceCleaned = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  let status: CleaningStatus;
  if (daysSinceCleaned >= 14) status = 'overdue';
  else if (daysSinceCleaned >= 7) status = 'due_soon';
  else status = 'clean';

  return { status, daysSinceCleaned };
}

// Shared "small secondary text" for how long ago a machine was cleaned —
// used everywhere cleaning status is shown so the wording stays identical.
export function getCleaningElapsedText(daysSinceCleaned: number | null): string {
  if (daysSinceCleaned === null) return 'Never cleaned';
  if (daysSinceCleaned === 0) return 'Today';
  if (daysSinceCleaned === 1) return '1 day passed';
  return `${daysSinceCleaned} days passed`;
}
