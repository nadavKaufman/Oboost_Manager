import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import MachineTable from '../components/dashboard/MachineTable';
import { type Machine, type Employee } from '../types/machine';
import { useAuth } from '../context/AuthContext';
import {
  getMachines,
  markMachineWorking,
  markMachineCleaned,
  getEmployees,
  createMachine,
  uploadMachineImage,
  type EmployeeRecord,
} from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = {
  name: '',
  role: 'employee' as const,
};

type MachinesStatus = 'loading' | 'error' | 'ready';

const EMPTY_MACHINE_FORM = {
  name: '',
  address: '',
  location: '',
  model: '',
  maintenanceNotes: '',
  isActive: true,
};

function mapEmployees(rows: EmployeeRecord[]): Employee[] {
  return rows.map(row => ({
    id: row.employee_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    role: row.role,
    assignedMachineIds: [],
    activeTaskCount: 0,
  }));
}

interface Props {
  title?: string;
  subtitle?: string;
}

export default function Machines({
  title = 'Machines',
  subtitle = 'Manage and monitor all OBoost machines.',
}: Props) {
  const { profile, session, loading } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesStatus, setMachinesStatus] = useState<MachinesStatus>('loading');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [savingWorkingIds, setSavingWorkingIds] = useState<Set<string>>(new Set());
  const [savingCleanIds, setSavingCleanIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = profile?.role === 'manager';
  const [machineForm, setMachineForm] = useState(EMPTY_MACHINE_FORM);
  const [machineImage, setMachineImage] = useState<File | null>(null);
  const [creatingMachine, setCreatingMachine] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdMachine, setCreatedMachine] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    setMachinesStatus('loading');
    getMachines().then(({ machines: rows, error }) => {
      if (error) {
        setMachinesStatus('error');
      } else {
        setMachines(rows);
        setMachinesStatus('ready');
      }
    });
    getEmployees().then(({ employees }) => {
      setEmployees(mapEmployees(employees));
    });
  }, [loading, session]);

  async function handleMarkCleaned(id: string) {
    setActionError(null);
    setSavingCleanIds(prev => new Set(prev).add(id));

    const { error } = await markMachineCleaned(id);

    if (error) {
      setActionError(error);
    } else {
      const { machines: rows, error: fetchError } = await getMachines();
      if (!fetchError) setMachines(rows);
    }

    setSavingCleanIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleMarkWorking(id: string) {
    setActionError(null);
    setSavingWorkingIds(prev => new Set(prev).add(id));

    const { error } = await markMachineWorking(id);

    if (error) {
      setActionError(error);
    } else {
      const { machines: rows, error: fetchError } = await getMachines();
      if (!fetchError) setMachines(rows);
    }

    setSavingWorkingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleCreateMachine(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreatedMachine(null);

    if (!machineForm.name.trim() || !machineForm.address.trim()) {
      setCreateError('Name and address are required.');
      return;
    }

    setCreatingMachine(true);
    const { id, error } = await createMachine({
      name: machineForm.name,
      address: machineForm.address,
      location: machineForm.location,
      model: machineForm.model,
      maintenanceNotes: machineForm.maintenanceNotes,
      isActive: machineForm.isActive,
    });

    if (error || !id) {
      setCreatingMachine(false);
      setCreateError(error ?? 'Could not create the machine. Please try again.');
      return;
    }

    if (machineImage) {
      const { error: imageError } = await uploadMachineImage(id, machineImage);
      if (imageError) setCreateError(imageError);
    }

    setCreatingMachine(false);
    setCreatedMachine({ id, name: machineForm.name });
    setMachineForm(EMPTY_MACHINE_FORM);
    setMachineImage(null);

    setMachinesStatus('loading');
    const { machines: rows, error: fetchError } = await getMachines();
    if (fetchError) {
      setMachinesStatus('error');
    } else {
      setMachines(rows);
      setMachinesStatus('ready');
    }
  }

  return (
    <DashboardLayout title={title} currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">{title}</h2>
          <p className="page-header__subtitle">{subtitle}</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        {machinesStatus === 'loading' && (
          <p className="employee-empty">Loading machines…</p>
        )}

        {machinesStatus === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load machines. Please try again.
          </div>
        )}

        {machinesStatus === 'ready' && machines.length === 0 && (
          <p className="employee-empty">No machines have been added yet.</p>
        )}

        {machinesStatus === 'ready' && machines.length > 0 && (
          <MachineTable
            machines={machines}
            employees={employees}
            onMarkCleaned={handleMarkCleaned}
            currentUserRole={profile?.role}
            savingWorkingIds={savingWorkingIds}
            onMarkWorking={handleMarkWorking}
            savingCleanIds={savingCleanIds}
          />
        )}

        {canManage && (
          <div className="employee-form">
            <div className="machine-section__header">
              <span className="machine-section__title">Add Machine</span>
            </div>
            <form className="employee-form__body" onSubmit={handleCreateMachine}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-name">Name</label>
                <input
                  id="mach-name"
                  className="employee-form__input"
                  value={machineForm.name}
                  onChange={e => setMachineForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-address">Address</label>
                <input
                  id="mach-address"
                  className="employee-form__input"
                  value={machineForm.address}
                  onChange={e => setMachineForm(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-location">Location</label>
                <input
                  id="mach-location"
                  className="employee-form__input"
                  value={machineForm.location}
                  onChange={e => setMachineForm(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-model">Model</label>
                <input
                  id="mach-model"
                  className="employee-form__input"
                  value={machineForm.model}
                  onChange={e => setMachineForm(prev => ({ ...prev, model: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-notes">Notes (optional)</label>
                <input
                  id="mach-notes"
                  className="employee-form__input"
                  value={machineForm.maintenanceNotes}
                  onChange={e => setMachineForm(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-image">Photo (optional)</label>
                <input
                  id="mach-image"
                  type="file"
                  accept="image/*"
                  className="employee-form__input"
                  onChange={e => setMachineImage(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-active">
                  <input
                    id="mach-active"
                    type="checkbox"
                    checked={machineForm.isActive}
                    onChange={e => setMachineForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  {' '}Active
                </label>
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={creatingMachine}>
                  {creatingMachine ? 'Adding…' : 'Add Machine'}
                </button>
                {createdMachine && (
                  <span className="employee-form__success">
                    {createdMachine.name} added. <Link to={`/machines/${createdMachine.id}`}>View details</Link>
                  </span>
                )}
                {createError && <span className="employee-form__error">{createError}</span>}
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
