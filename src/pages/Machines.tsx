import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import '../styles/layout.css';
import '../styles/dashboard.css';

const MOCK_CURRENT_USER = {
  id: 'e1',
  name: 'Eitan Levy',
  role: 'manager' as const,
};

export default function Machines() {
  const { profile } = useAuth();
  const displayName = profile?.full_name ?? MOCK_CURRENT_USER.name;
  const displayRole = profile?.role ?? MOCK_CURRENT_USER.role;

  return (
    <DashboardLayout
      title="Machines"
      currentUser={{ name: displayName, role: displayRole }}
    >
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">Machines</h2>
          <p className="page-header__subtitle">
            Manage and monitor all OBoost machines.
          </p>
        </div>

        <div className="placeholder-panel">
          Machine management content will be added here.
        </div>
      </div>
    </DashboardLayout>
  );
}
