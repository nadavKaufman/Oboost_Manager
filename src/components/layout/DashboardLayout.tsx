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

export default function DashboardLayout({ title, currentUser, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();

  const displayName = profile?.full_name ?? currentUser.name;
  const displayRole = (profile?.role ?? currentUser.role) as UserRole;

  return (
    <div className="dash-layout">
      <div
        className={`dash-layout__overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={displayRole}
      />

      <div className="dash-layout__main">
        <TopBar
          title={title}
          userName={displayName}
          userRole={displayRole}
          onMenuClick={() => setSidebarOpen(o => !o)}
          onLogout={signOut}
        />
        {children}
      </div>
    </div>
  );
}
