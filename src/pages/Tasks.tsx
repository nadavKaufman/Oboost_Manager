import { useState, useEffect, useCallback, type FormEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import CleaningTaskBadge from '../components/dashboard/CleaningTaskBadge';
import CollapsibleSection from '../components/dashboard/CollapsibleSection';
import {
  getTasks,
  createTask,
  getEmployees,
  getMachines,
  PREVIEW_BLOCKED_MESSAGE,
  type TaskRecord,
  type EmployeeRecord,
  type TaskType,
} from '../lib/supabase';
import { type Machine } from '../types/machine';
import { useAuth } from '../context/AuthContext';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';

const EMPTY_FORM = {
  title: '',
  description: '',
  assignedTo: '',
  machineId: '',
  dueDate: '',
  taskType: 'general' as TaskType,
};

export default function Tasks() {
  const { profile } = useAuth();
  const isPreview = profile?.role === 'preview';
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const { tasks: rows, error } = await getTasks();
    if (error) {
      setStatus('error');
    } else {
      setTasks(rows);
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    load();
    getEmployees().then(({ employees, error }) => {
      if (error) setActionError(error);
      else setEmployees(employees);
    });
    getMachines().then(({ machines: rows, error }) => {
      if (error) setActionError(error);
      // Inactive machines must never be selectable here, especially for
      // cleaning tasks — assigning work to a decommissioned machine doesn't
      // make sense. The main Machines list is unaffected by this filter.
      else setMachines(rows.filter(m => m.isActive));
    });
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    setSuccess(null);
    if (!form.title.trim() || !form.assignedTo) {
      setActionError('יש למלא כותרת ולבחור עובד מוקצה.');
      return;
    }
    if (form.taskType === 'cleaning' && !form.machineId) {
      setActionError('במשימת ניקיון יש לבחור מכונה.');
      return;
    }
    setSubmitting(true);
    const { error } = await createTask({
      title: form.title,
      description: form.description,
      assignedTo: form.assignedTo,
      machineId: form.machineId || null,
      dueDate: form.dueDate || null,
      taskType: form.taskType,
    });
    setSubmitting(false);
    if (error) {
      setActionError(error);
    } else {
      setForm(EMPTY_FORM);
      setSuccess('המשימה נוצרה.');
      await load();
    }
  }

  const visibleTasks = filterEmployee ? tasks.filter(t => t.assignedToId === filterEmployee) : tasks;

  return (
    <DashboardLayout title="משימות" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">משימות</h2>
          <p className="page-header__subtitle">הקצאה ומעקב אחר עבודת הצוות שלכם.</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        <div className="employee-form create-task-form">
          <div className="machine-section__header">
            <span className="machine-section__title">יצירת משימה</span>
          </div>
          <form className="employee-form__body" onSubmit={handleCreate}>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="task-title">כותרת</label>
              <input
                id="task-title"
                className="employee-form__input"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="task-desc">תיאור (אופציונלי)</label>
              <input
                id="task-desc"
                className="employee-form__input"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="task-emp">הקצאה לעובד</label>
              <select
                id="task-emp"
                className="employee-form__select"
                value={form.assignedTo}
                onChange={e => setForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                required
              >
                <option value="">בחרו עובד…</option>
                {employees.map(emp => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {`${emp.first_name} ${emp.last_name}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="task-type">סוג משימה</label>
              <select
                id="task-type"
                className="employee-form__select"
                value={form.taskType}
                onChange={e => setForm(prev => ({ ...prev, taskType: e.target.value as TaskType }))}
              >
                <option value="general">כללי</option>
                <option value="cleaning">ניקיון</option>
              </select>
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="task-machine">
                מכונה{form.taskType === 'cleaning' ? '' : ' (אופציונלי)'}
              </label>
              <select
                id="task-machine"
                className="employee-form__select"
                value={form.machineId}
                onChange={e => setForm(prev => ({ ...prev, machineId: e.target.value }))}
                required={form.taskType === 'cleaning'}
              >
                <option value="">{form.taskType === 'cleaning' ? 'בחרו מכונה…' : 'ללא מכונה'}</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="task-due">תאריך יעד (אופציונלי)</label>
              <input
                id="task-due"
                type="date"
                className="employee-form__input"
                value={form.dueDate}
                onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="employee-form__actions">
              <button type="submit" className="btn-add-employee" disabled={submitting}>
                {submitting ? 'יוצר…' : 'יצירת משימה'}
              </button>
              {success && <span className="employee-form__success">{success}</span>}
            </div>
          </form>
        </div>

        <CollapsibleSection title="כל המשימות" count={`${visibleTasks.length} משימות`}>
          <div className="employee-form__field" style={{ padding: '16px 24px 20px' }}>
            <label className="employee-form__label" htmlFor="task-filter">סינון לפי עובד</label>
            <select
              id="task-filter"
              className="employee-form__select"
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
            >
              <option value="">כל העובדים</option>
              {employees.map(emp => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {`${emp.first_name} ${emp.last_name}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {status === 'loading' && <p className="employee-empty">טוען משימות…</p>}
          {status === 'error' && <p className="employee-empty">לא ניתן היה לטעון את המשימות. אנא נסו שוב.</p>}
          {status === 'ready' && visibleTasks.length === 0 && <p className="employee-empty">אין עדיין משימות.</p>}

          {status === 'ready' && visibleTasks.length > 0 && (
            <table className="machine-table">
              <thead>
                <tr>
                  <th>כותרת</th>
                  <th>מוקצה ל</th>
                  <th>מכונה</th>
                  <th>יעד</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <div className="machine-name">{task.title}</div>
                      {task.taskType === 'cleaning' && <CleaningTaskBadge />}
                      {task.description && <div className="machine-location">{task.description}</div>}
                    </td>
                    <td>{task.assignedToName}</td>
                    <td>{task.machineName ?? '—'}</td>
                    <td>{task.dueDate ?? '—'}</td>
                    <td>
                      <span className={`status-badge status-badge--${task.status === 'completed' ? 'clean' : 'maintenance'}`}>
                        <span className="status-badge__dot" />
                        {task.status === 'completed' ? 'הושלם' : 'ממתין'}
                      </span>
                      {task.completionNotes && <div className="machine-location">הערות: {task.completionNotes}</div>}
                      {task.completionPhotoUrl && (
                        <a href={task.completionPhotoUrl} target="_blank" rel="noreferrer">
                          <img src={task.completionPhotoUrl} alt="תיעוד השלמה" className="employee-avatar" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CollapsibleSection>
      </div>
    </DashboardLayout>
  );
}
