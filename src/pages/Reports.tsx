import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import {
  getCleaningHistory,
  getMalfunctionHistory,
  getOrangeInventory,
  getSparePartTransactions,
  getTasks,
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
type ReportTab = 'cleaning' | 'malfunctions' | 'orange' | 'spareparts' | 'tasks';

const PAGE_SIZE = 20;

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'malfunctions', label: 'Malfunctions' },
  { id: 'orange', label: 'Orange Inventory' },
  { id: 'spareparts', label: 'Spare Parts' },
  { id: 'tasks', label: 'Tasks' },
];

const TYPE_LABEL: Record<string, string> = {
  delivery: 'Delivery',
  withdrawal: 'Withdrawal',
  adjustment: 'Adjustment',
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('cleaning');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [cleaning, setCleaning] = useState<CleaningHistoryRecord[]>([]);
  const [malfunctions, setMalfunctions] = useState<MalfunctionHistoryRecord[]>([]);
  const [orangeTxns, setOrangeTxns] = useState<InventoryTransactionRecord[]>([]);
  const [partTxns, setPartTxns] = useState<SparePartTransactionRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  const load = useCallback(async (tab: ReportTab, currentLimit: number) => {
    setStatus('loading');

    if (tab === 'cleaning') {
      const res = await getCleaningHistory(false, currentLimit);
      if (res.error) { setStatus('error'); return; }
      setCleaning(res.records);
    } else if (tab === 'malfunctions') {
      const res = await getMalfunctionHistory(false, currentLimit);
      if (res.error) { setStatus('error'); return; }
      setMalfunctions(res.records);
    } else if (tab === 'orange') {
      const res = await getOrangeInventory(currentLimit);
      if (res.error) { setStatus('error'); return; }
      setOrangeTxns(res.data?.transactions ?? []);
    } else if (tab === 'spareparts') {
      const res = await getSparePartTransactions(currentLimit);
      if (res.error) { setStatus('error'); return; }
      setPartTxns(res.transactions);
    } else {
      const res = await getTasks(currentLimit);
      if (res.error) { setStatus('error'); return; }
      setTasks(res.tasks);
    }

    setStatus('ready');
  }, []);

  useEffect(() => {
    load(activeTab, limit);
  }, [activeTab, limit, load]);

  function handleTabChange(tab: ReportTab) {
    setActiveTab(tab);
    setLimit(PAGE_SIZE);
  }

  function handleLoadMore() {
    setLimit(prev => prev + PAGE_SIZE);
  }

  const currentCount =
    activeTab === 'cleaning' ? cleaning.length :
    activeTab === 'malfunctions' ? malfunctions.length :
    activeTab === 'orange' ? orangeTxns.length :
    activeTab === 'spareparts' ? partTxns.length :
    tasks.length;

  const hasMore = status === 'ready' && currentCount >= limit;

  return (
    <DashboardLayout title="Reports" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">Reports</h2>
          <p className="page-header__subtitle">Company-wide operational history.</p>
        </div>

        <div className="report-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`report-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {status === 'loading' && <p className="employee-empty">Loading…</p>}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load this report. Please try again.
          </div>
        )}

        {status === 'ready' && activeTab === 'cleaning' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">Cleaning History</span>
              <span className="machine-section__count">{cleaning.length} shown</span>
            </div>
            {cleaning.length === 0 ? (
              <p className="employee-empty">No cleaning history yet.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Cleaned By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaning.map(r => (
                    <tr key={r.id}>
                      <td>{r.machineName}</td>
                      <td>{r.cleanedByName}</td>
                      <td>{new Date(r.cleanedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {status === 'ready' && activeTab === 'malfunctions' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">Malfunction Reports</span>
              <span className="machine-section__count">{malfunctions.length} shown</span>
            </div>
            {malfunctions.length === 0 ? (
              <p className="employee-empty">No malfunction reports yet.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Reported By</th>
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
                      <td>{r.reportedByName}</td>
                      <td>{r.description}</td>
                      <td>{r.severity}</td>
                      <td>{r.status}</td>
                      <td>{new Date(r.reportedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {status === 'ready' && activeTab === 'orange' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">Orange Carton Movements</span>
              <span className="machine-section__count">{orangeTxns.length} shown</span>
            </div>
            {orangeTxns.length === 0 ? (
              <p className="employee-empty">No orange carton movements yet.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Recorded By</th>
                    <th>Notes</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orangeTxns.map(t => (
                    <tr key={t.id}>
                      <td>{TYPE_LABEL[t.type]}</td>
                      <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                      <td>{t.recordedByName}</td>
                      <td>{t.notes || '—'}</td>
                      <td>{new Date(t.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {status === 'ready' && activeTab === 'spareparts' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">Spare Parts Movements</span>
              <span className="machine-section__count">{partTxns.length} shown</span>
            </div>
            {partTxns.length === 0 ? (
              <p className="employee-empty">No spare parts movements yet.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Recorded By</th>
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
                      <td>{t.recordedByName}</td>
                      <td>{t.notes || '—'}</td>
                      <td>{new Date(t.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {status === 'ready' && activeTab === 'tasks' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">Employee Tasks</span>
              <span className="machine-section__count">{tasks.length} shown</span>
            </div>
            {tasks.length === 0 ? (
              <p className="employee-empty">No tasks yet.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned To</th>
                    <th>Machine</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{t.assignedToName}</td>
                      <td>{t.machineName ?? '—'}</td>
                      <td>{t.dueDate ?? '—'}</td>
                      <td>
                        <span className={`status-badge status-badge--${t.status === 'completed' ? 'clean' : 'maintenance'}`}>
                          <span className="status-badge__dot" />
                          {t.status === 'completed' ? 'Completed' : 'Pending'}
                        </span>
                        {t.completionNotes && <div className="machine-location">Notes: {t.completionNotes}</div>}
                        {t.completionPhotoUrl && (
                          <a href={t.completionPhotoUrl} target="_blank" rel="noreferrer">
                            <img src={t.completionPhotoUrl} alt="Completion evidence" className="employee-avatar" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {hasMore && (
          <button className="btn-mark-clean report-load-more" onClick={handleLoadMore}>
            Load More
          </button>
        )}
      </div>
    </DashboardLayout>
  );
}
