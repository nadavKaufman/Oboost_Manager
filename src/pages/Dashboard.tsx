import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import StatStrip from '../components/dashboard/StatStrip';
import CollapsibleSection from '../components/dashboard/CollapsibleSection';
import { type Machine, getMachineStatus } from '../types/machine';
import { useAuth } from '../context/AuthContext';
import {
  getMachines,
  getEmployees,
  getTasks,
  getOrangeInventory,
  getSpareParts,
  getCleaningHistory,
  getMalfunctionHistory,
  type TaskRecord,
  type SparePartRecord,
} from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = {
  name: '',
  role: 'employee' as const,
};

const LOW_STOCK_THRESHOLD = 5;

type PageStatus = 'loading' | 'error' | 'ready';

interface ActivityItem {
  key: string;
  text: string;
  timestamp: string;
}

export default function Dashboard() {
  const { profile, session, loading } = useAuth();
  const displayName = profile?.full_name ?? FALLBACK_USER.name;
  const [status, setStatus] = useState<PageStatus>('loading');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [orangeStock, setOrangeStock] = useState(0);
  const [spareParts, setSpareParts] = useState<SparePartRecord[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (loading) return;
    setStatus('loading');

    Promise.all([
      getMachines(),
      getEmployees(),
      getTasks(),
      getOrangeInventory(),
      getSpareParts(),
      getCleaningHistory(false, 5),
      getMalfunctionHistory(false, 5),
    ]).then(([machinesRes, employeesRes, tasksRes, orangeRes, sparePartsRes, cleaningRes, malfunctionRes]) => {
      if (machinesRes.error || employeesRes.error || tasksRes.error) {
        setStatus('error');
        return;
      }

      setMachines(machinesRes.machines);
      setEmployeeCount(employeesRes.employees.length);
      setTasks(tasksRes.tasks);
      setOrangeStock(orangeRes.data?.currentStock ?? 0);
      setSpareParts(sparePartsRes.parts);

      const cleaningItems: ActivityItem[] = cleaningRes.records.map(r => ({
        key: `clean-${r.id}`,
        text: `${r.cleanedByName} cleaned ${r.machineName}`,
        timestamp: r.cleanedAt,
      }));
      const malfunctionItems: ActivityItem[] = malfunctionRes.records.map(r => ({
        key: `fault-${r.id}`,
        text: `${r.reportedByName} reported an issue on ${r.machineName}`,
        timestamp: r.reportedAt,
      }));
      const completedTaskItems: ActivityItem[] = tasksRes.tasks
        .filter(t => t.completedAt)
        .map(t => ({
          key: `task-${t.id}`,
          text: `${t.assignedToName} completed "${t.title}"`,
          timestamp: t.completedAt as string,
        }));

      const merged = [...cleaningItems, ...malfunctionItems, ...completedTaskItems]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6);
      setActivity(merged);

      setStatus('ready');
    });
  }, [loading, session]);

  const today = new Date().toISOString().slice(0, 10);

  const activeMachines = machines.filter(m => m.isActive).length;
  const malfunctioning = machines.filter(m => m.faultStatus === 'fault').length;
  const cleaningOverdue = machines.filter(m => getMachineStatus(m).status === 'overdue').length;
  const cleaningDueSoon = machines.filter(m => getMachineStatus(m).status === 'due_soon').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.dueDate !== null && t.dueDate < today).length;
  const lowStockParts = spareParts.filter(p => p.currentStock <= LOW_STOCK_THRESHOLD).length;

  return (
    <DashboardLayout title="Operations Dashboard" currentUser={FALLBACK_USER}>
      <div className="dashboard-page dashboard-overview-page">
        <div className="page-header">
          <img
            src="/logos/oboost-logo-transparent.png"
            alt="OBoost"
            className="page-header__logo"
          />
          <h2 className="page-header__title">
            <span className="page-header__eyebrow">Welcome back</span>
            <span className="page-header__title-sep">, </span>
            <span className="page-header__name">{displayName}</span>
          </h2>
          <p className="page-header__subtitle">
            Operations overview — all machines and staff across OBoost locations.
          </p>
        </div>

        {status === 'loading' && (
          <p className="employee-empty">Loading overview…</p>
        )}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load the overview. Please try again.
          </div>
        )}

        {status === 'ready' && machines.length === 0 && (
          <p className="employee-empty">No machines have been added yet.</p>
        )}

        {status === 'ready' && machines.length > 0 && (
          <div className="overview-grid">
            {/* Hero zone: the 3 metrics that deserve immediate visibility.
                On desktop this is Malfunctioning / Overdue / Overdue Tasks
                (unchanged). On mobile, Overdue Tasks is swapped out for
                Pending Tasks per product direction — both cards are always
                rendered and toggled purely via CSS (.overview-critical__desktop-only
                / __mobile-only in dashboard.css), so there's only ever one
                copy of each value's markup, just repositioned/hidden per
                breakpoint. Overdue Tasks isn't lost on mobile — it reappears
                smaller in the quiet reference zone below. */}
            <section className="overview-critical">
              <span className="overview-section-label">Needs Attention</span>
              <div className="overview-critical__cards">
                <StatCard
                  size="lg"
                  label="Malfunctioning"
                  value={malfunctioning}
                  accent={malfunctioning > 0 ? 'red' : 'default'}
                  subtext="Active reports"
                />
                <StatCard
                  size="lg"
                  label="Overdue"
                  value={cleaningOverdue}
                  accent={cleaningOverdue > 0 ? 'red' : 'default'}
                  subtext="14+ days since cleaning"
                />
                <StatCard
                  size="lg"
                  label="Overdue Tasks"
                  value={overdueTasks}
                  accent={overdueTasks > 0 ? 'red' : 'default'}
                  subtext="Past due date"
                  className="overview-critical__desktop-only"
                />
                <StatCard
                  size="lg"
                  label="Pending Tasks"
                  value={pendingTasks}
                  subtext="Not yet completed"
                  className="overview-critical__mobile-only"
                />
              </div>
            </section>

            <section className="overview-activity">
              <CollapsibleSection
                title="Recent Activity"
                count={`${activity.length} ${activity.length === 1 ? 'item' : 'items'}`}
                mobileOnly
                className="machine-section--activity-panel"
              >
                {activity.length === 0 ? (
                  <p className="employee-empty">No recent activity yet.</p>
                ) : (
                  <ul className="activity-list">
                    {activity.map(item => (
                      <li key={item.key} className="activity-item">
                        <span>{item.text}</span>
                        <span className="activity-item__time">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>
            </section>

            {/* Quiet reference zone: on desktop this wrapper is `display:
                contents` (same technique CollapsibleSection's `mobileOnly`
                uses, just inverted) so .overview-secondary/.overview-reference
                stay direct grid children in their existing grid-areas —
                pixel-identical to before. On mobile it becomes a real flex
                column so "Warnings" and "At a Glance" read as ONE
                de-emphasized grouping under a single surviving label. */}
            <div className="overview-quiet">
              <section className="overview-secondary">
                <span className="overview-section-label">Warnings</span>
                <div className="overview-secondary__cards">
                  <StatCard
                    label="Clean Due"
                    value={cleaningDueSoon}
                    accent={cleaningDueSoon > 0 ? 'amber' : 'default'}
                    subtext="7–13 days"
                  />
                  <StatCard
                    label="Low Stock Parts"
                    value={lowStockParts}
                    accent={lowStockParts > 0 ? 'amber' : 'default'}
                    subtext={`${LOW_STOCK_THRESHOLD} units or fewer`}
                  />
                  <StatCard
                    label="Overdue Tasks"
                    value={overdueTasks}
                    accent={overdueTasks > 0 ? 'red' : 'default'}
                    subtext="Past due date"
                    className="overview-secondary__mobile-only"
                  />
                </div>
              </section>

              <section className="overview-reference">
                <span className="overview-section-label">At a Glance</span>
                <StatStrip
                  items={[
                    { key: 'active-machines', label: 'Active Machines', value: activeMachines, subtext: `${machines.length} total` },
                    { key: 'active-employees', label: 'Active Employees', value: employeeCount, subtext: 'On the team' },
                    { key: 'pending-tasks', label: 'Pending Tasks', value: pendingTasks, subtext: 'Not yet completed' },
                    { key: 'orange-stock', label: 'Orange Stock', value: orangeStock, subtext: 'Cartons on hand' },
                  ]}
                />
              </section>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
