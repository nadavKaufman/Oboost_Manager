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
  delivery: 'Delivery',
  withdrawal: 'Withdrawal',
  adjustment: 'Adjustment',
};

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
    <DashboardLayout title="My Activity" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">My Activity</h2>
          <p className="page-header__subtitle">Your cleaning, malfunction, inventory, and task activity.</p>
        </div>

        {status === 'loading' && <p className="employee-empty">Loading your activity…</p>}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load your activity. Please try again.
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">My Cleaning Actions</span>
                <span className="machine-section__count">{cleaning.length} records</span>
              </div>
              {cleaning.length === 0 ? (
                <p className="employee-empty">You haven't cleaned any machines yet.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleaning.map(r => (
                      <tr key={r.id}>
                        <td>{r.machineName}</td>
                        <td>{new Date(r.cleanedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">My Malfunction Reports</span>
                <span className="machine-section__count">{malfunctions.length} reports</span>
              </div>
              {malfunctions.length === 0 ? (
                <p className="employee-empty">You haven't reported any malfunctions yet.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Description</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {malfunctions.map(r => (
                      <tr key={r.id}>
                        <td>{r.machineName}</td>
                        <td>{r.description}</td>
                        <td>{r.severity}</td>
                        <td>{REPORT_STATUS_LABEL[r.status]}</td>
                        <td>{new Date(r.reportedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">My Orange Carton Withdrawals</span>
                <span className="machine-section__count">{orangeTxns.length} movements</span>
              </div>
              {orangeTxns.length === 0 ? (
                <p className="employee-empty">You haven't recorded any orange carton withdrawals yet.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Notes</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orangeTxns.map(t => (
                      <tr key={t.id}>
                        <td>{TYPE_LABEL[t.type]}</td>
                        <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                        <td>{t.notes || '—'}</td>
                        <td>{new Date(t.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">My Spare Parts Withdrawals</span>
                <span className="machine-section__count">{partTxns.length} movements</span>
              </div>
              {partTxns.length === 0 ? (
                <p className="employee-empty">You haven't recorded any spare part withdrawals yet.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Notes</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partTxns.map(t => (
                      <tr key={t.id}>
                        <td>{t.itemName}</td>
                        <td>{TYPE_LABEL[t.type]}</td>
                        <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                        <td>{t.notes || '—'}</td>
                        <td>{new Date(t.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">My Tasks</span>
                <span className="machine-section__count">{tasks.length} tasks</span>
              </div>
              {tasks.length === 0 ? (
                <p className="employee-empty">No tasks assigned yet.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Machine</th>
                      <th>Due</th>
                      <th>Status</th>
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
                            {t.status === 'completed' ? 'Completed' : 'Pending'}
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
