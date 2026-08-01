import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import MachineTable from '../components/dashboard/MachineTable';
import EmployeeTable from '../components/dashboard/EmployeeTable';
import { mockMachines } from '../data/mockMachines';
import { MOCK_EMPLOYEES } from '../data/mockUsers';
import { type Machine, getMachineStatus } from '../types/machine';
import { useAuth } from '../context/AuthContext';
import { getMachines, markMachineWorking } from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const MOCK_CURRENT_USER = {
  id: 'e1',
  name: 'Eitan Levy',
  role: 'manager' as const,
};

export default function Dashboard() {
  const { profile, session, loading } = useAuth();
  const displayName = profile?.full_name ?? MOCK_CURRENT_USER.name;
  const displayRole = profile?.role ?? MOCK_CURRENT_USER.role;
  const [machines, setMachines] = useState<Machine[]>(mockMachines);
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock');
  const [savingWorkingIds, setSavingWorkingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    console.log('[oboost] dashboard: session exists:', !!session);
    getMachines().then(rows => {
      console.log('[oboost] machines returned:', rows.length);
      if (rows.length > 0) {
        setMachines(rows);
        setDataSource('supabase');
      }
    });
  }, [loading, session]);

  function markAsCleaned(id: string) {
    const today = new Date().toISOString().split('T')[0];
    setMachines(prev =>
      prev.map(m =>
        m.id === id ? { ...m, lastCleaned: today, cleaningIntervalDays: 21 } : m
      )
    );
  }

  async function handleMarkWorking(id: string) {
    setActionError(null);
    setSavingWorkingIds(prev => new Set(prev).add(id));

    const { error } = await markMachineWorking(id);

    if (error) {
      setActionError(error);
    } else {
      const rows = await getMachines();
      if (rows.length > 0) setMachines(rows);
    }

    setSavingWorkingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const total = machines.length;
  const clean = machines.filter(m => getMachineStatus(m).status === 'clean').length;
  const needsCleaning = machines.filter(m => getMachineStatus(m).status === 'needs_cleaning').length;
  const overdue = machines.filter(m => getMachineStatus(m).status === 'overdue').length;
  const faults = machines.filter(m => m.faultStatus === 'fault').length;

  return (
    <DashboardLayout title="Operations Dashboard" currentUser={MOCK_CURRENT_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">Welcome back, {displayName}</h2>
          <p className="page-header__subtitle">
            Operations overview — all machines and staff assignments across OBoost locations.
          </p>
          {import.meta.env.DEV && (
            <p style={{ fontSize: '11px', color: dataSource === 'supabase' ? '#22c55e' : '#f59e0b', marginTop: '4px' }}>
              Source: {dataSource === 'supabase' ? 'Supabase ✓' : 'Mock fallback'}
            </p>
          )}
        </div>

        <div className="stat-cards">
          <StatCard label="Total Machines" value={total} subtext="Across all locations" />
          <StatCard label="Clean" value={clean} accent="green" subtext="Within schedule" />
          <StatCard label="Needs Cleaning" value={needsCleaning} accent="amber" subtext="Due within 7 days" />
          <StatCard label="Overdue" value={overdue} accent="red" subtext="Requires attention" />
        </div>

        {faults > 0 && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {faults} machine{faults > 1 ? 's' : ''} with active fault{faults > 1 ? 's' : ''} — see the Fault column below.
          </div>
        )}

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        <MachineTable
          machines={machines}
          employees={MOCK_EMPLOYEES}
          onMarkCleaned={markAsCleaned}
          currentUserRole={profile?.role}
          savingWorkingIds={savingWorkingIds}
          onMarkWorking={handleMarkWorking}
        />

        {displayRole === 'manager' && (
          <div className="employee-section">
            <EmployeeTable employees={MOCK_EMPLOYEES} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
