import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canOpenHq, homeFor } from '../admin/access';

const ProtectedRoute = ({ children, allowPasswordChange = false, requiredRole = null }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c0f' }}>
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#e8b84a' }} role="status" aria-label="Loading"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user must change password
  if (user?.mustChangePassword && !allowPasswordChange) {
    // Redirect to mandatory change password page if not already there
    if (location.pathname !== '/admin/change-password-required') {
      return <Navigate to="/admin/change-password-required" replace />;
    }
  }

  // Role check. 'admin' = Faysha HQ (super administrators and roles granted an HQ area);
  // 'manager' = the FAY OS operations dashboard (managers and super administrators).
  if (requiredRole) {
    const allowed = requiredRole === 'admin' ? canOpenHq(user) : requiredRole === 'manager' ? ['manager', 'superadmin'].includes(user?.role) : user?.role === requiredRole;
    if (!allowed) {
      const home = homeFor(user);
      return <Navigate to={home && home !== location.pathname ? home : '/login'} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
