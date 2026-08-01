import type { UserRole } from '../../types/machine';

interface Props {
  title: string;
  userName: string;
  userRole: UserRole;
  onMenuClick: () => void;
  onLogout?: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'Manager',
  admin: 'Admin',
  worker: 'Worker',
  employee: 'Employee',
};

export default function TopBar({ title, userName, userRole, onMenuClick, onLogout }: Props) {
  return (
    <div className="topbar">
      <div className="topbar__left">
        <button
          className="topbar__hamburger"
          aria-label="Open sidebar"
          onClick={onMenuClick}
        >
          <span />
          <span />
          <span />
        </button>
        <h1 className="topbar__title">{title}</h1>
      </div>

      <div className="topbar__right">
        <span className="topbar__user-name">{userName}</span>
        <div className="topbar__role-badge">
          <span className="topbar__role-dot" />
          {ROLE_LABEL[userRole]}
        </div>
        {onLogout && (
          <button className="topbar__logout" onClick={onLogout}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
