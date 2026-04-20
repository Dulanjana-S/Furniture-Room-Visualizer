import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  role?: string;
};

interface AuthContextType {
  currentUser: AppUser | null;
  token: string | null;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ui3_mern_auth_v1';

function loadStored(): { token: string | null; user: AppUser | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw);
    return { token: parsed.token || null, user: parsed.user || null };
  } catch {
    return { token: null, user: null };
  }
}

function saveStored(token: string, user: AppUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

function clearStored() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = loadStored();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(stored.user);
  const [token, setToken] = useState<string | null>(stored.token);
  const [loading, setLoading] = useState(true);

  async function signup(email: string, password: string, displayName: string) {
    try {
      await api<{ ok: true; userId: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      });
      await login(email, password);
    } catch (e: any) {
      throw new Error(e?.error || 'Signup failed');
    }
  }

  async function login(email: string, password: string) {
    try {
      const data = await api<{ token: string; user: AppUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setCurrentUser(data.user);
      saveStored(data.token, data.user);
    } catch (e: any) {
      throw new Error(e?.error || 'Login failed');
    }
  }

  async function logout() {
    clearStored();
    setToken(null);
    setCurrentUser(null);
  }

  useEffect(() => {
    // restore session from localStorage only
    setLoading(false);
  }, []);

  const value: AuthContextType = {
    currentUser,
    token,
    signup,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
