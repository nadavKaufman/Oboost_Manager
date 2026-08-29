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
  clean: 'נקי',
  due_soon: 'דורש ניקוי',
  overdue: 'ניקוי דחוף',
};

const FAULT_LABEL: Record<string, string> = { ok: 'תקין', fault: 'תקלה', maintenance: 'בתחזוקה' };

const SEVERITY_LABEL: Record<string, string> = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };

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
      <DashboardLayout title="פרטי מכונה" currentUser={FALLBACK_USER}>
        <div className="dashboard-page">
          <p className="employee-empty">טוען מכונה…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (status === 'error' || !details) {
    return (
      <DashboardLayout title="פרטי מכונה" currentUser={FALLBACK_USER}>
        <div className="dashboard-page">
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            המכונה לא נמצאה, או שאין לכם גישה אליה.
          </div>
          <Link to={canViewManagerUI ? '/machines' : '/my-machines'} className="btn-mark-clean">
            → חזרה למכונות
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
          <p className="page-header__subtitle">{machine.location || 'לא צוין מיקום'}</p>
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
              <div className="machine-detail-image__placeholder">אין תמונה</div>
            )}
            {canViewManagerUI && (
              <label className="btn-mark-clean machine-detail-image__upload">
                {imageUploading ? 'מעלה…' : 'העלאת תמונה'}
                <input type="file" accept="image/*" hidden onChange={handleImageChange} disabled={imageUploading} />
              </label>
            )}
          </div>

          <div className="machine-detail-info">
            <div className="machine-detail-row">
              <span className="machine-detail-label">מיקום</span>
              <span>{machine.location || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">סטטוס מכונה</span>
              <span className={`status-badge status-badge--${machine.isActive ? 'clean' : 'overdue'}`}>
                <span className="status-badge__dot" />
                {machine.isActive ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">ניקיון</span>
              <span
                className={`status-badge status-badge--${cleanStatus}${cleanStatus === 'overdue' ? ' status-badge--cleaning-overdue' : ''}`}
              >
                {STATUS_LABEL[cleanStatus]}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">ניקוי אחרון</span>
              <span>{getCleaningElapsedText(daysSinceCleaned)}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">תקלה</span>
              <span className={`status-badge ${FAULT_STATUS_CLASS[machine.faultStatus]}`}>
                <span className="status-badge__dot" />
                {FAULT_LABEL[machine.faultStatus]}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">הערות תחזוקה</span>
              <span>{machine.maintenanceNotes || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">נוצר בתאריך</span>
              <span>{new Date(machine.createdAt).toLocaleDateString('he-IL')}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">עודכן בתאריך</span>
              <span>{new Date(machine.updatedAt).toLocaleDateString('he-IL')}</span>
            </div>
          </div>
        </div>

        <div className="table-actions machine-detail-actions">
          <button className="btn-mark-clean" disabled={savingClean} onClick={handleMarkCleaned}>
            {savingClean ? 'שומר…' : 'סמן כנוקה'}
          </button>
          <Link className="btn-report-issue" to={`/machines/${id}/report-malfunction`}>
            דיווח על תקלה
          </Link>
          {canViewManagerUI && machine.faultStatus === 'fault' && (
            <button className="btn-mark-working" disabled={savingWorking} onClick={handleMarkWorking}>
              {savingWorking ? 'שומר…' : 'סמן כתקין'}
            </button>
          )}
          {canViewManagerUI && (
            <button className="btn-report-issue" onClick={handleToggleActive}>
              {machine.isActive ? 'השבתת מכונה' : 'הפעלת מכונה'}
            </button>
          )}
          {canViewManagerUI && (
            <button className="btn-report-issue" onClick={() => setEditing(o => !o)}>
              {editing ? 'ביטול עריכה' : 'עריכת מכונה'}
            </button>
          )}
        </div>

        {canViewManagerUI && editing && (
          <div className="employee-form">
            <div className="machine-section__header">
              <span className="machine-section__title">עריכת מכונה</span>
            </div>
            <form className="employee-form__body" onSubmit={handleSaveEdit}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-name">שם</label>
                <input
                  id="m-name"
                  className="employee-form__input"
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-location">מיקום</label>
                <input
                  id="m-location"
                  className="employee-form__input"
                  value={editForm.location}
                  onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="m-notes">הערות תחזוקה</label>
                <input
                  id="m-notes"
                  className="employee-form__input"
                  value={editForm.maintenanceNotes}
                  onChange={e => setEditForm(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
                />
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={savingEdit}>
                  {savingEdit ? 'שומר…' : 'שמירת שינויים'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="machine-section">
          <div className="machine-section__header">
            <span className="machine-section__title">היסטוריית ניקיון</span>
          </div>
          {details.cleaningHistory.length === 0 ? (
            <p className="employee-empty">אין עדיין היסטוריית ניקיון.</p>
          ) : (
            <table className="machine-table">
              <thead>
                <tr>
                  <th>נוקה על ידי</th>
                  <th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {details.cleaningHistory.map(log => (
                  <tr key={log.id}>
                    <td>{log.cleanedByName}</td>
                    <td>{new Date(log.cleanedAt).toLocaleString('he-IL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="machine-section">
          <div className="machine-section__header">
            <span className="machine-section__title">היסטוריית תקלות</span>
            <span className="machine-section__count">{openReports.length} פתוחות</span>
          </div>
          {details.malfunctionHistory.length === 0 ? (
            <p className="employee-empty">אין עדיין דיווחי תקלות.</p>
          ) : (
            <table className="machine-table">
              <thead>
                <tr>
                  <th>דווח על ידי</th>
                  <th>תאריך</th>
                  <th>תיאור</th>
                  <th>חומרה</th>
                  <th>סטטוס</th>
                  {canViewManagerUI && <th>פעולות</th>}
                </tr>
              </thead>
              <tbody>
                {details.malfunctionHistory.map(report => (
                  <tr key={report.id}>
                    <td>{report.reportedByName}</td>
                    <td>{new Date(report.reportedAt).toLocaleString('he-IL')}</td>
                    <td>
                      {report.description}
                      {report.photoUrl && (
                        <div>
                          <a href={report.photoUrl} target="_blank" rel="noreferrer">צפייה בתמונה</a>
                        </div>
                      )}
                      {report.resolutionNotes && (
                        <div className="machine-location">פתרון: {report.resolutionNotes}</div>
                      )}
                    </td>
                    <td>{SEVERITY_LABEL[report.severity] ?? report.severity}</td>
                    <td>{REPORT_STATUS_LABEL[report.status]}</td>
                    {canViewManagerUI && (
                      <td>
                        <div className="table-actions">
                          {report.status === 'open' && (
                            <button className="btn-report-issue" onClick={() => handleMarkInProgress(report.id)}>
                              סמן כבטיפול
                            </button>
                          )}
                          {(report.status === 'open' || report.status === 'in_progress') && (
                            resolvingId === report.id ? (
                              <>
                                <input
                                  className="employee-form__input"
                                  placeholder="הערות פתרון"
                                  value={resolutionNotes}
                                  onChange={e => setResolutionNotes(e.target.value)}
                                />
                                <button
                                  className="btn-mark-working"
                                  disabled={savingResolve}
                                  onClick={() => handleResolve(report.id)}
                                >
                                  {savingResolve ? 'שומר…' : 'אישור פתרון'}
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn-mark-working"
                                onClick={() => { setResolvingId(report.id); setResolutionNotes(''); }}
                              >
                                פתרון
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
