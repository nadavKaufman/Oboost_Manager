import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type Machine, getMachineStatus, getCleaningElapsedText, type UserRole } from '../../types/machine';
import MachineIcon from './MachineIcon';

interface Props {
  machines: Machine[];
  onMarkCleaned: (id: string) => void;
  currentUserRole?: UserRole;
  savingWorkingIds: Set<string>;
  onMarkWorking: (id: string) => void;
  savingCleanIds: Set<string>;
}

const STATUS_LABEL: Record<string, string> = {
  clean: 'Clean',
  due_soon: 'Clean Due',
  overdue: 'Overdue',
};

const FAULT_LABEL: Record<string, string> = {
  ok: 'OK',
  fault: 'Malfunction',
  maintenance: 'Maintenance',
};

const FAULT_STATUS_CLASS: Record<string, string> = {
  ok: 'status-badge--clean',
  fault: 'status-badge--overdue',
  maintenance: 'status-badge--maintenance',
};

export default function MachineTable({
  machines,
  onMarkCleaned,
  currentUserRole,
  savingWorkingIds,
  onMarkWorking,
  savingCleanIds,
}: Props) {
  // Preview sees the same "Mark as Working" affordance a manager
  // would (full manager-style read view); the click itself is blocked
  // by the parent's onMarkWorking handler, not by hiding this button.
  const canMarkWorking = currentUserRole === 'manager' || currentUserRole === 'preview';

  // Mobile-only accordion: which single row (if any) has its elapsed-time
  // text + actions revealed. Desktop ignores this entirely (see the
  // `.machine-row-collapse` CSS in dashboard.css, which is `display: contents`
  // outside the mobile breakpoint — same no-op trick CollapsibleSection uses
  // for its `mobileOnly` prop), so this state has zero visual effect above
  // 767px no matter what it's set to.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpanded(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
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
            <th>Status</th>
            <th>Cleaning</th>
            <th>Malfunction</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {machines.map(machine => {
            const { status, daysSinceCleaned } = getMachineStatus(machine);
            const isExpanded = expandedId === machine.id;
            const collapseClass = `machine-row-collapse${isExpanded ? ' machine-row-collapse--open' : ''}`;

            return (
              <tr key={machine.id} className={isExpanded ? 'machine-row--expanded' : undefined}>
                <td onClick={() => toggleExpanded(machine.id)}>
                  <div className="machine-cell">
                    <Link to={`/machines/${machine.id}`} className="machine-thumb" aria-hidden="true" tabIndex={-1}>
                      {machine.imageUrl ? (
                        <img src={machine.imageUrl} alt="" />
                      ) : (
                        <MachineIcon className="machine-thumb__icon" />
                      )}
                    </Link>
                    <div>
                      <div className="machine-name">
                        <Link to={`/machines/${machine.id}`}>{machine.name}</Link>
                      </div>
                      <div className="machine-location">{machine.location}</div>
                    </div>
                    <button
                      type="button"
                      className={`machine-row-chevron collapsible-chevron${isExpanded ? ' collapsible-chevron--open' : ''}`}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse machine details' : 'Expand machine details'}
                      onClick={e => {
                        e.stopPropagation();
                        toggleExpanded(machine.id);
                      }}
                    >
                      ▾
                    </button>
                  </div>
                </td>
                <td data-label="Status" onClick={() => toggleExpanded(machine.id)}>
                  <span className={`status-badge status-badge--${machine.isActive ? 'clean' : 'overdue'}`}>
                    <span className="status-badge__dot" />
                    {machine.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td data-label="Cleaning" onClick={() => toggleExpanded(machine.id)}>
                  <span
                    className={`status-badge status-badge--${status}${status === 'overdue' ? ' status-badge--cleaning-overdue' : ''}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <div className={collapseClass}>
                    <div className="machine-row-collapse__inner">
                      <div className="machine-date">{getCleaningElapsedText(daysSinceCleaned)}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Malfunction" onClick={() => toggleExpanded(machine.id)}>
                  <span className={`status-badge ${FAULT_STATUS_CLASS[machine.faultStatus]}`}>
                    <span className="status-badge__dot" />
                    {FAULT_LABEL[machine.faultStatus]}
                  </span>
                </td>
                <td data-label="Actions">
                  <div className={collapseClass}>
                    <div className="machine-row-collapse__inner">
                      <div className="table-actions">
                        <button
                          className="btn-mark-clean"
                          disabled={savingCleanIds.has(machine.id)}
                          onClick={() => onMarkCleaned(machine.id)}
                        >
                          {savingCleanIds.has(machine.id) ? 'Saving…' : 'Mark Cleaned'}
                        </button>
                        <Link className="btn-report-issue" to={`/machines/${machine.id}/report-malfunction`}>
                          Report Malfunction
                        </Link>
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
                    </div>
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
