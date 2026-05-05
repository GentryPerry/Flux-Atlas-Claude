/**
 * AuthContext — provides the logged-in user to the whole app.
 *
 * On mount, checks the stored session token against the API.
 * Exposes: user, loading, login, signup, logout helpers.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, validate any stored token
  useEffect(() => {
    api.getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(email, password) {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  }

  async function handleSignup(email, password, betaKey) {
    const u = await api.signup(email, password, betaKey);
    setUser(u);
    return u;
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login:  handleLogin,
      signup: handleSignup,
      logout: handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
