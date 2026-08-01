import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import '../styles/layout.css';
import '../styles/dashboard.css';

const MOCK_CURRENT_USER = {
  id: 'e1',
  name: 'Eitan Levy',
  role: 'manager' as const,
};

export default function Employees() {
  const { profile } = useAuth();
  const displayName = profile?.full_name ?? MOCK_CURRENT_USER.name;
  const displayRole = profile?.role ?? MOCK_CURRENT_USER.role;

  return (
    <DashboardLayout
      title="Employees"
      currentUser={{ name: displayName, role: displayRole }}
    >
      <div className="dashboard-page">
        <div className="page-header">
          <h2 className="page-header__title">Employees</h2>
          <p className="page-header__subtitle">
            Manage staff, roles, and machine assignments.
          </p>
        </div>

        <div className="placeholder-panel">
          Employee management content will be added here.
        </div>
      </div>
    </DashboardLayout>
  );
}
