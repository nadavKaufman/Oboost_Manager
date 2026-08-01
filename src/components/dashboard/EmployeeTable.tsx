import type { Employee } from '../../types/machine';

const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  employee: 'Employee',
};

interface Props {
  employees: Employee[];
}

export default function EmployeeTable({ employees }: Props) {
  return (
    <div className="machine-section">
      <div className="machine-section__header">
        <span className="machine-section__title">Staff Assignments</span>
        <span className="machine-section__count">{employees.length} staff members</span>
      </div>

      <table className="machine-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Role</th>
            <th>Assigned Machines</th>
            <th>Active Tasks</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>
                <div className="machine-name">{emp.name}</div>
              </td>
              <td data-label="Role">
                <span className={`role-badge role-badge--${emp.role}`}>
                  {ROLE_LABEL[emp.role]}
                </span>
              </td>
              <td data-label="Assigned Machines">
                <span className="machine-model">
                  {emp.assignedMachineIds.length === 0
                    ? 'None assigned'
                    : `${emp.assignedMachineIds.length} machine${emp.assignedMachineIds.length > 1 ? 's' : ''}`}
                </span>
              </td>
              <td data-label="Active Tasks">
                <span className={emp.activeTaskCount > 0 ? 'task-count task-count--active' : 'task-count'}>
                  {emp.activeTaskCount}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
