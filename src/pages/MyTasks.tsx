import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getTasks, completeTask, uploadTaskCompletionPhoto, type TaskRecord } from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';

export default function MyTasks() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

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
  }, [load]);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    setPhoto(e.target.files?.[0] ?? null);
  }

  async function handleComplete(taskId: string) {
    setActionError(null);
    setSaving(true);

    let photoUrl: string | null = null;
    if (photo) {
      const { url, error: uploadError } = await uploadTaskCompletionPhoto(photo);
      if (uploadError) {
        setSaving(false);
        setActionError(uploadError);
        return;
      }
      photoUrl = url;
    }

    const { error } = await completeTask(taskId, notes, photoUrl);
    setSaving(false);
    if (error) {
      setActionError(error);
    } else {
      setCompletingId(null);
      setNotes('');
      setPhoto(null);
      await load();
    }
  }

  return (
    <DashboardLayout title="My Tasks" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">My Tasks</h2>
          <p className="page-header__subtitle">Work assigned to you.</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        {status === 'loading' && <p className="employee-empty">Loading tasks…</p>}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load tasks. Please try again.
          </div>
        )}

        {status === 'ready' && tasks.length === 0 && <p className="employee-empty">No tasks assigned yet.</p>}

        {status === 'ready' && tasks.length > 0 && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">My Tasks</span>
              <span className="machine-section__count">{tasks.length} tasks</span>
            </div>
            <table className="machine-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Machine</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <div className="machine-name">{task.title}</div>
                      {task.description && <div className="machine-location">{task.description}</div>}
                    </td>
                    <td>{task.machineName ?? '—'}</td>
                    <td>{task.dueDate ?? '—'}</td>
                    <td>
                      <span className={`status-badge status-badge--${task.status === 'completed' ? 'clean' : 'maintenance'}`}>
                        <span className="status-badge__dot" />
                        {task.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                      {task.completionNotes && <div className="machine-location">Notes: {task.completionNotes}</div>}
                      {task.completionPhotoUrl && (
                        <a href={task.completionPhotoUrl} target="_blank" rel="noreferrer">
                          <img src={task.completionPhotoUrl} alt="Completion evidence" className="employee-avatar" />
                        </a>
                      )}
                    </td>
                    <td>
                      {task.status === 'pending' && (
                        completingId === task.id ? (
                          <div className="table-actions">
                            <input
                              className="employee-form__input"
                              placeholder="Completion notes (optional)"
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                            />
                            <input
                              type="file"
                              accept="image/*"
                              className="employee-form__input"
                              onChange={handlePhotoChange}
                            />
                            <button className="btn-mark-clean" disabled={saving} onClick={() => handleComplete(task.id)}>
                              {saving ? 'Saving…' : 'Confirm'}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-mark-clean"
                            onClick={() => { setCompletingId(task.id); setNotes(''); setPhoto(null); }}
                          >
                            Mark Completed
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
