import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
  getMachineDetails,
  updateMachine,
  assignEmployeeToMachine,
  unassignEmployeeFromMachine,
  uploadMachineImage,
  uploadMalfunctionPhoto,
  reportMachineMalfunction,
  markMaintenanceReportInProgress,
  resolveMaintenanceReport,
  markMachineCleaned,
  markMachineWorking,
  getEmployees,
  type MachineDetails as MachineDetailsData,
  type EmployeeRecord,
  type ReportSeverity,
} from '../lib/supabase';
import { getMachineStatus } from '../types/machine';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';

const STATUS_LABEL: Record<string, string> = {
  clean: 'Clean',
  due_soon: 'Cleaning Due Soon',
  overdue: 'Cleaning Overdue',
};

const FAULT_LABEL: Record<string, string> = { ok: 'OK', fault: 'Malfunction', maintenance: 'Maintenance' };

const FAULT_STATUS_CLASS: Record<string, string> = {
  ok: 'status-badge--clean',
  fault: 'status-badge--overdue',
  maintenance: 'status-badge--maintenance',
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const EMPTY_REPORT_FORM = { description: '', faultType: '', severity: 'low' as ReportSeverity };
const EMPTY_EDIT_FORM = { name: '', address: '', location: '', model: '', maintenanceNotes: '' };

export default function MachineDetails() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [details, setDetails] = useState<MachineDetailsData | null>(null);
  const [allEmployees, setAllEmployees] = useState<EmployeeRecord[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [savingClean, setSavingClean] = useState(false);
  const [savingWorking, setSavingWorking] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const [imageUploading, setImageUploading] = useState(false);

  const [assignUserId, setAssignUserId] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  const [reportForm, setReportForm] = useState(EMPTY_REPORT_FORM);
  const [reportPhoto, setReportPhoto] = useState<File | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setStatus('loading');
    const { details: data, error } = await getMachineDetails(id);
    if (error || !data) {
      setStatus('error');
      return;
    }
    setDetails(data);
    setEditForm({
      name: data.machine.name,
      address: data.machine.address,
      location: data.machine.location,
      model: data.machine.model,
      maintenanceNotes: data.machine.maintenanceNotes,
    });
    setStatus('ready');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isManager) {
      getEmployees().then(({ employees }) => setAllEmployees(employees));
    }
  }, [isManager]);

  async function handleMarkCleaned() {
    if (!id) return;
    setActionError(null);
    setSavingClean(true);
    const { error } = await markMachineCleaned(id);
    if (error) setActionError(error);
    else await load();
    setSavingClean(false);
  }

  async function handleMarkWorking() {
    if (!id) return;
    setActionError(null);
    setSavingWorking(true);
    const { error } = await markMachineWorking(id);
    if (error) setActionError(error);
    else await load();
    setSavingWorking(false);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActionError(null);
    setSavingEdit(true);
    const { error } = await updateMachine(id, editForm);
    setSavingEdit(false);
    if (error) {
      setActionError(error);
    } else {
      setEditing(false);
      await load();
    }
  }

  async function handleToggleActive() {
    if (!id || !details) return;
    setActionError(null);
    const { error } = await updateMachine(id, { isActive: !details.machine.isActive });
    if (error) setActionError(error);
    else await load();
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setActionError(null);
    setImageUploading(true);
    const { error } = await uploadMachineImage(id, file);
    setImageUploading(false);
    if (error) setActionError(error);
    else await load();
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!id || !assignUserId) return;
    setActionError(null);
    setSavingAssign(true);
    const { error } = await assignEmployeeToMachine(id, assignUserId);
    setSavingAssign(false);
    if (error) {
      setActionError(error);
    } else {
      setAssignUserId('');
      await load();
    }
  }

  async function handleUnassign(userId: string) {
    if (!id) return;
    setActionError(null);
    const { error } = await unassignEmployeeFromMachine(id, userId);
    if (error) setActionError(error);
    else await load();
  }

  async function handleReportSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActionError(null);
    setReportSuccess(null);
    setSubmittingReport(true);

    let photoUrl: string | null = null;
    if (reportPhoto) {
      const { url, error: uploadError } = await uploadMalfunctionPhoto(reportPhoto);
      if (uploadError) {
        setActionError(uploadError);
        setSubmittingReport(false);
        return;
      }
      photoUrl = url;
    }

    const { error } = await reportMachineMalfunction({
      machineId: id,
      description: reportForm.description,
      faultType: reportForm.faultType || 'other',
      severity: reportForm.severity,
      photoUrl,
    });

    setSubmittingReport(false);
    if (error) {
      setActionError(error);
    } else {
      setReportForm(EMPTY_REPORT_FORM);
      setReportPhoto(null);
      setReportSuccess('Malfunction reported.');
      await load();
    }
  }

  async function handleMarkInProgress(reportId: string) {
    setActionError(null);
    const { error } = await markMaintenanceReportInProgress(reportId);
    if (error) setActionError(error);
    else await load();
  }

  async function handleResolve(reportId: string) {
    setActionError(null);
    setSavingResolve(true);
    const { error } = await resolveMaintenanceReport(reportId, resolutionNotes);
    setSavingResolve(false);
    if (error) {
      setActionError(error);
    } else {
      setResolvingId(null);
      setResolutionNotes('');
      await load();
    }
  }

  if (status === 'loading') {
    return (
      <DashboardLayout title="Machine Details" currentUser={FALLBACK_USER}>
        <div className="dashboard-page">
          <p className="employee-empty">Loading machine…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (status === 'error' || !details) {
    return (
      <DashboardLayout title="Machine Details" currentUser={FALLBACK_USER}>
        <div className="dashboard-page">
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            This machine could not be found, or you do not have access to it.
          </div>
          <Link to={isManager ? '/machines' : '/my-machines'} className="btn-mark-clean">
            ← Back to Machines
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const { machine } = details;
  const { status: cleanStatus, daysSinceCleaned } = getMachineStatus(machine);
  const openReports = details.malfunctionHistory.filter(r => r.status === 'open' || r.status === 'in_progress');
  const assignedIds = new Set(details.assignedEmployees.map(e => e.id));
  const assignableEmployees = allEmployees.filter(e => !assignedIds.has(e.employee_id));

  return (
    <DashboardLayout title={machine.name} currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">{machine.name}</h2>
          <p className="page-header__subtitle">{machine.address || machine.location || 'No address on file'}</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        <div className="machine-detail-grid">
          <div className="machine-detail-image">
            {machine.imageUrl ? (
              <img src={machine.imageUrl} alt={machine.name} />
            ) : (
              <div className="machine-detail-image__placeholder">No image</div>
            )}
            {isManager && (
              <label className="btn-mark-clean machine-detail-image__upload">
                {imageUploading ? 'Uploading…' : 'Upload Image'}
                <input type="file" accept="image/*" hidden onChange={handleImageChange} disabled={imageUploading} />
              </label>
            )}
          </div>

          <div className="machine-detail-info">
            <div className="machine-detail-row">
              <span className="machine-detail-label">Location</span>
              <span>{machine.location || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Address</span>
              <span>{machine.address || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Model</span>
              <span>{machine.model || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Machine Status</span>
              <span className={`status-badge status-badge--${machine.isActive ? 'clean' : 'overdue'}`}>
                <span className="status-badge__dot" />
                {machine.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Cleaning</span>
              <span className={`status-badge status-badge--${cleanStatus}`}>
                <span className="status-badge__dot" />
                {STATUS_LABEL[cleanStatus]}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Last Cleaned</span>
              <span>{daysSinceCleaned === null ? 'Never cleaned' : `${daysSinceCleaned}d ago`}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Malfunction</span>
              <span className={`status-badge ${FAULT_STATUS_CLASS[machine.faultStatus]}`}>
                <span className="status-badge__dot" />
                {FAULT_LABEL[machine.faultStatus]}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Assigned To</span>
              <span>
                {details.assignedEmployees.length === 0
                  ? '—'
                  : details.assignedEmployees.map(e => e.name).join(', ')}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Maintenance Notes</span>
              <span>{machine.maintenanceNotes || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Created</span>
              <span>{new Date(machine.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Updated</span>
              <span>{new Date(machine.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="table-actions machine-detail-actions">
          <button className="btn-mark-clean" disabled={savingClean} onClick={handleMarkCleaned}>
            {savingClean ? 'Saving…' : 'Mark Cleaned'}
          </button>
          {isManager && machine.faultStatus === 'fault' && (
            <button className="btn-mark-working" disabled={savingWorking} onClick={handleMarkWorking}>
              {savingWorking ? 'Saving…' : 'Mark as Working'}
            </button>
          )}
          {isManager && (
            <button className="btn-report-issue" onClick={handleToggleActive}>
              {machine.isActive ? 'Deactivate Machine' : 'Activate Machine'}
            </button>
          )}
          {isManager && (
            <button className="btn-report-issue" onClick={() => setEditing(o => !o)}>
              {editing ? 'Cancel Edit' : 'Edit Machine'}
            </button>
          )}
        </div>

        {isManager && editing && (
          <div className="employee-form">
            <div className="machine-section__header">
              <span className="machine-section__title">Edit Machine</span>
            </div>
            <form className="employee-form__body" onSubmit={handleSaveEdit}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-name">Name</label>
                <input
                  id="m-name"
                  className="employee-form__input"
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-location">Location</label>
                <input
                  id="m-location"
                  className="employee-form__input"
                  value={editForm.location}
                  onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-address">Address</label>
                <input
                  id="m-address"
                  className="employee-form__input"
                  value={editForm.address}
                  onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-model">Model</label>
                <input
                  id="m-model"
                  className="employee-form__input"
                  value={editForm.model}
                  onChange={e => setEditForm(prev => ({ ...prev, model: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-notes">Maintenance Notes</label>
                <input
                  id="m-notes"
                  className="employee-form__input"
                  value={editForm.maintenanceNotes}
                  onChange={e => setEditForm(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
                />
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={savingEdit}>
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {isManager && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">Assigned Employees</span>
            </div>
            <table className="machine-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {details.assignedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={2}>
                      <span className="machine-model">No employees assigned.</span>
                    </td>
                  </tr>
                ) : (
                  details.assignedEmployees.map(emp => (
                    <tr key={emp.id}>
                      <td>{emp.name}</td>
                      <td>
                        <button className="btn-report-issue" onClick={() => handleUnassign(emp.id)}>
                          Unassign
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <form className="employee-form__body" onSubmit={handleAssign}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="assign-emp">Assign Employee</label>
                <select
                  id="assign-emp"
                  className="employee-form__select"
                  value={assignUserId}
                  onChange={e => setAssignUserId(e.target.value)}
                >
                  <option value="">Select an employee…</option>
                  {assignableEmployees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {`${emp.first_name} ${emp.last_name}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={!assignUserId || savingAssign}>
                  {savingAssign ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="machine-section">
          <div className="machine-section__header">
            <span className="machine-section__title">Cleaning History</span>
          </div>
          {details.cleaningHistory.length === 0 ? (
            <p className="employee-empty">No cleaning history yet.</p>
          ) : (
            <table className="machine-table">
              <thead>
                <tr>
                  <th>Cleaned By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {details.cleaningHistory.map(log => (
                  <tr key={log.id}>
                    <td>{log.cleanedByName}</td>
                    <td>{new Date(log.cleanedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="employee-form">
          <div className="machine-section__header">
            <span className="machine-section__title">Report Malfunction</span>
          </div>
          <form className="employee-form__body" onSubmit={handleReportSubmit}>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-desc">Description</label>
              <input
                id="r-desc"
                className="employee-form__input"
                value={reportForm.description}
                onChange={e => setReportForm(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-type">Malfunction Type (optional)</label>
              <input
                id="r-type"
                className="employee-form__input"
                value={reportForm.faultType}
                onChange={e => setReportForm(prev => ({ ...prev, faultType: e.target.value }))}
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-severity">Severity</label>
              <select
                id="r-severity"
                className="employee-form__select"
                value={reportForm.severity}
                onChange={e => setReportForm(prev => ({ ...prev, severity: e.target.value as ReportSeverity }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-photo">Photo (optional)</label>
              <input
                id="r-photo"
                type="file"
                accept="image/*"
                className="employee-form__input"
                onChange={e => setReportPhoto(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="employee-form__actions">
              <button type="submit" className="btn-add-employee" disabled={submittingReport}>
                {submittingReport ? 'Reporting…' : 'Report Malfunction'}
              </button>
              {reportSuccess && <span className="employee-form__success">{reportSuccess}</span>}
            </div>
          </form>
        </div>

        <div className="machine-section">
          <div className="machine-section__header">
            <span className="machine-section__title">Malfunction History</span>
            <span className="machine-section__count">{openReports.length} open</span>
          </div>
          {details.malfunctionHistory.length === 0 ? (
            <p className="employee-empty">No malfunction reports yet.</p>
          ) : (
            <table className="machine-table">
              <thead>
                <tr>
                  <th>Reported By</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Severity</th>
                  <th>Status</th>
                  {isManager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {details.malfunctionHistory.map(report => (
                  <tr key={report.id}>
                    <td>{report.reportedByName}</td>
                    <td>{new Date(report.reportedAt).toLocaleString()}</td>
                    <td>
                      {report.description}
                      {report.photoUrl && (
                        <div>
                          <a href={report.photoUrl} target="_blank" rel="noreferrer">View photo</a>
                        </div>
                      )}
                      {report.resolutionNotes && (
                        <div className="machine-location">Resolution: {report.resolutionNotes}</div>
                      )}
                    </td>
                    <td>{report.severity}</td>
                    <td>{REPORT_STATUS_LABEL[report.status]}</td>
                    {isManager && (
                      <td>
                        <div className="table-actions">
                          {report.status === 'open' && (
                            <button className="btn-report-issue" onClick={() => handleMarkInProgress(report.id)}>
                              Mark In Progress
                            </button>
                          )}
                          {(report.status === 'open' || report.status === 'in_progress') && (
                            resolvingId === report.id ? (
                              <>
                                <input
                                  className="employee-form__input"
                                  placeholder="Resolution notes"
                                  value={resolutionNotes}
                                  onChange={e => setResolutionNotes(e.target.value)}
                                />
                                <button
                                  className="btn-mark-working"
                                  disabled={savingResolve}
                                  onClick={() => handleResolve(report.id)}
                                >
                                  {savingResolve ? 'Saving…' : 'Confirm Resolve'}
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn-mark-working"
                                onClick={() => { setResolvingId(report.id); setResolutionNotes(''); }}
                              >
                                Resolve
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
