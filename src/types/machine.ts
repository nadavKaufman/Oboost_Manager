export type UserRole = 'manager' | 'employee';

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
  address: string;
  model: string;
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
  daysUntilDue: number;
}

// Status is derived from full days since last_cleaned_at, not from the
// stored cleaning_status column, so a legacy DB value never surfaces
// in the UI and a null last_cleaned_at safely reads as overdue.
export function getMachineStatus(machine: Machine): MachineStatus {
  const now = new Date();
  const due = new Date(machine.nextCleaningDueAt);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (!machine.lastCleaned) {
    return { status: 'overdue', daysSinceCleaned: null, daysUntilDue };
  }

  const last = new Date(machine.lastCleaned);
  const daysSinceCleaned = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  let status: CleaningStatus;
  if (daysSinceCleaned >= 14) status = 'overdue';
  else if (daysSinceCleaned >= 7) status = 'due_soon';
  else status = 'clean';

  return { status, daysSinceCleaned, daysUntilDue };
}
