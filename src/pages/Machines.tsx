import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import MachineTable from '../components/dashboard/MachineTable';
import MachineMobileView from '../components/dashboard/MachineMobileView';
import { type Machine } from '../types/machine';
import { useAuth } from '../context/AuthContext';
import {
  getMachines,
  markMachineWorking,
  markMachineCleaned,
  createMachine,
  uploadMachineImage,
  PREVIEW_BLOCKED_MESSAGE,
} from '../lib/supabase';
import { scrollIntoComfortableView } from '../lib/scrollIntoComfortableView';
import '../styles/layout.css';
import '../styles/dashboard.css';

const FALLBACK_USER = {
  name: '',
  role: 'employee' as const,
};

type MachinesStatus = 'loading' | 'error' | 'ready';

const EMPTY_MACHINE_FORM = {
  name: '',
  location: '',
  maintenanceNotes: '',
  isActive: true,
};

interface Props {
  title?: string;
  subtitle?: string;
  /** Shown instead of `subtitle` only below the mobile breakpoint (see
   *  .page-header__subtitle--mobile in dashboard.css). Defaults to the same
   *  text as `subtitle` so callers that don't pass it see no change. */
  mobileSubtitle?: string;
}

export default function Machines({
  title = 'מכונות',
  subtitle = 'ניהול ומעקב אחר כל מכונות OBoost.',
  mobileSubtitle = 'ניהול כל המכונות',
}: Props) {
  const { profile, session, loading } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesStatus, setMachinesStatus] = useState<MachinesStatus>('loading');
  const [savingWorkingIds, setSavingWorkingIds] = useState<Set<string>>(new Set());
  const [savingCleanIds, setSavingCleanIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // canViewManagerUI: preview sees the same manager-style interface as
  // a real manager (forms, buttons, sections included) — every actual
  // mutation is blocked separately below via isPreview, regardless of
  // what's visible.
  const canViewManagerUI = profile?.role === 'manager' || profile?.role === 'preview';
  const isPreview = profile?.role === 'preview';
  const [machineForm, setMachineForm] = useState(EMPTY_MACHINE_FORM);
  const [machineImage, setMachineImage] = useState<File | null>(null);
  const [creatingMachine, setCreatingMachine] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdMachine, setCreatedMachine] = useState<{ id: string; name: string } | null>(null);
  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const addMachineRef = useRef<HTMLDivElement>(null);
  const addMachineMounted = useRef(false);

  // Smooth-scroll to the Add Machine section on every open/close toggle —
  // down to the form when it opens (so it's never "opens too far down the
  // page and easy to miss"), and back up to the now-collapsed button when
  // it closes, since the ref always points at the same wrapper. Skips the
  // very first render so loading the page doesn't itself trigger a scroll.
  // Desktop keeps its original unconditional scrollIntoView — no carousel
  // there to account for, and it isn't part of this mobile-only tuning.
  // Mobile: opening top-aligns with extra clearance (always — never the
  // "center if it fits" behavior scrollIntoComfortableView otherwise uses,
  // which was undershooting here) — the form becomes the dominant thing on
  // screen, not something peeking in below still-visible old content.
  // The scroll is delayed until the .collapsible__body reveal transition
  // (grid-template-rows, 0.25s — see dashboard.css) actually finishes:
  // starting it immediately, while that transition is still growing the
  // page's height underneath the in-flight smooth scroll, was causing a
  // visible second "jump" partway through (the browser's scroll-anchoring
  // compensating for the concurrent layout shift). Waiting the ~250ms out
  // first means nothing is changing size while the scroll animates, so
  // there's only ever one, single scroll. Closing scrolls the page all the
  // way back to its top, since the closed button always sits in row 1
  // (see .machines-add-section's CSS grid placement) right next to the
  // page header — i.e. exactly where it was before the form opened.
  // (Close is unchanged from before.)
  useEffect(() => {
    if (!addMachineMounted.current) {
      addMachineMounted.current = true;
      return;
    }
    const el = addMachineRef.current;
    if (!el) return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (addMachineOpen) {
      if (isMobile) {
        const timer = setTimeout(() => {
          scrollIntoComfortableView(el, { align: 'top', topPadding: 32 });
        }, 260);
        return () => clearTimeout(timer);
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (isMobile) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [addMachineOpen]);

  useEffect(() => {
    if (loading) return;
    setMachinesStatus('loading');
    getMachines().then(({ machines: rows, error }) => {
      if (error) {
        setMachinesStatus('error');
      } else {
        setMachines(rows);
        setMachinesStatus('ready');
      }
    });
  }, [loading, session]);

  async function refreshMachines() {
    const { machines: rows, error: fetchError } = await getMachines();
    if (!fetchError) setMachines(rows);
  }

  async function handleMarkCleaned(id: string) {
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    setSavingCleanIds(prev => new Set(prev).add(id));

    const { error } = await markMachineCleaned(id);

    if (error) {
      setActionError(error);
    } else {
      const { machines: rows, error: fetchError } = await getMachines();
      if (!fetchError) setMachines(rows);
    }

    setSavingCleanIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleMarkWorking(id: string) {
    if (isPreview) { setActionError(PREVIEW_BLOCKED_MESSAGE); return; }
    setActionError(null);
    setSavingWorkingIds(prev => new Set(prev).add(id));

    const { error } = await markMachineWorking(id);

    if (error) {
      setActionError(error);
    } else {
      const { machines: rows, error: fetchError } = await getMachines();
      if (!fetchError) setMachines(rows);
    }

    setSavingWorkingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleCreateMachine(e: FormEvent) {
    e.preventDefault();
    if (isPreview) { setCreateError(PREVIEW_BLOCKED_MESSAGE); return; }
    setCreateError(null);
    setCreatedMachine(null);

    if (!machineForm.name.trim() || !machineForm.location.trim()) {
      setCreateError('יש למלא שם ומיקום.');
      return;
    }

    setCreatingMachine(true);
    const { id, error } = await createMachine({
      name: machineForm.name,
      location: machineForm.location,
      maintenanceNotes: machineForm.maintenanceNotes,
      isActive: machineForm.isActive,
    });

    if (error || !id) {
      setCreatingMachine(false);
      setCreateError(error ?? 'לא ניתן היה ליצור את המכונה. אנא נסו שוב.');
      return;
    }

    if (machineImage) {
      const { error: imageError } = await uploadMachineImage(id, machineImage);
      if (imageError) setCreateError(imageError);
    }

    setCreatingMachine(false);
    setCreatedMachine({ id, name: machineForm.name });
    setMachineForm(EMPTY_MACHINE_FORM);
    setMachineImage(null);

    setMachinesStatus('loading');
    const { machines: rows, error: fetchError } = await getMachines();
    if (fetchError) {
      setMachinesStatus('error');
    } else {
      setMachines(rows);
      setMachinesStatus('ready');
    }
  }

  return (
    <DashboardLayout title={title} currentUser={FALLBACK_USER}>
      <div className="dashboard-page machines-page">
        <div className="page-header">
          <h2 className="page-header__title">{title}</h2>
          <p className="page-header__subtitle page-header__subtitle--desktop">{subtitle}</p>
          <p className="page-header__subtitle page-header__subtitle--mobile">{mobileSubtitle}</p>
        </div>

        {actionError && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            {actionError}
          </div>
        )}

        {machinesStatus === 'loading' && (
          <p className="employee-empty">טוען מכונות…</p>
        )}

        {machinesStatus === 'error' && (
          <div className="alert-banner">
            <span className="alert-banner__dot" />
            לא ניתן היה לטעון את המכונות. אנא נסו שוב.
          </div>
        )}

        {machinesStatus === 'ready' && machines.length === 0 && (
          <p className="employee-empty">טרם נוספו מכונות.</p>
        )}

        {machinesStatus === 'ready' && machines.length > 0 && (
          <>
            <div className="machines-desktop-view">
              <MachineTable
                machines={machines}
                onMarkCleaned={handleMarkCleaned}
                currentUserRole={profile?.role}
                savingWorkingIds={savingWorkingIds}
                onMarkWorking={handleMarkWorking}
                savingCleanIds={savingCleanIds}
              />
            </div>
            <MachineMobileView
              machines={machines}
              onMarkCleaned={handleMarkCleaned}
              currentUserRole={profile?.role}
              savingWorkingIds={savingWorkingIds}
              onMarkWorking={handleMarkWorking}
              savingCleanIds={savingCleanIds}
              onUpdated={refreshMachines}
            />
          </>
        )}

        {canViewManagerUI && (
          <div
            className={`machine-section employee-form machines-add-section${addMachineOpen ? ' collapsible--open' : ''}`}
            ref={addMachineRef}
          >
            <button
              type="button"
              className="machine-section__header collapsible-header"
              onClick={() => setAddMachineOpen(o => !o)}
              aria-expanded={addMachineOpen}
            >
              <span className="machine-section__title">הוספת מכונה</span>
              <span className="collapsible-header__right">
                <span className={`collapsible-chevron${addMachineOpen ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </span>
            </button>
            <div className={`collapsible__body${addMachineOpen ? ' collapsible__body--open' : ''}`}>
              <div className="collapsible__body-inner">
            <form className="employee-form__body" onSubmit={handleCreateMachine}>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-name">שם</label>
                <input
                  id="mach-name"
                  className="employee-form__input"
                  value={machineForm.name}
                  onChange={e => setMachineForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-location">מיקום</label>
                <input
                  id="mach-location"
                  className="employee-form__input"
                  placeholder="לדוגמה: דיזנגוף סנטר, תל אביב"
                  value={machineForm.location}
                  onChange={e => setMachineForm(prev => ({ ...prev, location: e.target.value }))}
                  required
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-notes">הערות (אופציונלי)</label>
                <input
                  id="mach-notes"
                  className="employee-form__input"
                  value={machineForm.maintenanceNotes}
                  onChange={e => setMachineForm(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-image">תמונה (אופציונלי)</label>
                <input
                  id="mach-image"
                  type="file"
                  accept="image/*"
                  className="employee-form__input"
                  onChange={e => setMachineImage(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="employee-form__field">
                <label className="employee-form__label" htmlFor="mach-active">
                  <input
                    id="mach-active"
                    type="checkbox"
                    checked={machineForm.isActive}
                    onChange={e => setMachineForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  {' '}פעיל
                </label>
              </div>
              <div className="employee-form__actions">
                <button type="submit" className="btn-add-employee" disabled={creatingMachine}>
                  {creatingMachine ? 'מוסיף…' : 'הוספת מכונה'}
                </button>
                <button type="button" className="btn-report-issue" onClick={() => setAddMachineOpen(false)}>
                  ביטול
                </button>
                {createdMachine && (
                  <span className="employee-form__success">
                    {createdMachine.name} נוספה בהצלחה. <Link to={`/machines/${createdMachine.id}`}>צפייה בפרטים</Link>
                  </span>
                )}
                {createError && <span className="employee-form__error">{createError}</span>}
              </div>
            </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
