import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, getToken, setToken } from '../api';
import { setUnauthorizedHandler } from '../api/client';
import config from '../config';
import { firebaseSignInWithGoogle, firebaseSignOut } from '../lib/firebase';

const AuthContext = createContext(null);

/**
 * JWT session. Email/password goes straight to the Express API; Google sign-in goes through Firebase
 * and the Firebase ID token is exchanged for the API's own JWT. In mock mode a demo user is signed in.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    firebaseSignOut();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (config.useMocks) {
      authApi.me().then(({ user: u }) => setUser(u)).finally(() => setReady(true));
      return;
    }
    if (!getToken()) {
      setReady(true);
      return;
    }
    authApi
      .me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, [logout]);

  const accept = useCallback(({ token, user: u }) => {
    setToken(token);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      login: (email, password) => authApi.login(email, password).then(accept),
      loginWithGoogle: () => firebaseSignInWithGoogle().then((idToken) => authApi.loginWithFirebase(idToken)).then(accept),
      logout,
    }),
    [user, ready, logout, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
