export type UserRole = 'manager' | 'admin' | 'worker' | 'employee';

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
  model: string;
  lastCleaned: string;
  cleaningIntervalDays: number;
  assignedEmployeeId: string;
  faultStatus: FaultStatus;
  maintenanceNotes: string;
}

export type CleaningStatus = 'clean' | 'needs_cleaning' | 'overdue';

export interface MachineStatus {
  status: CleaningStatus;
  daysSinceCleaned: number;
  daysUntilDue: number;
}

export function getMachineStatus(machine: Machine): MachineStatus {
  const now = new Date();
  const last = new Date(machine.lastCleaned);
  const daysSinceCleaned = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysUntilDue = machine.cleaningIntervalDays - daysSinceCleaned;

  let status: CleaningStatus;
  if (daysUntilDue < 0) status = 'overdue';
  else if (daysUntilDue <= 7) status = 'needs_cleaning';
  else status = 'clean';

  return { status, daysSinceCleaned, daysUntilDue };
}
