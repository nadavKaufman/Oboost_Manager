import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import {
  getCleaningHistory,
  getMalfunctionHistory,
  getOrangeInventory,
  getSparePartTransactions,
  REPORT_STATUS_LABEL,
  type CleaningHistoryRecord,
  type MalfunctionHistoryRecord,
  type InventoryTransactionRecord,
  type SparePartTransactionRecord,
} from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

type LoadStatus = 'loading' | 'error' | 'ready';
type ReportTab = 'cleaning' | 'malfunctions' | 'orange' | 'spareparts';

const PAGE_SIZE = 20;

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'cleaning', label: 'ניקיון' },
  { id: 'malfunctions', label: 'תקלות' },
  { id: 'orange', label: 'מלאי תפוזים' },
  { id: 'spareparts', label: 'חלקי חילוף' },
];

const TYPE_LABEL: Record<string, string> = {
  delivery: 'קבלת סחורה',
  withdrawal: 'משיכה',
  adjustment: 'התאמה',
};

const SEVERITY_LABEL: Record<string, string> = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('cleaning');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [cleaning, setCleaning] = useState<CleaningHistoryRecord[]>([]);
  const [malfunctions, setMalfunctions] = useState<MalfunctionHistoryRecord[]>([]);
  const [orangeTxns, setOrangeTxns] = useState<InventoryTransactionRecord[]>([]);
  const [partTxns, setPartTxns] = useState<SparePartTransactionRecord[]>([]);

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
    } else {
      const res = await getSparePartTransactions(currentLimit);
      if (res.error) { setStatus('error'); return; }
      setPartTxns(res.transactions);
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
    partTxns.length;

  const hasMore = status === 'ready' && currentCount >= limit;

  return (
    <DashboardLayout title="דוחות" currentUser={FALLBACK_USER}>
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">דוחות</h2>
          <p className="page-header__subtitle">היסטוריה תפעולית כלל-חברתית.</p>
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

        {status === 'loading' && <p className="employee-empty">טוען…</p>}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            לא ניתן היה לטעון את הדוח. אנא נסו שוב.
          </div>
        )}

        {status === 'ready' && activeTab === 'cleaning' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">היסטוריית ניקיון</span>
              <span className="machine-section__count">{cleaning.length} מוצגים</span>
            </div>
            {cleaning.length === 0 ? (
              <p className="employee-empty">אין עדיין היסטוריית ניקיון.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>מכונה</th>
                    <th>נוקה על ידי</th>
                    <th>תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaning.map(r => (
                    <tr key={r.id}>
                      <td>{r.machineName}</td>
                      <td>{r.cleanedByName}</td>
                      <td>{new Date(r.cleanedAt).toLocaleString('he-IL')}</td>
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
              <span className="machine-section__title">דוחות תקלות</span>
              <span className="machine-section__count">{malfunctions.length} מוצגים</span>
            </div>
            {malfunctions.length === 0 ? (
              <p className="employee-empty">אין עדיין דיווחי תקלות.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>מכונה</th>
                    <th>דווח על ידי</th>
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
                      <td>{r.reportedByName}</td>
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
        )}

        {status === 'ready' && activeTab === 'orange' && (
          <div className="machine-section">
            <div className="machine-section__header">
              <span className="machine-section__title">תנועות קרטוני תפוזים</span>
              <span className="machine-section__count">{orangeTxns.length} מוצגים</span>
            </div>
            {orangeTxns.length === 0 ? (
              <p className="employee-empty">אין עדיין תנועות קרטוני תפוזים.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>סוג</th>
                    <th>כמות</th>
                    <th>נרשם על ידי</th>
                    <th>הערות</th>
                    <th>תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {orangeTxns.map(t => (
                    <tr key={t.id}>
                      <td>{TYPE_LABEL[t.type]}</td>
                      <td>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                      <td>{t.recordedByName}</td>
                      <td>{t.notes || '—'}</td>
                      <td>{new Date(t.createdAt).toLocaleString('he-IL')}</td>
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
              <span className="machine-section__title">תנועות חלקי חילוף</span>
              <span className="machine-section__count">{partTxns.length} מוצגים</span>
            </div>
            {partTxns.length === 0 ? (
              <p className="employee-empty">אין עדיין תנועות חלקי חילוף.</p>
            ) : (
              <table className="machine-table">
                <thead>
                  <tr>
                    <th>חלק</th>
                    <th>סוג</th>
                    <th>כמות</th>
                    <th>נרשם על ידי</th>
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
                      <td>{t.recordedByName}</td>
                      <td>{t.notes || '—'}</td>
                      <td>{new Date(t.createdAt).toLocaleString('he-IL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {hasMore && (
          <button className="btn-mark-clean report-load-more" onClick={handleLoadMore}>
            טעינת עוד
          </button>
        )}
      </div>
    </DashboardLayout>
  );
}
