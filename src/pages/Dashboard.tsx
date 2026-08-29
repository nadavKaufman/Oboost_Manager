import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import CleaningTaskBadge from '../components/dashboard/CleaningTaskBadge';
import { type Machine, getMachineStatus } from '../types/machine';
import { useAuth } from '../context/AuthContext';
import { getMachines, getTasks, getOrangeInventory, type TaskRecord } from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = {
  name: '',
  role: 'employee' as const,
};

type PageStatus = 'loading' | 'error' | 'ready';

export default function Dashboard() {
  const { session, loading } = useAuth();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  // Desktop-only "מלאי תפוזים" KPI card — same getOrangeInventory used by
  // the Inventory page, just read here too for the extra card.
  const [orangeStock, setOrangeStock] = useState(0);

  useEffect(() => {
    if (loading) return;
    setStatus('loading');

    Promise.all([getMachines(), getTasks(), getOrangeInventory()]).then(([machinesRes, tasksRes, orangeRes]) => {
      if (machinesRes.error || tasksRes.error || orangeRes.error) {
        setStatus('error');
        return;
      }
      setMachines(machinesRes.machines);
      setTasks(tasksRes.tasks);
      setOrangeStock(orangeRes.data?.currentStock ?? 0);
      setStatus('ready');
    });
  }, [loading, session]);

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(t => t.dueDate === today);

  const cleanCount = machines.filter(m => getMachineStatus(m).status === 'clean').length;
  const needsCleaningCount = machines.length - cleanCount;

  return (
    <DashboardLayout title="ראשי" currentUser={FALLBACK_USER}>
      <div className="dashboard-page dashboard-overview-page">
        <div className="page-header">
          <img
            src="/logos/oboost-logo-transparent.png"
            alt="OBoost"
            className="page-header__logo"
          />
        </div>

        {status === 'loading' && (
          <p className="employee-empty">טוען סקירה…</p>
        )}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            לא ניתן היה לטעון את הסקירה. אנא נסו שוב.
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="machine-section today-tasks-section" style={{ marginBottom: 28 }}>
              <div className="machine-section__header">
                <span className="machine-section__title">המשימות להיום</span>
              </div>
              {todayTasks.length === 0 ? (
                <p className="employee-empty">אין משימות שנקבעו להיום.</p>
              ) : (
                <>
                  {/* Desktop: unchanged full table. Hidden on mobile — see
                      .today-tasks-table in dashboard.css. */}
                  <table className="machine-table today-tasks-table">
                    <thead>
                      <tr>
                        <th>כותרת</th>
                        <th>מוקצה ל</th>
                        <th>מכונה</th>
                        <th>סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayTasks.map(task => (
                        <tr key={task.id}>
                          <td>
                            <div className="machine-name">{task.title}</div>
                            {task.taskType === 'cleaning' && <CleaningTaskBadge />}
                            {task.description && <div className="machine-location">{task.description}</div>}
                          </td>
                          <td>{task.assignedToName}</td>
                          <td>{task.machineName ?? '—'}</td>
                          <td>
                            <span className={`status-badge status-badge--${task.status === 'completed' ? 'clean' : 'maintenance'}`}>
                              <span className="status-badge__dot" />
                              {task.status === 'completed' ? 'הושלם' : 'ממתין'}
                            </span>
                            {task.completionNotes && <div className="machine-location">הערות: {task.completionNotes}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile: compact 1-2 line rows — title + status on one
                      line, assignee/machine as small muted meta on the
                      next, instead of the generic "every field its own
                      row" table-to-cards fallback. Hidden on desktop, where
                      the table above is shown instead. */}
                  <ul className="today-tasks-list">
                    {todayTasks.map(task => (
                      <li key={task.id} className="today-tasks-list__row">
                        <div className="today-tasks-list__top">
                          <span className="today-tasks-list__title">{task.title}</span>
                          <span className={`status-badge status-badge--${task.status === 'completed' ? 'clean' : 'maintenance'}`}>
                            <span className="status-badge__dot" />
                            {task.status === 'completed' ? 'הושלם' : 'ממתין'}
                          </span>
                        </div>
                        <div className="today-tasks-list__meta">
                          {task.taskType === 'cleaning' && <CleaningTaskBadge />}
                          <span>{task.assignedToName}</span>
                          {task.machineName && <span>· {task.machineName}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {machines.length > 0 && (
              <div className="stat-cards">
                <StatCard
                  size="lg"
                  label="מכונות נקיות"
                  value={cleanCount}
                  accent="green"
                  iconSrc="/icons/clean-up.png"
                  iconAlt=""
                />
                <StatCard
                  size="lg"
                  label="מכונות שדורשות ניקוי"
                  value={needsCleaningCount}
                  accent={needsCleaningCount > 0 ? 'red' : 'default'}
                  iconSrc="/icons/broom.png"
                  iconAlt=""
                />
                <StatCard
                  size="lg"
                  label="מלאי תפוזים"
                  value={orangeStock}
                  iconSrc="/icons/orange.png"
                  iconAlt=""
                  className="stat-card--desktop-only"
                />
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
