import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
  getMachineDetails,
  uploadMalfunctionPhoto,
  reportMachineMalfunction,
  PREVIEW_BLOCKED_MESSAGE,
  type ReportSeverity,
} from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';

const EMPTY_FORM = { description: '', faultType: '', severity: 'low' as ReportSeverity };

export default function ReportMalfunction() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isPreview = profile?.role === 'preview';

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [machineName, setMachineName] = useState('');
  const [machineLocation, setMachineLocation] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setStatus('loading');
    const { details, error: fetchError } = await getMachineDetails(id);
    if (fetchError || !details) {
      setStatus('error');
      return;
    }
    setMachineName(details.machine.name);
    setMachineLocation(details.machine.location);
    setStatus('ready');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (isPreview) { setError(PREVIEW_BLOCKED_MESSAGE); return; }
    setError(null);
    setSubmitting(true);

    let photoUrl: string | null = null;
    if (photo) {
      const { url, error: uploadError } = await uploadMalfunctionPhoto(photo);
      if (uploadError) {
        setSubmitting(false);
        setError(uploadError);
        return;
      }
      photoUrl = url;
    }

    const { error: reportError } = await reportMachineMalfunction({
      machineId: id,
      description: form.description,
      faultType: form.faultType || 'other',
      severity: form.severity,
      photoUrl,
    });

    setSubmitting(false);
    if (reportError) {
      setError(reportError);
    } else {
      navigate(`/machines/${id}`);
    }
  }

  if (status === 'loading') {
    return (
      <DashboardLayout title="דיווח על תקלה" currentUser={FALLBACK_USER}>
        <div className="dashboard-page">
          <p className="employee-empty">טוען מכונה…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (status === 'error') {
    return (
      <DashboardLayout title="דיווח על תקלה" currentUser={FALLBACK_USER}>
        <div className="dashboard-page">
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            המכונה לא נמצאה, או שאין לכם גישה אליה.
          </div>
          <Link to="/machines" className="btn-mark-clean">→ חזרה למכונות</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="דיווח על תקלה" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">דיווח על תקלה</h2>
          <p className="page-header__subtitle">
            {machineName}{machineLocation ? ` — ${machineLocation}` : ''}
          </p>
        </div>

        {error && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {error}
          </div>
        )}

        <div className="employee-form">
          <form className="employee-form__body" onSubmit={handleSubmit}>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-desc">תיאור</label>
              <input
                id="r-desc"
                className="employee-form__input"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-type">סוג התקלה (אופציונלי)</label>
              <input
                id="r-type"
                className="employee-form__input"
                value={form.faultType}
                onChange={e => setForm(prev => ({ ...prev, faultType: e.target.value }))}
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-severity">חומרה</label>
              <select
                id="r-severity"
                className="employee-form__select"
                value={form.severity}
                onChange={e => setForm(prev => ({ ...prev, severity: e.target.value as ReportSeverity }))}
              >
                <option value="low">נמוכה</option>
                <option value="medium">בינונית</option>
                <option value="high">גבוהה</option>
                <option value="critical">קריטית</option>
              </select>
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="r-photo">תמונה (אופציונלי)</label>
              <input
                id="r-photo"
                type="file"
                accept="image/*"
                className="employee-form__input"
                onChange={e => {
                  if (isPreview) { e.target.value = ''; setError(PREVIEW_BLOCKED_MESSAGE); return; }
                  setPhoto(e.target.files?.[0] ?? null);
                }}
              />
            </div>
            <div className="employee-form__actions">
              <button type="submit" className="btn-add-employee" disabled={submitting}>
                {submitting ? 'שולח…' : 'שליחת דיווח'}
              </button>
              <Link to={`/machines/${id}`} className="btn-report-issue">ביטול</Link>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
