import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getEmployees, createEmployee, updateEmployee, uploadEmployeePhoto, PREVIEW_BLOCKED_MESSAGE, type EmployeeRecord } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import MobileItemCarousel, { type CarouselItem } from '../components/dashboard/MobileItemCarousel';
import { scrollIntoComfortableView } from '../lib/scrollIntoComfortableView';
import '../styles/dashboard.css';

const ROLE_LABEL: Record<string, string> = {
  manager: 'מנהל',
  employee: 'עובד',
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

const EMPTY_EDIT_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  hireDate: '',
  jobTitle: '',
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
  const [newEmployeePhoto, setNewEmployeePhoto] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFormRef = useRef<HTMLDivElement>(null);

  // Smooth-scroll the edit form into view as soon as it opens, so it's
  // never "opens too far down the page and easy to miss" on mobile.
  useEffect(() => {
    if (editingEmployeeId) {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingEmployeeId]);

  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const addEmployeeRef = useRef<HTMLDivElement>(null);
  const addEmployeeMounted = useRef(false);

  // Mobile-only: smooth-scroll the Add Employee section into view on every
  // open/close toggle — down to the form when it opens, back up to the
  // now-collapsed button when it closes (same ref either way).
  // scrollIntoComfortableView also keeps the fixed bottom .mobile-carousel
  // bar clear of the target. Skips the very first render so loading the
  // page doesn't itself trigger a scroll. Desktop is untouched — this
  // never runs above the 767px breakpoint.
  // Opening always top-aligns with extra clearance (align: 'top') instead
  // of the default "center if it fits" behavior, which was undershooting
  // — barely scrolling at all whenever the opened form happened to fit the
  // visible band already. The scroll is delayed until the
  // .collapsible__body reveal transition (grid-template-rows, 0.25s — see
  // dashboard.css) actually finishes: starting it immediately, while that
  // transition is still growing the page's height underneath the
  // in-flight smooth scroll, caused a visible second "jump" partway
  // through (the browser's scroll-anchoring compensating for the
  // concurrent layout shift). Waiting the ~250ms out first means nothing
  // is changing size while the scroll animates, so there's only ever one,
  // single scroll. Closing is completely untouched (still the plain,
  // un-delayed default call) since that scroll-back-up already worked
  // correctly.
  useEffect(() => {
    if (!addEmployeeMounted.current) {
      addEmployeeMounted.current = true;
      return;
    }
    const el = addEmployeeRef.current;
    if (!el || !window.matchMedia('(max-width: 767px)').matches) return;
    if (addEmployeeOpen) {
      const timer = setTimeout(() => {
        scrollIntoComfortableView(el, { align: 'top', topPadding: 32 });
      }, 260);
      return () => clearTimeout(timer);
    } else {
      scrollIntoComfortableView(el);
    }
  }, [addEmployeeOpen]);

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

  function openEdit(emp: EmployeeRecord) {
    setEditError(null);
    setEditingEmployeeId(emp.employee_id);
    setEditForm({
      firstName: emp.first_name,
      lastName: emp.last_name,
      phone: emp.phone_number,
      hireDate: emp.hire_date ?? '',
      jobTitle: emp.job_title,
    });
  }

  function closeEdit() {
    setEditingEmployeeId(null);
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingEmployeeId) return;
    if (isPreview) { setEditError(PREVIEW_BLOCKED_MESSAGE); return; }
    setEditError(null);
    setSavingEdit(true);
    const { error } = await updateEmployee(editingEmployeeId, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      phoneNumber: editForm.phone,
      jobTitle: editForm.jobTitle,
      hireDate: editForm.hireDate || null,
    });
    setSavingEdit(false);
    if (error) {
      setEditError(error);
    } else {
      closeEdit();
      refresh();
    }
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

    if (newEmployeePhoto && res.employeeId) {
      const { error: photoErr } = await uploadEmployeePhoto(res.employeeId, newEmployeePhoto);
      if (photoErr) setPhotoError(photoErr);
    }

    setSuccess(`${form.firstName} ${form.lastName} נוסף/ה בהצלחה.`);
    setForm(EMPTY_FORM);
    setNewEmployeePhoto(null);
    refresh();
  }

  return (
    <DashboardLayout title="עובדים" currentUser={FALLBACK_USER}>
      <div className="dashboard-page employees-page">
        <div className="page-header">
          <h2 className="page-header__title">עובדים</h2>
          <p className="page-header__subtitle">
            כל רשומות הצוות — מתוך טבלת העובדים.
          </p>
        </div>

        {photoError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {photoError}
          </div>
        )}

        <div className="employees-desktop-view">
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">כל העובדים</span>
              <span className="machine-section__count">{employees.length} עובדים</span>
            </div>

            {status === 'loading' ? (
              <p className="employee-empty">טוען עובדים…</p>
            ) : status === 'error' ? (
              <div className="alert-banner">
                <span className="alert-banner__dot" />
                לא ניתן היה לטעון את העובדים. אנא נסו שוב.
              </div>
            ) : employees.length === 0 ? (
              <p className="employee-empty">עדיין אין עובדים. הוסיפו את העובד הראשון למטה.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>תמונה</th>
                    <th>עובד</th>
                    <th>הרשאה</th>
                    <th>תפקיד</th>
                    <th>טלפון</th>
                    <th>תאריך קליטה</th>
                    {canViewManagerUI && <th>פעולות</th>}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const fullName = `${emp.first_name} ${emp.last_name}`.trim();
                    const initials = (emp.first_name[0] ?? '') + (emp.last_name[0] ?? '');
                    return (
                    <tr key={emp.employee_id}>
                      <td data-label="תמונה">
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt={fullName} className="employee-avatar" />
                        ) : (
                          <div className="employee-avatar employee-avatar--fallback">{initials.toUpperCase() || '—'}</div>
                        )}
                        {canViewManagerUI && (
                          <label className="employee-avatar-upload">
                            {uploadingId === emp.employee_id ? 'מעלה…' : 'עריכת תמונה'}
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
                      <td data-label="הרשאה">
                        <span className={`role-badge role-badge--${emp.role}`}>
                          {ROLE_LABEL[emp.role]}
                        </span>
                      </td>
                      <td data-label="תפקיד">
                        <span className="machine-model">{emp.job_title || '—'}</span>
                      </td>
                      <td data-label="טלפון">
                        <span className="machine-model">{emp.phone_number || '—'}</span>
                      </td>
                      <td data-label="תאריך קליטה">
                        <span className="machine-date">{emp.hire_date ?? '—'}</span>
                      </td>
                      {canViewManagerUI && (
                        <td data-label="פעולות">
                          <button className="btn-report-issue" onClick={() => openEdit(emp)}>
                            עריכה
                          </button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {status === 'loading' && (
          <p className="employee-empty employees-mobile-view">טוען עובדים…</p>
        )}

        {status === 'error' && (
          <div className="alert-banner employees-mobile-view">
            <span className="alert-banner__dot" />
            לא ניתן היה לטעון את העובדים. אנא נסו שוב.
          </div>
        )}

        {status === 'ready' && employees.length === 0 && (
          <p className="employee-empty employees-mobile-view">עדיין אין עובדים. הוסיפו את העובד הראשון למטה.</p>
        )}

        {status === 'ready' && employees.length > 0 && (() => {
          const selected = employees.find(e => e.employee_id === selectedEmployeeId) ?? employees[0];
          const fullName = `${selected.first_name} ${selected.last_name}`.trim();
          const initials = ((selected.first_name[0] ?? '') + (selected.last_name[0] ?? '')).toUpperCase() || '—';

          const carouselItems: CarouselItem[] = employees.map(emp => ({
            id: emp.employee_id,
            label: `${emp.first_name} ${emp.last_name}`.trim(),
            imageUrl: emp.photoUrl,
            fallback: (
              <span className="mobile-carousel__fallback-initials">
                {((emp.first_name[0] ?? '') + (emp.last_name[0] ?? '')).toUpperCase() || '—'}
              </span>
            ),
          }));

          return (
            <div className="employees-mobile-view">
              <div className="mobile-item-card">
                <div className="employee-mobile-card">
                  <div className="employee-mobile-card__photo">
                    {selected.photoUrl ? (
                      <img src={selected.photoUrl} alt={fullName} className="employee-avatar employee-mobile-card__avatar" />
                    ) : (
                      <div className="employee-avatar employee-avatar--fallback employee-mobile-card__avatar">{initials}</div>
                    )}
                    {canViewManagerUI && (
                      <label className="employee-avatar-upload">
                        {uploadingId === selected.employee_id ? 'מעלה…' : 'עריכת תמונה'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={uploadingId === selected.employee_id}
                          onChange={e => handlePhotoChange(selected.employee_id, e)}
                        />
                      </label>
                    )}
                  </div>
                  <div className="mobile-item-card__name">{fullName}</div>
                  <div className="machine-location employee-mobile-card__email">{selected.email}</div>
                  <div className="machine-detail-info employee-mobile-card__rows">
                    <div className="machine-detail-row">
                      <span className="machine-detail-label">הרשאה</span>
                      <span className={`role-badge role-badge--${selected.role}`}>{ROLE_LABEL[selected.role]}</span>
                    </div>
                    <div className="machine-detail-row">
                      <span className="machine-detail-label">תפקיד</span>
                      <span>{selected.job_title || '—'}</span>
                    </div>
                    <div className="machine-detail-row">
                      <span className="machine-detail-label">טלפון</span>
                      <span>{selected.phone_number || '—'}</span>
                    </div>
                    <div className="machine-detail-row">
                      <span className="machine-detail-label">תאריך קליטה</span>
                      <span>{selected.hire_date ?? '—'}</span>
                    </div>
                  </div>
                  {canViewManagerUI && (
                    <div className="table-actions machine-detail-actions">
                      <button className="btn-report-issue" onClick={() => openEdit(selected)}>
                        עריכה
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <MobileItemCarousel
                items={carouselItems}
                selectedId={selected.employee_id}
                onSelect={setSelectedEmployeeId}
                ariaLabel="בחירת עובד"
              />
            </div>
          );
        })()}

        {canViewManagerUI && editingEmployeeId && (
          <div className="employee-form mobile-edit-form" ref={editFormRef}>
            <div className="machine-section__header">
              <span className="machine-section__title">עריכת עובד</span>
            </div>
            <form className="employee-form__body" onSubmit={handleSaveEdit}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="edit-emp-first">שם פרטי</label>
                <input
                  id="edit-emp-first"
                  className="employee-form__input"
                  value={editForm.firstName}
                  onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="edit-emp-last">שם משפחה</label>
                <input
                  id="edit-emp-last"
                  className="employee-form__input"
                  value={editForm.lastName}
                  onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="edit-emp-phone">טלפון</label>
                <input
                  id="edit-emp-phone"
                  type="tel"
                  className="employee-form__input"
                  value={editForm.phone}
                  onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="edit-emp-hire">תאריך קליטה</label>
                <input
                  id="edit-emp-hire"
                  type="date"
                  className="employee-form__input"
                  value={editForm.hireDate}
                  onChange={e => setEditForm(prev => ({ ...prev, hireDate: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="edit-emp-title">תפקיד</label>
                <input
                  id="edit-emp-title"
                  className="employee-form__input"
                  value={editForm.jobTitle}
                  onChange={e => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="edit-emp-photo">תמונה</label>
                <input
                  id="edit-emp-photo"
                  type="file"
                  accept="image/*"
                  className="employee-form__input"
                  disabled={uploadingId === editingEmployeeId}
                  onChange={e => handlePhotoChange(editingEmployeeId, e)}
                />
                {uploadingId === editingEmployeeId && (
                  <span className="employee-form__note">מעלה תמונה…</span>
                )}
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={savingEdit}>
                  {savingEdit ? 'שומר…' : 'שמירת שינויים'}
                </button>
                <button type="button" className="btn-report-issue" onClick={closeEdit}>
                  ביטול
                </button>
                {editError && <span className="employee-form__error">{editError}</span>}
              </div>
            </form>
          </div>
        )}

        {canViewManagerUI && (
          <div
            className={`machine-section employee-form employees-add-section${addEmployeeOpen ? ' collapsible--open' : ''}`}
            ref={addEmployeeRef}
          >
            <button
              type="button"
              className="machine-section__header collapsible-header"
              onClick={() => setAddEmployeeOpen(o => !o)}
              aria-expanded={addEmployeeOpen}
            >
              <span className="machine-section__title">הוספת עובד</span>
              <span className="collapsible-header__right">
                <span className={`collapsible-chevron${addEmployeeOpen ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </span>
            </button>
            <div className={`collapsible__body${addEmployeeOpen ? ' collapsible__body--open' : ''}`}>
              <div className="collapsible__body-inner">
            <form className="employee-form__body" onSubmit={handleSubmit}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-first">שם פרטי</label>
                <input
                  id="emp-first"
                  className="employee-form__input"
                  value={form.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-last">שם משפחה</label>
                <input
                  id="emp-last"
                  className="employee-form__input"
                  value={form.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-email">אימייל</label>
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
                <label className="employee-form__label" htmlFor="emp-phone">טלפון</label>
                <input
                  id="emp-phone"
                  type="tel"
                  className="employee-form__input"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-hire">תאריך קליטה</label>
                <input
                  id="emp-hire"
                  type="date"
                  className="employee-form__input"
                  value={form.hireDate}
                  onChange={e => setField('hireDate', e.target.value)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-title">תפקיד</label>
                <input
                  id="emp-title"
                  className="employee-form__input"
                  value={form.jobTitle}
                  onChange={e => setField('jobTitle', e.target.value)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-pass">סיסמה זמנית</label>
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
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="emp-photo">תמונה (אופציונלי)</label>
                <input
                  id="emp-photo"
                  type="file"
                  accept="image/*"
                  className="employee-form__input"
                  onChange={e => setNewEmployeePhoto(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={submitting}>
                  {submitting ? 'מוסיף…' : 'הוספת עובד'}
                </button>
                <button
                  type="button"
                  className="btn-report-issue employees-add-cancel"
                  onClick={() => setAddEmployeeOpen(false)}
                >
                  ביטול
                </button>
                {success && <span className="employee-form__success">{success}</span>}
                {error && <span className="employee-form__error">{error}</span>}
              </div>
              <p className="employee-form__note">
                העובד החדש יקבל מייל אישור לפני שיוכל להתחבר למערכת.
              </p>
            </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
