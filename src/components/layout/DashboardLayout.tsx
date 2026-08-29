import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { UserRole } from '../../types/machine';
import { useAuth } from '../../context/AuthContext';

interface CurrentUser {
  name: string;
  role: UserRole;
}

interface Props {
  title: string;
  currentUser: CurrentUser;
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'oboost-sidebar-collapsed';
const THEME_KEY = 'oboost-theme';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function DashboardLayout({ title, currentUser, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  );
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { profile, signOut } = useAuth();

  const displayName = profile?.full_name ?? currentUser.name;
  const displayRole = (profile?.role ?? currentUser.role) as UserRole;

  function toggleSidebarCollapsed() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  function toggleTheme() {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  return (
    <div
      className={`dash-layout${sidebarCollapsed ? ' dash-layout--collapsed' : ''}`}
      data-theme={theme}
    >
      <div
        className={`dash-layout__overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={displayRole}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={signOut}
      />

      <div className="dash-layout__main">
        <TopBar
          title={title}
          userName={displayName}
          onMenuClick={() => setSidebarOpen(o => !o)}
        />
        {children}
      </div>
    </div>
  );
}
