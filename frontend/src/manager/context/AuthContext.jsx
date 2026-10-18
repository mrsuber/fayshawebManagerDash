import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '../api/client';
import config from '../config';
import { useAuth as useSiteAuth } from '../../contexts/AuthContext';
import * as mock from '../mocks/data';

const AuthContext = createContext(null);

/**
 * The dashboard's view of the signed-in user. Sign-in itself is the site's (/login →
 * src/contexts/AuthContext.jsx); this adapts it to { user: { id, name, email, role }, ready, logout }
 * and sends the user back to the login page when the API answers 401.
 * In mock mode a demo user is signed in so the UI runs without a backend.
 */
export function AuthProvider({ children }) {
  const site = useSiteAuth();
  const navigate = useNavigate();

  const logout = useCallback(() => {
    site.logout();
    navigate('/login', { replace: true });
  }, [site, navigate]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const value = useMemo(() => {
    const u = site.user;
    const user = config.useMocks ? mock.user : u && { id: u.id, name: u.name, email: u.email, role: u.role };
    return { user, ready: config.useMocks || !site.loading, logout };
  }, [site.user, site.loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
