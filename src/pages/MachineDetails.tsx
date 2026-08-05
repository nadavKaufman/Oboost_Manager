import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
  getMachineDetails,
  updateMachine,
  uploadMachineImage,
  markMaintenanceReportInProgress,
  resolveMaintenanceReport,
  markMachineCleaned,
  markMachineWorking,
  REPORT_STATUS_LABEL,
  PREVIEW_BLOCKED_MESSAGE,
  type MachineDetails as MachineDetailsData,
} from '../lib/supabase';
import { getMachineStatus, getCleaningElapsedText } from '../types/machine';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';

const STATUS_LABEL: Record<string, string> = {
  clean: 'Clean',
  due_soon: 'Clean Due',
  overdue: 'Overdue',
};

const FAULT_LABEL: Record<string, string> = { ok: 'OK', fault: 'Malfunction', maintenance: 'Maintenance' };

const FAULT_STATUS_CLASS: Record<string, string> = {
  ok: 'status-badge--clean',
  fault: 'status-badge--overdue',
  maintenance: 'status-badge--maintenance',
};

const EMPTY_EDIT_FORM = { name: '', location: '', maintenanceNotes: '' };

export default function MachineDetails() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  // canViewManagerUI: preview sees the same manager-style interface as
  // a real manager; every actual mutation is blocked separately below
  // via isPreview, regardless of what's visible.
  const canViewManagerUI = profile?.role === 'manager' || profile?.role === 'preview';
  const isPreview = profile?.role === 'preview';

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [details, setDetails] = useState<MachineDetailsData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [savingClean, setSavingClean] = useState(false);
  const [savingWorking, setSavingWorking] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const [imageUploading, setImageUploading] = useState(false);

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
      location: data.machine.location,
      maintenanceNotes: data.machine.maintenanceNotes,
    });
    setStatus('ready');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkCleaned() {
    if (!id) return;
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    setSavingClean(true);
    const { error } = await markMachineCleaned(id);
    if (error) setActionError(error);
    else await load();
    setSavingClean(false);
  }

  async function handleMarkWorking() {
    if (!id) return;
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
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
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
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
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
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
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    setImageUploading(true);
    const { error } = await uploadMachineImage(id, file);
    setImageUploading(false);
    if (error) setActionError(error);
    else await load();
  }

  async function handleMarkInProgress(reportId: string) {
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    const { error } = await markMaintenanceReportInProgress(reportId);
    if (error) setActionError(error);
    else await load();
  }

  async function handleResolve(reportId: string) {
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
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
          <Link to={canViewManagerUI ? '/machines' : '/my-machines'} className="btn-mark-clean">
            ← Back to Machines
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const { machine } = details;
  const { status: cleanStatus, daysSinceCleaned } = getMachineStatus(machine);
  const openReports = details.malfunctionHistory.filter(r => r.status === 'open' || r.status === 'in_progress');

  return (
    <DashboardLayout title={machine.name} currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">{machine.name}</h2>
          <p className="page-header__subtitle">{machine.location || 'No location on file'}</p>
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
            {canViewManagerUI && (
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
              <span className="machine-detail-label">Machine Status</span>
              <span className={`status-badge status-badge--${machine.isActive ? 'clean' : 'overdue'}`}>
                <span className="status-badge__dot" />
                {machine.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Cleaning</span>
              <span
                className={`status-badge status-badge--${cleanStatus}${cleanStatus === 'overdue' ? ' status-badge--cleaning-overdue' : ''}`}
              >
                {STATUS_LABEL[cleanStatus]}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Last Cleaned</span>
              <span>{getCleaningElapsedText(daysSinceCleaned)}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">Malfunction</span>
              <span className={`status-badge ${FAULT_STATUS_CLASS[machine.faultStatus]}`}>
                <span className="status-badge__dot" />
                {FAULT_LABEL[machine.faultStatus]}
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
          <Link className="btn-report-issue" to={`/machines/${id}/report-malfunction`}>
            Report Malfunction
          </Link>
          {canViewManagerUI && machine.faultStatus === 'fault' && (
            <button className="btn-mark-working" disabled={savingWorking} onClick={handleMarkWorking}>
              {savingWorking ? 'Saving…' : 'Mark as Working'}
            </button>
          )}
          {canViewManagerUI && (
            <button className="btn-report-issue" onClick={handleToggleActive}>
              {machine.isActive ? 'Deactivate Machine' : 'Activate Machine'}
            </button>
          )}
          {canViewManagerUI && (
            <button className="btn-report-issue" onClick={() => setEditing(o => !o)}>
              {editing ? 'Cancel Edit' : 'Edit Machine'}
            </button>
          )}
        </div>

        {canViewManagerUI && editing && (
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
                  required
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
                  {canViewManagerUI && <th>Actions</th>}
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
                    {canViewManagerUI && (
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
