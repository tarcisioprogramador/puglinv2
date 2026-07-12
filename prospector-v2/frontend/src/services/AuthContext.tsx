import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User { slug: string; email: string; nome: string }

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (email: string, senha: string, nome: string) => Promise<void>;
  logout: () => Promise<void>;
  checkUser: () => Promise<boolean>;
  tryRefresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const TK = 'prospector_token';
const RTK = 'prospector_refresh';
const BASE = '/api';

let refreshPromise: Promise<boolean> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem(TK));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem(RTK));
  const [loading, setLoading] = useState(true);

  // Exports token/refreshToken para api.ts poder usar
  (window as any).__prospectorTokens = { getToken: () => token, getRefresh: () => refreshToken, doRefresh: null };

  const doRefresh = useCallback(async (): Promise<boolean> => {
    const rt = localStorage.getItem(RTK);
    if (!rt) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      const json = await res.json();
      if (!json.success || !json.data?.accessToken) return false;
      localStorage.setItem(TK, json.data.accessToken);
      localStorage.setItem(RTK, json.data.refreshToken);
      setToken(json.data.accessToken);
      setRefreshToken(json.data.refreshToken);
      setUser(json.data.user);
      return true;
    } catch { return false; }
  }, []);

  (window as any).__prospectorTokens.doRefresh = doRefresh;

  const verifyToken = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${BASE}/auth/verify`, { headers: { 'Authorization': `Bearer ${t}` } });
      const json = await res.json();
      if (json.success) { setUser(json.data.user); return true; }
      return false;
    } catch { return false; }
  }, []);

  useEffect(() => {
    if (token) {
      verifyToken(token).then(valid => {
        if (!valid) {
          doRefresh().then(refreshed => {
            if (!refreshed) { localStorage.removeItem(TK); localStorage.removeItem(RTK); setToken(null); setRefreshToken(null); setUser(null); }
            setLoading(false);
          });
        } else setLoading(false);
      });
    } else setLoading(false);
  }, [token, verifyToken, doRefresh]);

  const login = async (email: string, senha: string) => {
    const res = await fetch(`${BASE}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,senha}) });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao fazer login');
    localStorage.setItem(TK, json.data.accessToken);
    localStorage.setItem(RTK, json.data.refreshToken);
    setToken(json.data.accessToken);
    setRefreshToken(json.data.refreshToken);
    setUser(json.data.user);
  };

  const register = async (email: string, senha: string, nome: string) => {
    const res = await fetch(`${BASE}/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,senha,nome}) });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao cadastrar');
  };

  const logout = async () => {
    const rt = localStorage.getItem(RTK);
    try { await fetch(`${BASE}/auth/logout`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({refreshToken: rt}) }); } catch {}
    localStorage.removeItem(TK); localStorage.removeItem(RTK);
    setToken(null); setRefreshToken(null); setUser(null);
  };

  const checkUser = async (): Promise<boolean> => {
    try { const res = await fetch(`${BASE}/auth/check`); const json = await res.json(); return json.success && json.data?.existeUsuario; }
    catch { return false; }
  };

  const tryRefresh = useCallback(async (): Promise<boolean> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = doRefresh().then(r => { refreshPromise = null; return r; });
    return refreshPromise;
  }, [doRefresh]);

  return (
    <AuthContext.Provider value={{ user, token, refreshToken, loading, login, register, logout, checkUser, tryRefresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
