import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  count?: string;
  defaultOpen?: boolean;
  /** When true, the disclosure only actually collapses below the mobile
   *  breakpoint. Above it, CSS (`.collapsible--mobile-only` rules in
   *  dashboard.css) forces the body open and hides the chevron/count, so
   *  desktop keeps looking like an always-expanded panel while mobile gets
   *  a real tap-to-expand header. */
  mobileOnly?: boolean;
  /** Extra class(es) merged onto the root `.machine-section` wrapper. */
  className?: string;
  children: ReactNode;
}

export default function CollapsibleSection({ title, count, defaultOpen = false, mobileOnly = false, className, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionClass = ['machine-section', mobileOnly && 'collapsible--mobile-only', className, open && 'collapsible--open']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sectionClass}>
      <button
        type="button"
        className="machine-section__header collapsible-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="machine-section__title">{title}</span>
        <span className="collapsible-header__right">
          {count && <span className="machine-section__count">{count}</span>}
          <span className={`collapsible-chevron${open ? ' collapsible-chevron--open' : ''}`} aria-hidden="true">
            ▾
          </span>
        </span>
      </button>
      <div className={`collapsible__body${open ? ' collapsible__body--open' : ''}`}>
        <div className="collapsible__body-inner">{children}</div>
      </div>
    </div>
  );
}
