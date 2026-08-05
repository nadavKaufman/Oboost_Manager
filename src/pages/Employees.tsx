import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getEmployees, createEmployee, uploadEmployeePhoto, PREVIEW_BLOCKED_MESSAGE, type EmployeeRecord } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import '../styles/dashboard.css';

const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  employee: 'Employee',
};

const FALLBACK_USER = {
  name: '',
  role: 'employee' as const,
};

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  hireDate: '',
  jobTitle: '',
  password: '',
};

type LoadStatus = 'loading' | 'error' | 'ready';

export default function Employees() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // canViewManagerUI: preview sees the same manager-style interface as
  // a real manager; every actual mutation is blocked separately below
  // via isPreview, regardless of what's visible.
  const canViewManagerUI = profile?.role === 'manager' || profile?.role === 'preview';
  const isPreview = profile?.role === 'preview';

  const load = () => {
    setStatus('loading');
    getEmployees({ directoryOnly: true }).then(({ employees: rows, error: fetchError }) => {
      if (fetchError) {
        setStatus('error');
      } else {
        setEmployees(rows);
        setStatus('ready');
      }
    });
  };

  useEffect(load, []);

  function refresh() {
    getEmployees({ directoryOnly: true }).then(({ employees: rows, error: fetchError }) => {
      if (!fetchError) setEmployees(rows);
    });
  }

  async function handlePhotoChange(employeeId: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (isPreview) { setPhotoError(PREVIEW_BLOCKED_MESSAGE); return; }
    setPhotoError(null);
    setUploadingId(employeeId);
    const { error } = await uploadEmployeePhoto(employeeId, file);
    setUploadingId(null);
    if (error) setPhotoError(error);
    else refresh();
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setError(PREVIEW_BLOCKED_MESSAGE); return; }
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const res = await createEmployee({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phoneNumber: form.phone,
      hireDate: form.hireDate || null,
      jobTitle: form.jobTitle,
      password: form.password,
    });

    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setSuccess(`${form.firstName} ${form.lastName} added successfully.`);
    setForm(EMPTY_FORM);
    refresh();
  }

  return (
    <DashboardLayout title="Employees" currentUser={FALLBACK_USER}>
      <div className="dashboard-page employees-page">
        <div className="page-header">
          <h2 className="page-header__title">Employees</h2>
          <p className="page-header__subtitle">
            All staff records — sourced from the employees table.
          </p>
        </div>

        {photoError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {photoError}
          </div>
        )}

        <div className="machine-section">
          <div className="machine-section__header">
            <span className="machine-section__title">All Employees</span>
            <span className="machine-section__count">{employees.length} employees</span>
          </div>

          {status === 'loading' ? (
            <p className="employee-empty">Loading employees…</p>
          ) : status === 'error' ? (
            <div className="alert-banner">
              <span className="alert-banner__dot" />
              Could not load employees. Please try again.
            </div>
          ) : employees.length === 0 ? (
            <p className="employee-empty">No employees yet. Add your first employee below.</p>
          ) : (
            <table className="machine-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Job Title</th>
                  <th>Phone</th>
                  <th>Hire Date</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const fullName = `${emp.first_name} ${emp.last_name}`.trim();
                  const initials = (emp.first_name[0] ?? '') + (emp.last_name[0] ?? '');
                  return (
                  <tr key={emp.employee_id}>
                    <td data-label="Photo">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={fullName} className="employee-avatar" />
                      ) : (
                        <div className="employee-avatar employee-avatar--fallback">{initials.toUpperCase() || '—'}</div>
                      )}
                      {canViewManagerUI && (
                        <label className="employee-avatar-upload">
                          {uploadingId === emp.employee_id ? 'Uploading…' : 'Edit photo'}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={uploadingId === emp.employee_id}
                            onChange={e => handlePhotoChange(emp.employee_id, e)}
                          />
                        </label>
                      )}
                    </td>
                    <td>
                      <div className="machine-name">
                        {fullName}
                      </div>
                      <div className="machine-location">{emp.email}</div>
                    </td>
                    <td data-label="Role">
                      <span className={`role-badge role-badge--${emp.role}`}>
                        {ROLE_LABEL[emp.role]}
                      </span>
                    </td>
                    <td data-label="Job Title">
                      <span className="machine-model">{emp.job_title || '—'}</span>
                    </td>
                    <td data-label="Phone">
                      <span className="machine-model">{emp.phone_number || '—'}</span>
                    </td>
                    <td data-label="Hire Date">
                      <span className="machine-date">{emp.hire_date ?? '—'}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {canViewManagerUI && (
          <div className="employee-form">
            <div className="machine-section__header">
              <span className="machine-section__title">Add Employee</span>
            </div>
            <form className="employee-form__body" onSubmit={handleSubmit}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-first">First name</label>
                <input
                  id="emp-first"
                  className="employee-form__input"
                  value={form.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-last">Last name</label>
                <input
                  id="emp-last"
                  className="employee-form__input"
                  value={form.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-email">Email</label>
                <input
                  id="emp-email"
                  type="email"
                  className="employee-form__input"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-phone">Phone</label>
                <input
                  id="emp-phone"
                  type="tel"
                  className="employee-form__input"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-hire">Hire date</label>
                <input
                  id="emp-hire"
                  type="date"
                  className="employee-form__input"
                  value={form.hireDate}
                  onChange={e => setField('hireDate', e.target.value)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-title">Job title</label>
                <input
                  id="emp-title"
                  className="employee-form__input"
                  value={form.jobTitle}
                  onChange={e => setField('jobTitle', e.target.value)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-pass">Temporary password</label>
                <input
                  id="emp-pass"
                  type="password"
                  className="employee-form__input"
                  value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={submitting}>
                  {submitting ? 'Adding…' : 'Add Employee'}
                </button>
                {success && <span className="employee-form__success">{success}</span>}
                {error && <span className="employee-form__error">{error}</span>}
              </div>
              <p className="employee-form__note">
                The new employee will receive a confirmation email before they can sign in.
              </p>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
