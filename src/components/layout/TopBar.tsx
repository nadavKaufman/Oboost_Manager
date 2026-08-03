import type { UserRole } from '../../types/machine';

interface Props {
  title: string;
  userName: string;
  userRole: UserRole;
  onMenuClick: () => void;
  onLogout?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'Manager',
  employee: 'Employee',
};

export default function TopBar({
  title,
  userName,
  userRole,
  onMenuClick,
  onLogout,
  theme,
  onToggleTheme,
}: Props) {
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
        {userName && <span className="topbar__user-name">{userName}</span>}
        <div className="topbar__role-badge">
          <span className="topbar__role-dot" />
          {ROLE_LABEL[userRole]}
        </div>
        <button
          type="button"
          className="topbar__theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {onLogout && (
          <button className="topbar__logout" onClick={onLogout}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
