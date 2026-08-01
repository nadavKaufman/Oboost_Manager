import { Link, useLocation } from 'react-router-dom';
import type { UserRole } from '../../types/machine';

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
}

const ROLE_RANK: Record<UserRole, number> = {
  employee: 0,
  worker: 1,
  admin: 2,
  manager: 3,
};

const NAV_ITEMS: {
  icon: string;
  label: string;
  path: string;
  minRole?: UserRole;
}[] = [
  { icon: '▦', label: 'Overview', path: '/dashboard' },
  { icon: '⊙', label: 'Machines', path: '/dashboard' },
  { icon: '👥', label: 'Employees', path: '/dashboard', minRole: 'admin' },
  { icon: '☰', label: 'Reports', path: '/dashboard' },
];

export default function Sidebar({ open, onClose, userRole }: Props) {
  const location = useLocation();
  const userRank = ROLE_RANK[userRole];

  const visibleItems = NAV_ITEMS.filter(
    item => !item.minRole || userRank >= ROLE_RANK[item.minRole]
  );

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Sidebar">
      <div className="sidebar__header">
        <Link to="/" className="sidebar__logo" onClick={onClose}>
          <img src="/logos/oboost-logo-transparent.png" alt="OBoost" />
        </Link>
      </div>

      <p className="sidebar__section-label">Operations</p>

      <nav className="sidebar__nav">
        {visibleItems.map(item => (
          <Link
            key={item.label}
            to={item.path}
            className={`sidebar__nav-item${
              location.pathname === item.path && item.label === 'Overview'
                ? ' active'
                : ''
            }`}
            onClick={onClose}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar__footer">
        <Link to="/" className="sidebar__home-link" onClick={onClose}>
          ← Portal Home
        </Link>
      </div>
    </aside>
  );
}
