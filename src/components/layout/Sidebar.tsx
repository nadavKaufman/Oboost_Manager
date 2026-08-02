import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserRole } from '../../types/machine';

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  icon: ReactNode;
  label: string;
  path: string;
}

// Simple flat vending-machine glyph for the Machines / My Machines nav items.
// Uses currentColor so it inherits the nav item's text color (hover/active/dark-mode).
function MachineIcon() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="1.25" width="10" height="13.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="5" y="3.25" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="6.2" cy="10.4" r="0.85" fill="currentColor" />
      <circle cx="9.8" cy="10.4" r="0.85" fill="currentColor" />
      <rect x="5.5" y="12.2" width="5" height="1.2" rx="0.4" fill="currentColor" />
    </svg>
  );
}

const MANAGER_NAV_ITEMS: NavItem[] = [
  { icon: '▦', label: 'Overview', path: '/dashboard' },
  { icon: <MachineIcon />, label: 'Machines', path: '/machines' },
  { icon: '👥', label: 'Employees', path: '/employees' },
  { icon: '📦', label: 'Inventory', path: '/inventory' },
  { icon: '☰', label: 'Reports', path: '/reports' },
  { icon: '✓', label: 'Tasks', path: '/tasks' },
];

const EMPLOYEE_NAV_ITEMS: NavItem[] = [
  { icon: <MachineIcon />, label: 'My Machines', path: '/my-machines' },
  { icon: '📦', label: 'Inventory', path: '/inventory' },
  { icon: '✓', label: 'My Tasks', path: '/my-tasks' },
  { icon: '📋', label: 'My Activity', path: '/my-activity' },
];

export default function Sidebar({ open, onClose, userRole, collapsed, onToggleCollapse }: Props) {
  const location = useLocation();
  const navItems = userRole === 'manager' ? MANAGER_NAV_ITEMS : EMPLOYEE_NAV_ITEMS;

  return (
    <aside
      className={`sidebar${open ? ' open' : ''}${collapsed ? ' sidebar--collapsed' : ''}`}
      aria-label="Sidebar"
    >
      <div className="sidebar__header">
        <Link to="/" className="sidebar__logo" onClick={onClose}>
          <img src="/logos/oboost-logo-transparent.png" alt="OBoost" />
        </Link>
        <button
          type="button"
          className="sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <p className="sidebar__section-label">Operations</p>

      <nav className="sidebar__nav">
        {navItems.map(item => (
          <Link
            key={item.label}
            to={item.path}
            className={`sidebar__nav-item${
              location.pathname === item.path ? ' active' : ''
            }`}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            aria-current={location.pathname === item.path ? 'page' : undefined}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span className="sidebar__nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
