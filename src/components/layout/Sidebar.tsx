import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserRole } from '../../types/machine';

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout?: () => void;
}

interface NavItem {
  icon: ReactNode;
  label: string;
  path: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'מנהל',
  employee: 'עובד',
  preview: 'צפייה בלבד',
};

// Monochrome PNGs (transparent background) replacing the old colorful
// emoji icons, for a consistent, professional look across every item.
// Reports/Tasks/My Activity have no matching icon file yet, so they keep
// their existing emoji glyphs unchanged for now.
//
// Rendered as a solid-color span masked by the PNG's shape, not a plain
// <img> — a raster image can't be recolored via CSS `color`/currentColor
// the way the old inline SVGs were, and the icon needs to change color
// independently of the label text (neutral by default, orange only on
// hover/active — see .sidebar__nav-icon-img in layout.css).
function NavIcon({ src }: { src: string }) {
  return (
    <span
      className="sidebar__nav-icon-img"
      style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
      aria-hidden="true"
    />
  );
}

// Plain-glyph icons (no matching PNG file yet) — still need their own
// element, same as NavIcon above: left as bare characters, they'd just
// inherit .sidebar__nav-item's own `color`, which is intentionally pinned
// to a neutral shade in both the hover and active states (so the label
// text never turns orange) — meaning the glyph would silently inherit
// that same neutral color instead of turning orange like every other
// icon. Wrapping it decouples its color from the label's.
function NavGlyph({ children }: { children: ReactNode }) {
  return (
    <span className="sidebar__nav-icon-glyph" aria-hidden="true">
      {children}
    </span>
  );
}

const HOME_ICON = <NavIcon src="/icons/home.png" />;
const MACHINE_ICON = <NavIcon src="/icons/vending-machine.png" />;
const EMPLOYEE_ICON = <NavIcon src="/icons/employee.png" />;
const INVENTORY_ICON = <NavIcon src="/icons/harvest.png" />;

const MANAGER_NAV_ITEMS: NavItem[] = [
  { icon: HOME_ICON, label: 'ראשי', path: '/dashboard' },
  { icon: MACHINE_ICON, label: 'מכונות', path: '/machines' },
  { icon: EMPLOYEE_ICON, label: 'עובדים', path: '/employees' },
  { icon: INVENTORY_ICON, label: 'מלאי', path: '/inventory' },
  { icon: <NavGlyph>☰</NavGlyph>, label: 'דוחות', path: '/reports' },
  { icon: <NavGlyph>✓</NavGlyph>, label: 'משימות', path: '/tasks' },
];

const EMPLOYEE_NAV_ITEMS: NavItem[] = [
  { icon: MACHINE_ICON, label: 'מכונות', path: '/my-machines' },
  { icon: INVENTORY_ICON, label: 'מלאי', path: '/inventory' },
  { icon: <NavGlyph>✓</NavGlyph>, label: 'המשימות שלי', path: '/my-tasks' },
  { icon: <NavGlyph>📋</NavGlyph>, label: 'הפעילות שלי', path: '/my-activity' },
];

// Path-prefix match so sub-routes (e.g. /machines/:id, /machines/:id/report-malfunction)
// keep their parent nav item highlighted, without accidentally matching an
// unrelated route that merely starts with the same string.
function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function Sidebar({
  open,
  onClose,
  userRole,
  collapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
  onLogout,
}: Props) {
  const location = useLocation();
  // Preview is a read-only stand-in for the manager view, so it gets
  // the same nav items — every one of its actions is blocked further
  // downstream (RLS/RPC guards + frontend mutation guards), not here.
  const navItems = userRole === 'manager' || userRole === 'preview' ? MANAGER_NAV_ITEMS : EMPLOYEE_NAV_ITEMS;

  return (
    <aside
      className={`sidebar${open ? ' open' : ''}${collapsed ? ' sidebar--collapsed' : ''}`}
      aria-label="תפריט ניווט צדדי"
    >
      <div className="sidebar__header">
        <Link to="/" className="sidebar__logo" onClick={onClose}>
          <img src="/logos/oboost-logo-transparent.png" alt="OBoost" />
        </Link>
        <button
          type="button"
          className="sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'הרחבת סרגל הצד' : 'כיווץ סרגל הצד'}
          aria-pressed={collapsed}
          title={collapsed ? 'הרחבת סרגל הצד' : 'כיווץ סרגל הצד'}
        >
          {collapsed ? '«' : '»'}
        </button>
      </div>

      <p className="sidebar__section-label">תפעול</p>

      <nav className="sidebar__nav">
        {navItems.map(item => {
          const active = isActivePath(location.pathname, item.path);
          return (
          <Link
            key={item.label}
            to={item.path}
            className={`sidebar__nav-item${active ? ' active' : ''}`}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span className="sidebar__nav-label">{item.label}</span>
          </Link>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__footer-row">
          <div className="topbar__role-badge">
            <span className="topbar__role-dot" />
            <span className="sidebar__footer-label">{ROLE_LABEL[userRole]}</span>
          </div>
          <button
            type="button"
            className="topbar__theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            title={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        {onLogout && (
          <button className="topbar__logout sidebar__footer-logout" onClick={onLogout}>
            <span className="sidebar__footer-label">התנתקות</span>
          </button>
        )}
      </div>
    </aside>
  );
}
