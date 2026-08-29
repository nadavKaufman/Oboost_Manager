import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { type Machine, getMachineStatus, getCleaningElapsedText, type UserRole } from '../../types/machine';
import { updateMachine, uploadMachineImage } from '../../lib/supabase';
import MachineIcon from './MachineIcon';
import MobileItemCarousel, { type CarouselItem } from './MobileItemCarousel';
import { STATUS_LABEL, FAULT_LABEL, FAULT_STATUS_CLASS } from './MachineTable';

interface Props {
  machines: Machine[];
  onMarkCleaned: (id: string) => void;
  currentUserRole?: UserRole;
  savingWorkingIds: Set<string>;
  onMarkWorking: (id: string) => void;
  savingCleanIds: Set<string>;
  onUpdated: () => void;
}

const EMPTY_EDIT_FORM = { name: '', location: '', maintenanceNotes: '' };

// Mobile-only alternative to MachineTable: one machine shown large (same
// data/actions as a table row, just laid out as a card) plus a swipeable
// carousel below to switch which one is "main". Desktop keeps MachineTable
// untouched — this only ever renders below the app's existing 767px mobile
// breakpoint (see .machine-mobile-view in dashboard.css). Editing reuses
// the exact same updateMachine/uploadMachineImage functions the desktop
// Machine Details page already uses — no separate edit system.
export default function MachineMobileView({
  machines,
  onMarkCleaned,
  currentUserRole,
  savingWorkingIds,
  onMarkWorking,
  savingCleanIds,
  onUpdated,
}: Props) {
  const canViewManagerUI = currentUserRole === 'manager' || currentUserRole === 'preview';
  const [selectedId, setSelectedId] = useState<string | null>(machines[0]?.id ?? null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const editFormRef = useRef<HTMLDivElement>(null);

  const machine = machines.find(m => m.id === selectedId) ?? machines[0];

  // Close any open edit form when the carousel selection changes, so a
  // swipe never leaves a stale form open for a different machine.
  useEffect(() => {
    setEditing(false);
    setEditError(null);
  }, [machine?.id]);

  // Smooth-scroll the edit form into view as soon as it opens, so it's
  // never "opens too far down the page and easy to miss" on mobile.
  useEffect(() => {
    if (editing) {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editing]);

  if (!machine) return null;

  const { status: cleanStatus, daysSinceCleaned } = getMachineStatus(machine);

  const carouselItems: CarouselItem[] = machines.map(m => ({
    id: m.id,
    label: m.name,
    imageUrl: m.imageUrl,
    fallback: <MachineIcon className="mobile-carousel__fallback-icon mobile-carousel__fallback-icon--accent" />,
  }));

  function openEdit() {
    setEditError(null);
    setEditForm({ name: machine.name, location: machine.location, maintenanceNotes: machine.maintenanceNotes });
    setEditing(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    setSavingEdit(true);
    const { error } = await updateMachine(machine.id, editForm);
    setSavingEdit(false);
    if (error) {
      setEditError(error);
    } else {
      setEditing(false);
      onUpdated();
    }
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEditError(null);
    setImageUploading(true);
    const { error } = await uploadMachineImage(machine.id, file);
    setImageUploading(false);
    if (error) setEditError(error);
    else onUpdated();
  }

  return (
    <div className="machine-mobile-view">
      <div className="mobile-item-card">
        <div className="mobile-item-card__name">
          {machine.name}
        </div>
        <div className="machine-detail-grid">
          <div className="machine-detail-image">
            {machine.imageUrl ? (
              <img src={machine.imageUrl} alt={machine.name} />
            ) : (
              <div className="machine-detail-image__placeholder">אין תמונה</div>
            )}
          </div>
          <div className="machine-detail-info">
            <div className="machine-detail-row">
              <span className="machine-detail-label">מיקום</span>
              <span>{machine.location || '—'}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">סטטוס מכונה</span>
              <span className={`status-badge status-badge--${machine.isActive ? 'clean' : 'overdue'}`}>
                <span className="status-badge__dot" />
                {machine.isActive ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">ניקיון</span>
              <span
                className={`status-badge status-badge--${cleanStatus}${cleanStatus === 'overdue' ? ' status-badge--cleaning-overdue' : ''}`}
              >
                {STATUS_LABEL[cleanStatus]}
              </span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">ניקוי אחרון</span>
              <span>{getCleaningElapsedText(daysSinceCleaned)}</span>
            </div>
            <div className="machine-detail-row">
              <span className="machine-detail-label">תקלה</span>
              <span className={`status-badge ${FAULT_STATUS_CLASS[machine.faultStatus]}`}>
                <span className="status-badge__dot" />
                {FAULT_LABEL[machine.faultStatus]}
              </span>
            </div>
          </div>
        </div>

        {canViewManagerUI && (
          <div className="machine-mobile-actions__row">
            <button
              className={`btn-mark-working${machine.faultStatus === 'fault' ? '' : ' btn-mark-working--reserved'}`}
              disabled={savingWorkingIds.has(machine.id) || machine.faultStatus !== 'fault'}
              onClick={() => onMarkWorking(machine.id)}
            >
              {savingWorkingIds.has(machine.id) ? 'שומר…' : 'סמן כתקין'}
            </button>
            <button className="btn-report-issue" onClick={openEdit}>
              עריכה
            </button>
          </div>
        )}
      </div>

      <div className="machine-mobile-actions-outside">
        <button
          className="btn-mark-clean"
          disabled={savingCleanIds.has(machine.id)}
          onClick={() => onMarkCleaned(machine.id)}
        >
          {savingCleanIds.has(machine.id) ? 'שומר…' : 'סמן כנוקה'}
        </button>
        <Link className="btn-report-issue" to={`/machines/${machine.id}/report-malfunction`}>
          דיווח על תקלה
        </Link>
      </div>

      {canViewManagerUI && editing && (
        <div className="employee-form mobile-edit-form" ref={editFormRef}>
          <div className="machine-section__header">
            <span className="machine-section__title">עריכת מכונה</span>
          </div>
          <form className="employee-form__body" onSubmit={handleSaveEdit}>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="mob-edit-name">שם</label>
              <input
                id="mob-edit-name"
                className="employee-form__input"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="mob-edit-location">מיקום</label>
              <input
                id="mob-edit-location"
                className="employee-form__input"
                value={editForm.location}
                onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                required
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="mob-edit-notes">הערות תחזוקה</label>
              <input
                id="mob-edit-notes"
                className="employee-form__input"
                value={editForm.maintenanceNotes}
                onChange={e => setEditForm(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
              />
            </div>
            <div className="employee-form__field">
              <label className="employee-form__label" htmlFor="mob-edit-image">
                {imageUploading ? 'מעלה תמונה…' : 'החלפת תמונה'}
              </label>
              <input
                id="mob-edit-image"
                type="file"
                accept="image/*"
                className="employee-form__input"
                onChange={handleImageChange}
                disabled={imageUploading}
              />
            </div>
            <div className="employee-form__actions">
              <button type="submit" className="btn-add-employee" disabled={savingEdit}>
                {savingEdit ? 'שומר…' : 'שמירת שינויים'}
              </button>
              <button type="button" className="btn-report-issue" onClick={() => setEditing(false)}>
                ביטול
              </button>
              {editError && <span className="employee-form__error">{editError}</span>}
            </div>
          </form>
        </div>
      )}

      <MobileItemCarousel
        items={carouselItems}
        selectedId={machine.id}
        onSelect={setSelectedId}
        ariaLabel="בחירת מכונה"
      />
    </div>
  );
}
