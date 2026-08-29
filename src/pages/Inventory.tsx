import { useState, useEffect, useCallback, type FormEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import { useAuth } from '../context/AuthContext';
import {
  getOrangeInventory,
  recordOrangeDelivery,
  recordOrangeWithdrawal,
  getSpareParts,
  createSparePart,
  updateSparePart,
  recordSparePartDelivery,
  recordSparePartWithdrawal,
  PREVIEW_BLOCKED_MESSAGE,
  type OrangeInventoryData,
  type SparePartRecord,
} from '../lib/supabase';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = { name: '', role: 'employee' as const };

// Unit of measure is intentionally not shown/edited anywhere in the UI
// (manager request — it doesn't add useful information here). The
// existing createSparePart/updateSparePart functions still take a `unit`
// field, so an empty string is passed through — createSparePart already
// falls back to a default internally ('unit') when it's empty, and
// updateSparePart is always called with the part's own existing value
// (never blanked out) so editing a part's name never silently changes
// its stored unit.
const EMPTY_PART_FORM = { name: '', description: '' };

type LoadStatus = 'loading' | 'error' | 'ready';
type InventoryTab = 'oranges' | 'spareparts';

const TABS: { id: InventoryTab; label: string }[] = [
  { id: 'oranges', label: 'תפוזים' },
  { id: 'spareparts', label: 'חלקי חילוף' },
];

export default function Inventory() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<InventoryTab>('oranges');
  // canViewManagerUI: preview sees the same manager-style interface as
  // a real manager; every actual mutation is blocked separately below
  // via isPreview, regardless of what's visible.
  const canViewManagerUI = profile?.role === 'manager' || profile?.role === 'preview';
  const isPreview = profile?.role === 'preview';

  const [actionError, setActionError] = useState<string | null>(null);

  // Mobile-only: each action form starts collapsed, tapping its heading
  // toggles it. Has no visual effect on desktop, where the form is always
  // shown regardless of this state — see .inventory-form-block in
  // dashboard.css.
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [withdrawFormOpen, setWithdrawFormOpen] = useState(false);
  const [partCreateFormOpen, setPartCreateFormOpen] = useState(false);
  const [partDeliveryFormOpen, setPartDeliveryFormOpen] = useState(false);
  const [partWithdrawFormOpen, setPartWithdrawFormOpen] = useState(false);

  // ── Orange cartons ──
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<OrangeInventoryData | null>(null);

  const [deliveryQty, setDeliveryQty] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [savingDelivery, setSavingDelivery] = useState(false);

  const [withdrawQty, setWithdrawQty] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [savingWithdraw, setSavingWithdraw] = useState(false);

  // ── Spare parts ──
  const [partsStatus, setPartsStatus] = useState<LoadStatus>('loading');
  const [parts, setParts] = useState<SparePartRecord[]>([]);

  const [partForm, setPartForm] = useState(EMPTY_PART_FORM);
  const [savingPart, setSavingPart] = useState(false);

  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editPartForm, setEditPartForm] = useState(EMPTY_PART_FORM);
  const [savingEditPart, setSavingEditPart] = useState(false);
  const [editPartError, setEditPartError] = useState<string | null>(null);

  const [partDeliveryItem, setPartDeliveryItem] = useState('');
  const [partDeliveryQty, setPartDeliveryQty] = useState('');
  const [partDeliveryNotes, setPartDeliveryNotes] = useState('');
  const [savingPartDelivery, setSavingPartDelivery] = useState(false);

  const [partWithdrawItem, setPartWithdrawItem] = useState('');
  const [partWithdrawQty, setPartWithdrawQty] = useState('');
  const [partWithdrawNotes, setPartWithdrawNotes] = useState('');
  const [savingPartWithdraw, setSavingPartWithdraw] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    const { data: result, error } = await getOrangeInventory();
    if (error || !result) {
      setStatus('error');
    } else {
      setData(result);
      setStatus('ready');
    }
  }, []);

  const loadParts = useCallback(async () => {
    setPartsStatus('loading');
    const { parts: partRows, error } = await getSpareParts();
    if (error) {
      setPartsStatus('error');
    } else {
      setParts(partRows);
      setPartsStatus('ready');
    }
  }, []);

  useEffect(() => {
    load();
    loadParts();
  }, [load, loadParts]);

  async function handleDelivery(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    const qty = Number(deliveryQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('יש להזין מספר שלם גדול מאפס.');
      return;
    }
    setSavingDelivery(true);
    const { error } = await recordOrangeDelivery(qty, deliveryNotes);
    setSavingDelivery(false);
    if (error) {
      setActionError(error);
    } else {
      setDeliveryQty('');
      setDeliveryNotes('');
      await load();
    }
  }

  async function handleWithdraw(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    const qty = Number(withdrawQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('יש להזין מספר שלם גדול מאפס.');
      return;
    }
    setSavingWithdraw(true);
    const { error } = await recordOrangeWithdrawal(qty, withdrawNotes);
    setSavingWithdraw(false);
    if (error) {
      setActionError(error);
    } else {
      setWithdrawQty('');
      setWithdrawNotes('');
      await load();
    }
  }

  async function handleCreatePart(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    if (!partForm.name.trim()) {
      setActionError('יש למלא שם עבור חלק החילוף.');
      return;
    }
    setSavingPart(true);
    const { error } = await createSparePart({ ...partForm, unit: '' });
    setSavingPart(false);
    if (error) {
      setActionError(error);
    } else {
      setPartForm(EMPTY_PART_FORM);
      await loadParts();
    }
  }

  function openEditPart(part: SparePartRecord) {
    setEditPartError(null);
    setEditPartForm({ name: part.name, description: part.description });
    setEditingPartId(part.id);
  }

  function closeEditPart() {
    setEditingPartId(null);
    setEditPartError(null);
  }

  async function handleSaveEditPart(e: FormEvent) {
    e.preventDefault();
    if (!editingPartId) return;
    if (isPreview) { setEditPartError(PREVIEW_BLOCKED_MESSAGE); return; }
    if (!editPartForm.name.trim()) {
      setEditPartError('יש למלא שם עבור חלק החילוף.');
      return;
    }
    setEditPartError(null);
    setSavingEditPart(true);
    // Unit isn't editable here — always pass the part's own existing
    // value through unchanged, never blank it out.
    const existingUnit = parts.find(p => p.id === editingPartId)?.unit ?? '';
    const { error } = await updateSparePart(editingPartId, { ...editPartForm, unit: existingUnit });
    setSavingEditPart(false);
    if (error) {
      setEditPartError(error);
    } else {
      closeEditPart();
      await loadParts();
    }
  }

  async function handlePartDelivery(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    const qty = Number(partDeliveryQty);
    if (!partDeliveryItem) {
      setActionError('יש לבחור חלק חילוף.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('יש להזין מספר שלם גדול מאפס.');
      return;
    }
    setSavingPartDelivery(true);
    const { error } = await recordSparePartDelivery(partDeliveryItem, qty, partDeliveryNotes);
    setSavingPartDelivery(false);
    if (error) {
      setActionError(error);
    } else {
      setPartDeliveryQty('');
      setPartDeliveryNotes('');
      await loadParts();
    }
  }

  async function handlePartWithdraw(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    const qty = Number(partWithdrawQty);
    if (!partWithdrawItem) {
      setActionError('יש לבחור חלק חילוף.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('יש להזין מספר שלם גדול מאפס.');
      return;
    }
    setSavingPartWithdraw(true);
    const { error } = await recordSparePartWithdrawal(partWithdrawItem, qty, partWithdrawNotes);
    setSavingPartWithdraw(false);
    if (error) {
      setActionError(error);
    } else {
      setPartWithdrawQty('');
      setPartWithdrawNotes('');
      await loadParts();
    }
  }

  const activeParts = parts.filter(p => p.isActive);
  const visibleParts = canViewManagerUI ? parts : activeParts;

  return (
    <DashboardLayout title="מלאי" currentUser={FALLBACK_USER}>
      <div className="dashboard-page inventory-page">
        <div className="page-header">
          <h2 className="page-header__title">מלאי</h2>
          <p className="page-header__subtitle">קרטוני תפוזים וחלקי חילוף.</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        <div className="report-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`report-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════ תפוזים ══════════════ */}
        {activeTab === 'oranges' && (
        <div className="machine-section inventory-section">
          <div className="machine-section__header">
            <span className="machine-section__title">תפוזים</span>
          </div>
          <div className="inventory-section__body">
            {status === 'loading' && <p className="employee-empty">טוען מלאי…</p>}

            {status === 'error' && (
              <div className="alert-banner">
                <span className="alert-banner__dot" />
                לא ניתן היה לטעון את המלאי. אנא נסו שוב.
              </div>
            )}

            {status === 'ready' && data && (
              <>
                <div className="stat-cards stat-cards--single">
                  <StatCard
                    label="מלאי נוכחי"
                    value={data.currentStock}
                    accent="orange"
                    subtext="קרטוני תפוזים"
                    className="stat-card--mobile-only"
                  />
                </div>

                <div className="inventory-orange-summary">
                  <img src="/icons/orange.png" alt="" className="inventory-orange-summary__icon" />
                  <span className="inventory-orange-summary__label">מלאי תפוזים נוכחי</span>
                  <span className="inventory-orange-summary__value">
                    {data.currentStock} <span className="inventory-orange-summary__unit">קרטונים</span>
                  </span>
                </div>

                <div className="inventory-forms-row">
                  {canViewManagerUI && (
                    <div className={`inventory-form-block${deliveryFormOpen ? ' inventory-form-block--open' : ''}`}>
                      <button
                        type="button"
                        className="machine-section__title inventory-form-block__toggle"
                        onClick={() => setDeliveryFormOpen(o => !o)}
                        aria-expanded={deliveryFormOpen}
                      >
                        הוספת קרטונים
                        <span className={`inventory-form-block__chevron collapsible-chevron${deliveryFormOpen ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">▾</span>
                      </button>
                      <form className="employee-form__body" onSubmit={handleDelivery}>
                        <div className="employee-form__field">
                          <label className="employee-form__label" htmlFor="delivery-qty">כמות שהתקבלה</label>
                          <input
                            id="delivery-qty"
                            type="number"
                            min={1}
                            className="employee-form__input"
                            value={deliveryQty}
                            onChange={e => setDeliveryQty(e.target.value)}
                            required
                          />
                        </div>
                        <div className="employee-form__field">
                          <label className="employee-form__label" htmlFor="delivery-notes">הערות (אופציונלי)</label>
                          <input
                            id="delivery-notes"
                            className="employee-form__input"
                            value={deliveryNotes}
                            onChange={e => setDeliveryNotes(e.target.value)}
                          />
                        </div>
                        <div className="employee-form__actions">
                          <button type="submit" className="btn-add-employee" disabled={savingDelivery}>
                            {savingDelivery ? 'שומר…' : 'רישום קבלה'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className={`inventory-form-block${withdrawFormOpen ? ' inventory-form-block--open' : ''}`}>
                    <button
                      type="button"
                      className="machine-section__title inventory-form-block__toggle"
                      onClick={() => setWithdrawFormOpen(o => !o)}
                      aria-expanded={withdrawFormOpen}
                    >
                      משיכת קרטונים
                      <span className={`inventory-form-block__chevron collapsible-chevron${withdrawFormOpen ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">▾</span>
                    </button>
                    <form className="employee-form__body" onSubmit={handleWithdraw}>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="withdraw-qty">כמות שנלקחה</label>
                        <input
                          id="withdraw-qty"
                          type="number"
                          min={1}
                          className="employee-form__input"
                          value={withdrawQty}
                          onChange={e => setWithdrawQty(e.target.value)}
                          required
                        />
                      </div>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="withdraw-notes">הערות (אופציונלי)</label>
                        <input
                          id="withdraw-notes"
                          className="employee-form__input"
                          value={withdrawNotes}
                          onChange={e => setWithdrawNotes(e.target.value)}
                        />
                      </div>
                      <div className="employee-form__actions">
                        <button type="submit" className="btn-add-employee" disabled={savingWithdraw}>
                          {savingWithdraw ? 'שומר…' : 'רישום משיכה'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* ══════════════ חלקי חילוף ══════════════ */}
        {activeTab === 'spareparts' && (
        <>
        <div className="machine-section inventory-section">
          <div className="machine-section__header">
            <span className="machine-section__title">חלקי חילוף</span>
          </div>
          <div className="inventory-section__body">
            {partsStatus === 'loading' && <p className="employee-empty">טוען חלקי חילוף…</p>}

            {partsStatus === 'error' && (
              <div className="alert-banner">
                <span className="alert-banner__dot" />
                לא ניתן היה לטעון את חלקי החילוף. אנא נסו שוב.
              </div>
            )}

            {partsStatus === 'ready' && (
              <>
                <div className="inventory-forms-row">
                  {canViewManagerUI && (
                    <div className={`inventory-form-block${partDeliveryFormOpen ? ' inventory-form-block--open' : ''}`}>
                      <button
                        type="button"
                        className="machine-section__title inventory-form-block__toggle"
                        onClick={() => setPartDeliveryFormOpen(o => !o)}
                        aria-expanded={partDeliveryFormOpen}
                      >
                        הוספת חלקי חילוף
                        <span className={`inventory-form-block__chevron collapsible-chevron${partDeliveryFormOpen ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">▾</span>
                      </button>
                      <form className="employee-form__body" onSubmit={handlePartDelivery}>
                        <div className="employee-form__field">
                          <label className="employee-form__label" htmlFor="pd-item">חלק חילוף</label>
                          <select
                            id="pd-item"
                            className="employee-form__select"
                            value={partDeliveryItem}
                            onChange={e => setPartDeliveryItem(e.target.value)}
                            required
                          >
                            <option value="">בחרו חלק חילוף…</option>
                            {parts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="employee-form__field">
                          <label className="employee-form__label" htmlFor="pd-qty">כמות שהתקבלה</label>
                          <input
                            id="pd-qty"
                            type="number"
                            min={1}
                            className="employee-form__input"
                            value={partDeliveryQty}
                            onChange={e => setPartDeliveryQty(e.target.value)}
                            required
                          />
                        </div>
                        <div className="employee-form__field">
                          <label className="employee-form__label" htmlFor="pd-notes">הערות (אופציונלי)</label>
                          <input
                            id="pd-notes"
                            className="employee-form__input"
                            value={partDeliveryNotes}
                            onChange={e => setPartDeliveryNotes(e.target.value)}
                          />
                        </div>
                        <div className="employee-form__actions">
                          <button type="submit" className="btn-add-employee" disabled={savingPartDelivery}>
                            {savingPartDelivery ? 'שומר…' : 'רישום קבלה'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className={`inventory-form-block${partWithdrawFormOpen ? ' inventory-form-block--open' : ''}`}>
                    <button
                      type="button"
                      className="machine-section__title inventory-form-block__toggle"
                      onClick={() => setPartWithdrawFormOpen(o => !o)}
                      aria-expanded={partWithdrawFormOpen}
                    >
                      משיכת חלקי חילוף
                      <span className={`inventory-form-block__chevron collapsible-chevron${partWithdrawFormOpen ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">▾</span>
                    </button>
                    <form className="employee-form__body" onSubmit={handlePartWithdraw}>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="pw-item">חלק חילוף</label>
                        <select
                          id="pw-item"
                          className="employee-form__select"
                          value={partWithdrawItem}
                          onChange={e => setPartWithdrawItem(e.target.value)}
                          required
                        >
                          <option value="">בחרו חלק חילוף…</option>
                          {activeParts.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="pw-qty">כמות שנלקחה</label>
                        <input
                          id="pw-qty"
                          type="number"
                          min={1}
                          className="employee-form__input"
                          value={partWithdrawQty}
                          onChange={e => setPartWithdrawQty(e.target.value)}
                          required
                        />
                      </div>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="pw-notes">הערות (אופציונלי)</label>
                        <input
                          id="pw-notes"
                          className="employee-form__input"
                          value={partWithdrawNotes}
                          onChange={e => setPartWithdrawNotes(e.target.value)}
                        />
                      </div>
                      <div className="employee-form__actions">
                        <button type="submit" className="btn-add-employee" disabled={savingPartWithdraw}>
                          {savingPartWithdraw ? 'שומר…' : 'רישום משיכה'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="machine-section inventory-section">
          <div className="machine-section__header">
            <span className="machine-section__title">מלאי חלקי חילוף</span>
            <span className="machine-section__count">{visibleParts.length} חלקים</span>
          </div>
          <div className="inventory-section__body">
                  {editingPartId && (
                    <form className="employee-form__body inventory-edit-part-form" onSubmit={handleSaveEditPart}>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="edit-part-name">שם</label>
                        <input
                          id="edit-part-name"
                          className="employee-form__input"
                          value={editPartForm.name}
                          onChange={e => setEditPartForm(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="employee-form__field">
                        <label className="employee-form__label" htmlFor="edit-part-desc">תיאור (אופציונלי)</label>
                        <input
                          id="edit-part-desc"
                          className="employee-form__input"
                          value={editPartForm.description}
                          onChange={e => setEditPartForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                      <div className="employee-form__actions">
                        <button type="submit" className="btn-add-employee" disabled={savingEditPart}>
                          {savingEditPart ? 'שומר…' : 'שמירת שינויים'}
                        </button>
                        <button type="button" className="btn-report-issue" onClick={closeEditPart}>
                          ביטול
                        </button>
                        {editPartError && <span className="employee-form__error">{editPartError}</span>}
                      </div>
                    </form>
                  )}

                  {visibleParts.length === 0 ? (
                    <p className="employee-empty">אין עדיין חלקי חילוף.</p>
                  ) : (
                    <>
                      {/* Desktop: unchanged full table, status/disable
                          columns replaced with Edit (that concept doesn't
                          apply to spare parts); unit of measure column
                          removed (not shown anywhere in this UI anymore).
                          Hidden on mobile — see
                          .inventory-parts-table__table in dashboard.css. */}
                      <table className="machine-table inventory-parts-table__table">
                        <thead>
                          <tr>
                            <th>שם</th>
                            <th>מלאי</th>
                            {canViewManagerUI && <th>פעולות</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleParts.map(part => (
                            <tr key={part.id}>
                              <td data-label="שם">
                                <div className="machine-name">{part.name}</div>
                                {part.description && <div className="machine-location">{part.description}</div>}
                              </td>
                              <td data-label="מלאי">
                                <span className={`machine-due machine-due--${part.currentStock > 0 ? 'clean' : 'overdue'}`}>
                                  {part.currentStock}
                                </span>
                              </td>
                              {canViewManagerUI && (
                                <td data-label="פעולות">
                                  <button className="btn-report-issue" onClick={() => openEditPart(part)}>
                                    עריכה
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile: compact scan-friendly list — name and
                          quantity, plus Edit for managers (no status/
                          disable, no unit of measure). Hidden on desktop,
                          where the table above is shown instead. */}
                      <ul className="inventory-parts-list">
                        {visibleParts.map(part => (
                          <li key={part.id} className={`inventory-parts-list__row${canViewManagerUI ? ' inventory-parts-list__row--with-edit' : ''}`}>
                            <div className="inventory-parts-list__main">
                              <span className="inventory-parts-list__name">{part.name}</span>
                              {part.description && (
                                <span className="inventory-parts-list__desc">{part.description}</span>
                              )}
                            </div>
                            <span className={`machine-due machine-due--${part.currentStock > 0 ? 'clean' : 'overdue'} inventory-parts-list__stock`}>
                              {part.currentStock}
                            </span>
                            {canViewManagerUI && (
                              <button
                                type="button"
                                className="btn-report-issue inventory-parts-list__edit"
                                onClick={() => openEditPart(part)}
                              >
                                עריכה
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {canViewManagerUI && (
                    <div className="inventory-add-part">
                      {!partCreateFormOpen ? (
                        <button
                          type="button"
                          className="inventory-add-part__trigger"
                          onClick={() => setPartCreateFormOpen(true)}
                          aria-label="הוספת סוג חלק חילוף חדש"
                          title="הוספת סוג חלק חילוף חדש"
                        >
                          <span className="inventory-add-part__plus" aria-hidden="true">+</span>
                        </button>
                      ) : (
                        <>
                          <p className="inventory-add-part__hint">
                            יצירת סוג חדש של חלק חילוף — לא הוספת מלאי לפריט קיים.
                          </p>
                          <form className="employee-form__body" onSubmit={handleCreatePart}>
                            <div className="employee-form__field">
                              <label className="employee-form__label" htmlFor="part-name">שם</label>
                              <input
                                id="part-name"
                                className="employee-form__input"
                                value={partForm.name}
                                onChange={e => setPartForm(prev => ({ ...prev, name: e.target.value }))}
                                required
                              />
                            </div>
                            <div className="employee-form__field">
                              <label className="employee-form__label" htmlFor="part-desc">תיאור (אופציונלי)</label>
                              <input
                                id="part-desc"
                                className="employee-form__input"
                                value={partForm.description}
                                onChange={e => setPartForm(prev => ({ ...prev, description: e.target.value }))}
                              />
                            </div>
                            <div className="employee-form__actions">
                              <button type="submit" className="btn-add-employee" disabled={savingPart}>
                                {savingPart ? 'שומר…' : 'יצירת חלק חילוף'}
                              </button>
                              <button
                                type="button"
                                className="btn-report-issue"
                                onClick={() => { setPartCreateFormOpen(false); setPartForm(EMPTY_PART_FORM); }}
                              >
                                ביטול
                              </button>
                            </div>
                          </form>
                        </>
                      )}
                    </div>
                  )}
          </div>
        </div>
        </>
        )}
      </div>
    </DashboardLayout>
  );
}
