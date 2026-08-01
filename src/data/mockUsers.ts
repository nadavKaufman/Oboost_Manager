import type { Employee } from '../types/machine';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'e2',
    name: 'Sara Cohen',
    role: 'admin',
    assignedMachineIds: ['m1', 'm2', 'm3'],
    activeTaskCount: 2,
  },
  {
    id: 'e3',
    name: 'Yossi Ben-David',
    role: 'worker',
    assignedMachineIds: ['m4', 'm5'],
    activeTaskCount: 1,
  },
  {
    id: 'e4',
    name: 'Rina Shapiro',
    role: 'employee',
    assignedMachineIds: ['m6'],
    activeTaskCount: 0,
  },
  {
    id: 'e5',
    name: 'Dan Mizrahi',
    role: 'worker',
    assignedMachineIds: [],
    activeTaskCount: 0,
  },
];
