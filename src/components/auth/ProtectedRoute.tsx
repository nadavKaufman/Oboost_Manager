import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/machine';
import type { ReactNode } from 'react';
import LoadingScreen from '../layout/LoadingScreen';

interface Props {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return <Navigate to={profile?.role === 'manager' || profile?.role === 'preview' ? '/dashboard' : '/my-machines'} replace />;
  }
  return <>{children}</>;
}
