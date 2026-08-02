import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
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
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">Welcome back, {displayName}</h2>
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
          <>
            <div className="stat-cards">
              <StatCard label="Active Machines" value={activeMachines} subtext={`${machines.length} total`} />
              <StatCard
                label="Malfunctioning"
                value={malfunctioning}
                accent={malfunctioning > 0 ? 'red' : 'default'}
                subtext="Active reports"
              />
              <StatCard
                label="Cleaning Overdue"
                value={cleaningOverdue}
                accent={cleaningOverdue > 0 ? 'red' : 'default'}
                subtext="14+ days"
              />
              <StatCard
                label="Cleaning Due Soon"
                value={cleaningDueSoon}
                accent={cleaningDueSoon > 0 ? 'amber' : 'default'}
                subtext="7–13 days"
              />
              <StatCard label="Active Employees" value={employeeCount} subtext="On the team" />
              <StatCard label="Pending Tasks" value={pendingTasks} subtext="Not yet completed" />
              <StatCard
                label="Overdue Tasks"
                value={overdueTasks}
                accent={overdueTasks > 0 ? 'red' : 'default'}
                subtext="Past due date"
              />
              <StatCard label="Orange Stock" value={orangeStock} subtext="Cartons on hand" />
              <StatCard
                label="Low Stock Parts"
                value={lowStockParts}
                accent={lowStockParts > 0 ? 'amber' : 'default'}
                subtext={`${LOW_STOCK_THRESHOLD} units or fewer`}
              />
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">Recent Activity</span>
              </div>
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
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
