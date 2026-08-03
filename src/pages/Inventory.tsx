import { useState, useEffect, useCallback, type FormEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import StatCard from '../components/dashboard/StatCard';
import CollapsibleSection from '../components/dashboard/CollapsibleSection';
import { useAuth } from '../context/AuthContext';
import {
  getOrangeInventory,
  recordOrangeDelivery,
  recordOrangeWithdrawal,
  recordOrangeAdjustment,
  getSpareParts,
  createSparePart,
  setSparePartActive,
  getSparePartTransactions,
  recordSparePartDelivery,
  recordSparePartWithdrawal,
  recordSparePartAdjustment,
  type OrangeInventoryData,
  type SparePartRecord,
  type SparePartTransactionRecord,
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

const EMPTY_PART_FORM = { name: '', description: '', unit: 'unit' };

export default function Inventory() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [actionError, setActionError] = useState<string | null>(null);

  // ── Orange cartons ──
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<OrangeInventoryData | null>(null);

  const [deliveryQty, setDeliveryQty] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [savingDelivery, setSavingDelivery] = useState(false);

  const [withdrawQty, setWithdrawQty] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [savingWithdraw, setSavingWithdraw] = useState(false);

  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // ── Spare parts ──
  const [partsStatus, setPartsStatus] = useState<LoadStatus>('loading');
  const [parts, setParts] = useState<SparePartRecord[]>([]);
  const [partTxns, setPartTxns] = useState<SparePartTransactionRecord[]>([]);

  const [partForm, setPartForm] = useState(EMPTY_PART_FORM);
  const [savingPart, setSavingPart] = useState(false);

  const [partDeliveryItem, setPartDeliveryItem] = useState('');
  const [partDeliveryQty, setPartDeliveryQty] = useState('');
  const [partDeliveryNotes, setPartDeliveryNotes] = useState('');
  const [savingPartDelivery, setSavingPartDelivery] = useState(false);

  const [partWithdrawItem, setPartWithdrawItem] = useState('');
  const [partWithdrawQty, setPartWithdrawQty] = useState('');
  const [partWithdrawNotes, setPartWithdrawNotes] = useState('');
  const [savingPartWithdraw, setSavingPartWithdraw] = useState(false);

  const [partAdjustItem, setPartAdjustItem] = useState('');
  const [partAdjustQty, setPartAdjustQty] = useState('');
  const [partAdjustNotes, setPartAdjustNotes] = useState('');
  const [savingPartAdjust, setSavingPartAdjust] = useState(false);

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
    const [{ parts: partRows, error: partsError }, { transactions: txnRows, error: txnError }] = await Promise.all([
      getSpareParts(),
      getSparePartTransactions(),
    ]);
    if (partsError || txnError) {
      setPartsStatus('error');
    } else {
      setParts(partRows);
      setPartTxns(txnRows);
      setPartsStatus('ready');
    }
  }, []);

  useEffect(() => {
    load();
    loadParts();
  }, [load, loadParts]);

  async function handleDelivery(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    const qty = Number(deliveryQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('Enter a whole number greater than zero.');
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
    setActionError(null);
    const qty = Number(withdrawQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('Enter a whole number greater than zero.');
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

  async function handleAdjust(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    const qty = Number(adjustQty);
    if (!Number.isInteger(qty) || qty === 0) {
      setActionError('Enter a non-zero whole number (use a negative number to correct downward).');
      return;
    }
    if (!adjustNotes.trim()) {
      setActionError('An adjustment requires a note explaining the correction.');
      return;
    }
    setSavingAdjust(true);
    const { error } = await recordOrangeAdjustment(qty, adjustNotes);
    setSavingAdjust(false);
    if (error) {
      setActionError(error);
    } else {
      setAdjustQty('');
      setAdjustNotes('');
      await load();
    }
  }

  async function handleCreatePart(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!partForm.name.trim()) {
      setActionError('Spare part name is required.');
      return;
    }
    setSavingPart(true);
    const { error } = await createSparePart(partForm);
    setSavingPart(false);
    if (error) {
      setActionError(error);
    } else {
      setPartForm(EMPTY_PART_FORM);
      await loadParts();
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setActionError(null);
    const { error } = await setSparePartActive(id, !isActive);
    if (error) setActionError(error);
    else await loadParts();
  }

  async function handlePartDelivery(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    const qty = Number(partDeliveryQty);
    if (!partDeliveryItem) {
      setActionError('Select a spare part.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('Enter a whole number greater than zero.');
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
    setActionError(null);
    const qty = Number(partWithdrawQty);
    if (!partWithdrawItem) {
      setActionError('Select a spare part.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setActionError('Enter a whole number greater than zero.');
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

  async function handlePartAdjust(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    const qty = Number(partAdjustQty);
    if (!partAdjustItem) {
      setActionError('Select a spare part.');
      return;
    }
    if (!Number.isInteger(qty) || qty === 0) {
      setActionError('Enter a non-zero whole number (use a negative number to correct downward).');
      return;
    }
    if (!partAdjustNotes.trim()) {
      setActionError('An adjustment requires a note explaining the correction.');
      return;
    }
    setSavingPartAdjust(true);
    const { error } = await recordSparePartAdjustment(partAdjustItem, qty, partAdjustNotes);
    setSavingPartAdjust(false);
    if (error) {
      setActionError(error);
    } else {
      setPartAdjustQty('');
      setPartAdjustNotes('');
      await loadParts();
    }
  }

  const activeParts = parts.filter(p => p.isActive);
  const visibleParts = isManager ? parts : activeParts;

  return (
    <DashboardLayout title="Inventory" currentUser={FALLBACK_USER}>
      <div className="dashboard-page inventory-page">
        <div className="page-header">
          <h2 className="page-header__title">Inventory</h2>
          <p className="page-header__subtitle">Orange carton stock, spare parts, and movement history.</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        {/* ══════════════ Orange Cartons ══════════════ */}
        <div className="page-header">
          <h2 className="page-header__title">Orange Cartons</h2>
        </div>

        {status === 'loading' && <p className="employee-empty">Loading inventory…</p>}

        {status === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load inventory. Please try again.
          </div>
        )}

        {status === 'ready' && data && (
          <>
            <div className="stat-cards stat-cards--single">
              <StatCard
                label="Current Stock"
                value={data.currentStock}
                accent={data.currentStock > 0 ? 'green' : 'red'}
                subtext="Orange cartons"
              />
            </div>

            {isManager && (
              <div className="employee-form">
                <div className="machine-section__header">
                  <span className="machine-section__title">Record Supplier Delivery</span>
                </div>
                <form className="employee-form__body" onSubmit={handleDelivery}>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="delivery-qty">Quantity Delivered</label>
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
                    <label className="employee-form__label" htmlFor="delivery-notes">Notes (optional)</label>
                    <input
                      id="delivery-notes"
                      className="employee-form__input"
                      value={deliveryNotes}
                      onChange={e => setDeliveryNotes(e.target.value)}
                    />
                  </div>
                  <div className="employee-form__actions">
                    <button type="submit" className="btn-add-employee" disabled={savingDelivery}>
                      {savingDelivery ? 'Saving…' : 'Record Delivery'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="employee-form">
              <div className="machine-section__header">
                <span className="machine-section__title">Record Withdrawal</span>
              </div>
              <form className="employee-form__body" onSubmit={handleWithdraw}>
                <div className="employee-form__field">
                  <label className="employee-form__label" htmlFor="withdraw-qty">Quantity Taken</label>
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
                  <label className="employee-form__label" htmlFor="withdraw-notes">Notes (optional)</label>
                  <input
                    id="withdraw-notes"
                    className="employee-form__input"
                    value={withdrawNotes}
                    onChange={e => setWithdrawNotes(e.target.value)}
                  />
                </div>
                <div className="employee-form__actions">
                  <button type="submit" className="btn-add-employee" disabled={savingWithdraw}>
                    {savingWithdraw ? 'Saving…' : 'Record Withdrawal'}
                  </button>
                </div>
              </form>
            </div>

            {isManager && (
              <div className="employee-form">
                <div className="machine-section__header">
                  <span className="machine-section__title">Record Adjustment</span>
                </div>
                <form className="employee-form__body" onSubmit={handleAdjust}>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="adjust-qty">
                      Quantity (negative to correct downward)
                    </label>
                    <input
                      id="adjust-qty"
                      type="number"
                      className="employee-form__input"
                      value={adjustQty}
                      onChange={e => setAdjustQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="adjust-notes">Reason for correction</label>
                    <input
                      id="adjust-notes"
                      className="employee-form__input"
                      value={adjustNotes}
                      onChange={e => setAdjustNotes(e.target.value)}
                      required
                    />
                  </div>
                  <div className="employee-form__actions">
                    <button type="submit" className="btn-add-employee" disabled={savingAdjust}>
                      {savingAdjust ? 'Saving…' : 'Record Adjustment'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <CollapsibleSection
              title={isManager ? 'All Movements' : 'Your Movements'}
              count={`${data.transactions.length} movements`}
            >
              {data.transactions.length === 0 ? (
                <p className="employee-empty">No inventory movements yet.</p>
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
                    {data.transactions.map(txn => (
                      <tr key={txn.id}>
                        <td data-label="Type">{TYPE_LABEL[txn.type]}</td>
                        <td data-label="Quantity">
                          <span className={`machine-due machine-due--${txn.quantity < 0 ? 'overdue' : 'clean'}`}>
                            {txn.quantity > 0 ? `+${txn.quantity}` : txn.quantity}
                          </span>
                        </td>
                        <td data-label="Recorded By">{txn.recordedByName}</td>
                        <td data-label="Notes">{txn.notes || '—'}</td>
                        <td data-label="Date">{new Date(txn.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>
          </>
        )}

        {/* ══════════════ Spare Parts ══════════════ */}
        <div className="page-header" style={{ marginTop: '32px' }}>
          <h2 className="page-header__title">Spare Parts</h2>
        </div>

        {partsStatus === 'loading' && <p className="employee-empty">Loading spare parts…</p>}

        {partsStatus === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            Could not load spare parts. Please try again.
          </div>
        )}

        {partsStatus === 'ready' && (
          <>
            {isManager && (
              <div className="employee-form">
                <div className="machine-section__header">
                  <span className="machine-section__title">Add Spare Part</span>
                </div>
                <form className="employee-form__body" onSubmit={handleCreatePart}>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="part-name">Name</label>
                    <input
                      id="part-name"
                      className="employee-form__input"
                      value={partForm.name}
                      onChange={e => setPartForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="part-desc">Description (optional)</label>
                    <input
                      id="part-desc"
                      className="employee-form__input"
                      value={partForm.description}
                      onChange={e => setPartForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="part-unit">Unit</label>
                    <input
                      id="part-unit"
                      className="employee-form__input"
                      value={partForm.unit}
                      onChange={e => setPartForm(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                  <div className="employee-form__actions">
                    <button type="submit" className="btn-add-employee" disabled={savingPart}>
                      {savingPart ? 'Saving…' : 'Add Spare Part'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="machine-section">
              <div className="machine-section__header">
                <span className="machine-section__title">Spare Parts Stock</span>
                <span className="machine-section__count">{visibleParts.length} parts</span>
              </div>
              {visibleParts.length === 0 ? (
                <p className="employee-empty">No spare parts yet.</p>
              ) : (
                <table className="machine-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Unit</th>
                      <th>Stock</th>
                      {isManager && <th>Status</th>}
                      {isManager && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleParts.map(part => (
                      <tr key={part.id}>
                        <td data-label="Name">
                          <div className="machine-name">{part.name}</div>
                          {part.description && <div className="machine-location">{part.description}</div>}
                        </td>
                        <td data-label="Unit">{part.unit}</td>
                        <td data-label="Stock">
                          <span className={`machine-due machine-due--${part.currentStock > 0 ? 'clean' : 'overdue'}`}>
                            {part.currentStock}
                          </span>
                        </td>
                        {isManager && (
                          <td data-label="Status">
                            <span className={`status-badge status-badge--${part.isActive ? 'clean' : 'maintenance'}`}>
                              <span className="status-badge__dot" />
                              {part.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        )}
                        {isManager && (
                          <td data-label="Actions">
                            <button className="btn-report-issue" onClick={() => handleToggleActive(part.id, part.isActive)}>
                              {part.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {isManager && (
              <div className="employee-form">
                <div className="machine-section__header">
                  <span className="machine-section__title">Record Spare Part Delivery</span>
                </div>
                <form className="employee-form__body" onSubmit={handlePartDelivery}>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="pd-item">Spare Part</label>
                    <select
                      id="pd-item"
                      className="employee-form__select"
                      value={partDeliveryItem}
                      onChange={e => setPartDeliveryItem(e.target.value)}
                      required
                    >
                      <option value="">Select a spare part…</option>
                      {parts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="pd-qty">Quantity Delivered</label>
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
                    <label className="employee-form__label" htmlFor="pd-notes">Notes (optional)</label>
                    <input
                      id="pd-notes"
                      className="employee-form__input"
                      value={partDeliveryNotes}
                      onChange={e => setPartDeliveryNotes(e.target.value)}
                    />
                  </div>
                  <div className="employee-form__actions">
                    <button type="submit" className="btn-add-employee" disabled={savingPartDelivery}>
                      {savingPartDelivery ? 'Saving…' : 'Record Delivery'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="employee-form">
              <div className="machine-section__header">
                <span className="machine-section__title">Record Spare Part Withdrawal</span>
              </div>
              <form className="employee-form__body" onSubmit={handlePartWithdraw}>
                <div className="employee-form__field">
                  <label className="employee-form__label" htmlFor="pw-item">Spare Part</label>
                  <select
                    id="pw-item"
                    className="employee-form__select"
                    value={partWithdrawItem}
                    onChange={e => setPartWithdrawItem(e.target.value)}
                    required
                  >
                    <option value="">Select a spare part…</option>
                    {activeParts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="employee-form__field">
                  <label className="employee-form__label" htmlFor="pw-qty">Quantity Taken</label>
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
                  <label className="employee-form__label" htmlFor="pw-notes">Notes (optional)</label>
                  <input
                    id="pw-notes"
                    className="employee-form__input"
                    value={partWithdrawNotes}
                    onChange={e => setPartWithdrawNotes(e.target.value)}
                  />
                </div>
                <div className="employee-form__actions">
                  <button type="submit" className="btn-add-employee" disabled={savingPartWithdraw}>
                    {savingPartWithdraw ? 'Saving…' : 'Record Withdrawal'}
                  </button>
                </div>
              </form>
            </div>

            {isManager && (
              <div className="employee-form">
                <div className="machine-section__header">
                  <span className="machine-section__title">Record Spare Part Adjustment</span>
                </div>
                <form className="employee-form__body" onSubmit={handlePartAdjust}>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="pa-item">Spare Part</label>
                    <select
                      id="pa-item"
                      className="employee-form__select"
                      value={partAdjustItem}
                      onChange={e => setPartAdjustItem(e.target.value)}
                      required
                    >
                      <option value="">Select a spare part…</option>
                      {parts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="pa-qty">
                      Quantity (negative to correct downward)
                    </label>
                    <input
                      id="pa-qty"
                      type="number"
                      className="employee-form__input"
                      value={partAdjustQty}
                      onChange={e => setPartAdjustQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="employee-form__field">
                    <label className="employee-form__label" htmlFor="pa-notes">Reason for correction</label>
                    <input
                      id="pa-notes"
                      className="employee-form__input"
                      value={partAdjustNotes}
                      onChange={e => setPartAdjustNotes(e.target.value)}
                      required
                    />
                  </div>
                  <div className="employee-form__actions">
                    <button type="submit" className="btn-add-employee" disabled={savingPartAdjust}>
                      {savingPartAdjust ? 'Saving…' : 'Record Adjustment'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <CollapsibleSection
              title={isManager ? 'All Part Movements' : 'Your Part Movements'}
              count={`${partTxns.length} movements`}
            >
              {partTxns.length === 0 ? (
                <p className="employee-empty">No spare part movements yet.</p>
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
                    {partTxns.map(txn => (
                      <tr key={txn.id}>
                        <td data-label="Part">{txn.itemName}</td>
                        <td data-label="Type">{TYPE_LABEL[txn.type]}</td>
                        <td data-label="Quantity">
                          <span className={`machine-due machine-due--${txn.quantity < 0 ? 'overdue' : 'clean'}`}>
                            {txn.quantity > 0 ? `+${txn.quantity}` : txn.quantity}
                          </span>
                        </td>
                        <td data-label="Recorded By">{txn.recordedByName}</td>
                        <td data-label="Notes">{txn.notes || '—'}</td>
                        <td data-label="Date">{new Date(txn.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
