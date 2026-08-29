import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import {
  getCleaningHistory,
  getMalfunctionHistory,
  getOrangeInventory,
  getSparePartTransactions,
  getTasks,
  REPORT_STATUS_LABEL,
  type CleaningHistoryRecord,
  type MalfunctionHistoryRecord,
  type InventoryTransactionRecord,
  type SparePartTransactionRecord,
  type TaskRecord,
} from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';

const TYPE_LABEL: Record<string, string> = {
  delivery: 'קבלת סחורה',
  withdrawal: 'משיכה',
  adjustment: 'התאמה',
};

const SEVERITY_LABEL: Record<string, string> = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };

export default function MyActivity() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [cleaning, setCleaning] = useState<CleaningHistoryRecord[]>([]);
  const [malfunctions, setMalfunctions] = useState<MalfunctionHistoryRecord[]>([]);
  const [orangeTxns, setOrangeTxns] = useState<InventoryTransactionRecord[]>([]);
  const [partTxns, setPartTxns] = useState<SparePartTransactionRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  const load = useCallback(async () => {
    setStatus('loading');
    const [cleaningRes, malfunctionRes, orangeRes, partRes, tasksRes] = await Promise.all([
      getCleaningHistory(true),
      getMalfunctionHistory(true),
      getOrangeInventory(),
      getSparePartTransactions(),
      getTasks(),
    ]);

    if (cleaningRes.error || malfunctionRes.error || orangeRes.error || partRes.error || tasksRes.error) {
      setStatus('error');
      return;
    }

    setCleaning(cleaningRes.records);
    setMalfunctions(malfunctionRes.records);
    setOrangeTxns(orangeRes.data?.transactions ?? []);
    setPartTxns(partRes.transactions);
    setTasks(tasksRes.tasks);
    setStatus('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout title="הפעילות שלי" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">הפעילות שלי</h2>
          <p className="page-header__subtitle">פעילות הניקיון, התקלות, המלאי והמשימות שלכם.</p>
        </div>

        {status === 'loading' && <p className="employee-empty">טוען את הפעילות שלכם…</p>}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            לא ניתן היה לטעון את הפעילות שלכם. אנא נסו שוב.
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">פעולות הניקיון שלי</span>
                <span className="machine-section__count">{cleaning.length} רשומות</span>
              </div>
              {cleaning.length === 0 ? (
                <p className="employee-empty">עדיין לא ניקיתם מכונות.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>מכונה</th>
                      <th>תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleaning.map(r => (
                      <tr key={r.id}>
                        <td>{r.machineName}</td>
                        <td>{new Date(r.cleanedAt).toLocaleString('he-IL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">דיווחי התקלות שלי</span>
                <span className="machine-section__count">{malfunctions.length} דיווחים</span>
              </div>
              {malfunctions.length === 0 ? (
                <p className="employee-empty">עדיין לא דיווחתם על תקלות.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>מכונה</th>
                      <th>תיאור</th>
                      <th>חומרה</th>
                      <th>סטטוס</th>
                      <th>תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {malfunctions.map(r => (
                      <tr key={r.id}>
                        <td>{r.machineName}</td>
                        <td>{r.description}</td>
                        <td>{SEVERITY_LABEL[r.severity] ?? r.severity}</td>
                        <td>{REPORT_STATUS_LABEL[r.status]}</td>
                        <td>{new Date(r.reportedAt).toLocaleString('he-IL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">משיכות קרטוני התפוזים שלי</span>
                <span className="machine-section__count">{orangeTxns.length} תנועות</span>
              </div>
              {orangeTxns.length === 0 ? (
                <p className="employee-empty">עדיין לא רשמתם משיכות קרטוני תפוזים.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>סוג</th>
                      <th>כמות</th>
                      <th>הערות</th>
                      <th>תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orangeTxns.map(t => (
                      <tr key={t.id}>
                        <td>{TYPE_LABEL[t.type]}</td>
                        <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                        <td>{t.notes || '—'}</td>
                        <td>{new Date(t.createdAt).toLocaleString('he-IL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">משיכות חלקי החילוף שלי</span>
                <span className="machine-section__count">{partTxns.length} תנועות</span>
              </div>
              {partTxns.length === 0 ? (
                <p className="employee-empty">עדיין לא רשמתם משיכות חלקי חילוף.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>חלק</th>
                      <th>סוג</th>
                      <th>כמות</th>
                      <th>הערות</th>
                      <th>תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partTxns.map(t => (
                      <tr key={t.id}>
                        <td>{t.itemName}</td>
                        <td>{TYPE_LABEL[t.type]}</td>
                        <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                        <td>{t.notes || '—'}</td>
                        <td>{new Date(t.createdAt).toLocaleString('he-IL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">המשימות שלי</span>
                <span className="machine-section__count">{tasks.length} משימות</span>
              </div>
              {tasks.length === 0 ? (
                <p className="employee-empty">עדיין לא הוקצו לכם משימות.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>כותרת</th>
                      <th>מכונה</th>
                      <th>יעד</th>
                      <th>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id}>
                        <td>{t.title}</td>
                        <td>{t.machineName ?? '—'}</td>
                        <td>{t.dueDate ?? '—'}</td>
                        <td>
                          <span className={`status-badge status-badge--${t.status === 'completed' ? 'clean' : 'maintenance'}`}>
                            <span className="status-badge__dot" />
                            {t.status === 'completed' ? 'הושלם' : 'ממתין'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
