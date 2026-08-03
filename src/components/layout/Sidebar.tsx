import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { UserRole } from '../../types/machine';
import MachineIcon from '../dashboard/MachineIcon';

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

// Machines icon carries the OBoost orange accent, unlike every other
// nav icon which just inherits the item's current text color.
const MANAGER_NAV_ITEMS: NavItem[] = [
  { icon: '▦', label: 'Overview', path: '/dashboard' },
  { icon: <MachineIcon className="sidebar__nav-icon--accent" />, label: 'Machines', path: '/machines' },
  { icon: '👥', label: 'Employees', path: '/employees' },
  { icon: '📦', label: 'Inventory', path: '/inventory' },
  { icon: '☰', label: 'Reports', path: '/reports' },
  { icon: '✓', label: 'Tasks', path: '/tasks' },
];

const EMPLOYEE_NAV_ITEMS: NavItem[] = [
  { icon: <MachineIcon className="sidebar__nav-icon--accent" />, label: 'Machines', path: '/my-machines' },
  { icon: '📦', label: 'Inventory', path: '/inventory' },
  { icon: '✓', label: 'My Tasks', path: '/my-tasks' },
  { icon: '📋', label: 'My Activity', path: '/my-activity' },
];

// Path-prefix match so sub-routes (e.g. /machines/:id, /machines/:id/report-malfunction)
// keep their parent nav item highlighted, without accidentally matching an
// unrelated route that merely starts with the same string.
function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

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
    </aside>
  );
}
