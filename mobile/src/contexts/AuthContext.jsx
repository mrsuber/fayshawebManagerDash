import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { getToken, getUser, setUser as storeUser } from '../services/session';
import { setUnauthorizedHandler, errorMessage } from '../services/api';
import { unregisterPush } from '../services/push';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

/** The first name to greet the guest with. */
export const firstName = (user) => (user?.fullName || user?.full_name || user?.username || 'Guest').trim().split(/\s+/)[0];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOutLocally = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    // An expired or revoked token anywhere in the app signs the guest out.
    setUnauthorizedHandler(() => {
      signOutLocally();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOutLocally]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const saved = await getUser();
        if (saved) setUser(saved);
        // Refresh the profile in the background; keep the saved one when offline.
        try {
          const response = await authService.getCurrentUser();
          if (response.user) setUser(response.user);
        } catch (e) {
          if (e.status === 401 || e.status === 404) setUser(null);
          else if (!saved) setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await authService.login(email, password);
      if (response.success && response.user) {
        setUser(response.user);
        return { success: true, user: response.user };
      }
      return { success: false, error: response.error || 'Sign-in failed' };
    } catch (e) {
      return { success: false, error: errorMessage(e, 'Sign-in failed. Please try again.'), code: e.code, status: e.status };
    }
  }, []);

  const register = useCallback(async (details) => {
    try {
      const response = await authService.register(details);
      if (response.success && response.user) {
        setUser(response.user);
        return { success: true, user: response.user };
      }
      return { success: false, error: 'We could not create your account' };
    } catch (e) {
      return { success: false, error: errorMessage(e, 'We could not create your account. Please try again.'), code: e.code };
    }
  }, []);

  const logout = useCallback(async () => {
    await unregisterPush(); // while the token still works
    await signOutLocally();
  }, [signOutLocally]);

  const refreshUserData = useCallback(async () => {
    try {
      const response = await authService.getCurrentUser();
      if (response.user) setUser(response.user);
      return { success: true, user: response.user };
    } catch (e) {
      return { success: false, error: errorMessage(e) };
    }
  }, []);

  const updateProfile = useCallback(
    async (fields) => {
      try {
        await authService.updateProfile(fields);
        const me = await authService.getCurrentUser();
        if (me.user) setUser(me.user);
        return { success: true, user: me.user };
      } catch (e) {
        return { success: false, error: errorMessage(e, 'We could not save your details.') };
      }
    },
    [],
  );

  /** For screens that change the user locally (e.g. after a password change). */
  const patchUser = useCallback(async (changes) => {
    setUser((current) => {
      const next = current ? { ...current, ...changes } : current;
      if (next) storeUser(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), login, register, logout, updateProfile, refreshUserData, patchUser }),
    [user, loading, login, register, logout, updateProfile, refreshUserData, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
