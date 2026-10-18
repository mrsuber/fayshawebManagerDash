import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

  // Role check. 'admin' = the /admin site dashboard; 'manager' = the /manager operations dashboard.
  // Super administrators can use both.
  if (requiredRole) {
    const adminRoles = ['superadmin', 'content_manager', 'editor'];
    const allowed = {
      admin: adminRoles,
      manager: ['manager', 'superadmin'],
    }[requiredRole] || [requiredRole];

    if (!allowed.includes(user?.role)) {
      if (user?.role === 'manager') return <Navigate to="/manager" replace />;
      if (adminRoles.includes(user?.role)) return <Navigate to="/admin" replace />;
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
