import { useState } from 'react';
import { type Machine, getMachineStatus, type Employee, type UserRole } from '../../types/machine';

interface Props {
  machines: Machine[];
  employees: Employee[];
  onMarkCleaned: (id: string) => void;
  currentUserRole?: UserRole;
  savingWorkingIds: Set<string>;
  onMarkWorking: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  clean: 'Clean',
  needs_cleaning: 'Needs Cleaning',
  overdue: 'Overdue',
};

const FAULT_LABEL: Record<string, string> = {
  ok: 'OK',
  fault: 'Fault',
  maintenance: 'Maintenance',
};

const FAULT_STATUS_CLASS: Record<string, string> = {
  ok: 'status-badge--clean',
  fault: 'status-badge--overdue',
  maintenance: 'status-badge--needs_cleaning',
};

export default function MachineTable({
  machines,
  employees,
  onMarkCleaned,
  currentUserRole,
  savingWorkingIds,
  onMarkWorking,
}: Props) {
  const [reported, setReported] = useState<Set<string>>(new Set());
  const canMarkWorking = currentUserRole === 'manager';

  function toggleReport(id: string) {
    setReported(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getEmployeeName(id: string): string {
    return employees.find(e => e.id === id)?.name ?? '—';
  }

  return (
    <div className="machine-section">
      <div className="machine-section__header">
        <span className="machine-section__title">All Machines</span>
        <span className="machine-section__count">{machines.length} machines</span>
      </div>

      <table className="machine-table">
        <thead>
          <tr>
            <th>Machine</th>
            <th>Assigned Employee</th>
            <th>Last Cleaned</th>
            <th>Next Due</th>
            <th>Cleaning</th>
            <th>Fault</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {machines.map(machine => {
            const { status, daysSinceCleaned, daysUntilDue } = getMachineStatus(machine);
            const isReported = reported.has(machine.id);

            const dueText =
              daysUntilDue < 0
                ? `${Math.abs(daysUntilDue)}d overdue`
                : daysUntilDue === 0
                ? 'Due today'
                : `In ${daysUntilDue}d`;

            return (
              <tr key={machine.id}>
                <td>
                  <div className="machine-name">{machine.name}</div>
                  <div className="machine-location">{machine.location}</div>
                </td>
                <td data-label="Assigned Employee">
                  <span className="machine-model">{getEmployeeName(machine.assignedEmployeeId)}</span>
                </td>
                <td data-label="Last Cleaned">
                  <span className="machine-date">{daysSinceCleaned}d ago</span>
                </td>
                <td data-label="Next Due">
                  <span className={`machine-due machine-due--${status}`}>{dueText}</span>
                </td>
                <td data-label="Cleaning">
                  <span className={`status-badge status-badge--${status}`}>
                    <span className="status-badge__dot" />
                    {STATUS_LABEL[status]}
                  </span>
                </td>
                <td data-label="Fault">
                  <span className={`status-badge ${FAULT_STATUS_CLASS[machine.faultStatus]}`}>
                    <span className="status-badge__dot" />
                    {FAULT_LABEL[machine.faultStatus]}
                  </span>
                </td>
                <td data-label="Actions">
                  <div className="table-actions">
                    <button
                      className="btn-mark-clean"
                      onClick={() => onMarkCleaned(machine.id)}
                    >
                      Mark Cleaned
                    </button>
                    <button
                      className={`btn-report-issue${isReported ? ' reported' : ''}`}
                      onClick={() => toggleReport(machine.id)}
                    >
                      {isReported ? 'Reported ✓' : 'Report Issue'}
                    </button>
                    {canMarkWorking && machine.faultStatus === 'fault' && (
                      <button
                        className="btn-mark-working"
                        disabled={savingWorkingIds.has(machine.id)}
                        onClick={() => onMarkWorking(machine.id)}
                      >
                        {savingWorkingIds.has(machine.id) ? 'Saving…' : 'Mark as Working'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
