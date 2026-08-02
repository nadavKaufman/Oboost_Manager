import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Machines from './pages/Machines';
import MachineDetails from './pages/MachineDetails';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import Inventory from './pages/Inventory';
import MyMachines from './pages/MyMachines';
import MyTasks from './pages/MyTasks';
import MyActivity from './pages/MyActivity';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/machines"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Machines />
              </ProtectedRoute>
            }
          />
          <Route
            path="/machines/:id"
            element={
              <ProtectedRoute>
                <MachineDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-machines"
            element={
              <ProtectedRoute>
                <MyMachines />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-tasks"
            element={
              <ProtectedRoute>
                <MyTasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-activity"
            element={
              <ProtectedRoute>
                <MyActivity />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
