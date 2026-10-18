import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

// API Base URL - use relative path in production, localhost in development
const API_URL = process.env.REACT_APP_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api'
    : 'http://localhost:5001/api');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Verify token validity (check expiration)
const verifyToken = (token) => {
  try {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Logout function
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('adminUser');
    localStorage.removeItem('authToken');
  }, []);

  // Check token validity and auto-logout if expired
  const checkTokenValidity = useCallback(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken && !verifyToken(storedToken)) {
      console.log('Token expired, logging out...');
      logout();
      return false;
    }
    return true;
  }, [logout]);

  // Check if user is logged in on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('adminUser');

    if (storedToken && storedUser && verifyToken(storedToken)) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else if (storedToken || storedUser) {
      // Clear invalid/expired data
      logout();
    }

    setLoading(false);
  }, [logout]);

  // Periodically check token validity (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      checkTokenValidity();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [checkTokenValidity]);

  const login = async (emailOrUsername, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailOrUsername, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed'
        };
      }

      if (data.success && data.token && data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          name: data.user.fullName,
          role: data.user.role,
          roleDisplayName: data.user.roleDisplayName,
          permissions: data.user.permissions,
          emailVerified: data.user.emailVerified,
          mustChangePassword: data.user.mustChangePassword,
          isPasswordTemporary: data.user.isPasswordTemporary
        };

        setUser(userData);
        setToken(data.token);
        localStorage.setItem('adminUser', JSON.stringify(userData));
        localStorage.setItem('authToken', data.token);

        return {
          success: true,
          user: userData,
          token: data.token,
          mustChangePassword: data.user.mustChangePassword
        };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  };

  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Password change failed'
        };
      }

      if (data.success) {
        // Update user state to reflect password has been changed
        const updatedUser = {
          ...user,
          mustChangePassword: false,
          isPasswordTemporary: false
        };
        setUser(updatedUser);
        localStorage.setItem('adminUser', JSON.stringify(updatedUser));

        return { success: true, message: data.message };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  };

  const hasPermission = (resource, action) => {
    if (!user || !user.permissions) return false;

    // Superadmin has all permissions
    if (user.role === 'superadmin') return true;

    return user.permissions[resource]?.[action] === true;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    changePassword,
    hasPermission,
    isAuthenticated: !!user && !!token && verifyToken(token),
    checkTokenValidity
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
