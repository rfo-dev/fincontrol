import { create } from 'zustand';
import { api, clearToken, getToken, setToken } from '../lib/api';

const ADMIN_PORTAL_KEY = 'fincontrol_admin_portal';

export type MonthCarryoverPref = {
  expenses?: boolean;
  incomes?: boolean;
};

export type MonthCarryoverPrefs = Record<string, MonthCarryoverPref>;

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  monthCarryoverPrefs?: MonthCarryoverPrefs;
}

export function monthPrefKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function readAdminPortalFlag(): boolean {
  return window.sessionStorage.getItem(ADMIN_PORTAL_KEY) === '1';
}

function setAdminPortalFlag(enabled: boolean) {
  if (enabled) {
    window.sessionStorage.setItem(ADMIN_PORTAL_KEY, '1');
  } else {
    window.sessionStorage.removeItem(ADMIN_PORTAL_KEY);
  }
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  adminPortal: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkUser: () => Promise<void>;
  enterAdminPortal: () => void;
  exitAdminPortal: () => void;
  updateMonthPreferences: (
    month: Date,
    prefs: { bringPreviousExpenses?: boolean; bringPreviousIncomes?: boolean }
  ) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  adminPortal: readAdminPortalFlag(),
  signIn: async (email: string, password: string) => {
    try {
      const data = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setAdminPortalFlag(false);
      set({ user: data.user, adminPortal: false });
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  },
  signInAdmin: async (email: string, password: string) => {
    try {
      const data = await api<{ token: string; user: AuthUser }>('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setAdminPortalFlag(true);
      set({ user: data.user, adminPortal: true });
    } catch (error) {
      console.error('Erro ao fazer login admin:', error);
      throw error;
    }
  },
  signUp: async (name: string, email: string, password: string) => {
    try {
      const data = await api<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setToken(data.token);
      setAdminPortalFlag(false);
      set({ user: data.user, adminPortal: false });
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      throw error;
    }
  },
  signOut: async () => {
    clearToken();
    setAdminPortalFlag(false);
    set({ user: null, adminPortal: false });
    window.sessionStorage.clear();
    window.location.href = '/';
  },
  checkUser: async () => {
    try {
      const token = getToken();
      if (!token) {
        set({ user: null, loading: false, adminPortal: false });
        return;
      }

      const data = await api<{ user: AuthUser }>('/api/auth/me');
      const wantsAdmin = readAdminPortalFlag();
      const canUseAdmin = data.user.role === 'admin';

      if (wantsAdmin && !canUseAdmin) {
        setAdminPortalFlag(false);
      }

      set({
        user: data.user,
        loading: false,
        adminPortal: wantsAdmin && canUseAdmin,
      });
    } catch (error) {
      console.error('Erro ao verificar usuário:', error);
      clearToken();
      setAdminPortalFlag(false);
      set({ user: null, loading: false, adminPortal: false });
    }
  },
  enterAdminPortal: () => {
    const { user } = get();
    if (user?.role !== 'admin') return;
    setAdminPortalFlag(true);
    set({ adminPortal: true });
  },
  exitAdminPortal: () => {
    setAdminPortalFlag(false);
    set({ adminPortal: false });
  },
  updateMonthPreferences: async (month, prefs) => {
    const data = await api<{ user: AuthUser }>('/api/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        year: month.getFullYear(),
        month: month.getMonth(),
        ...prefs,
      }),
    });
    set({ user: data.user });
  },
}));
