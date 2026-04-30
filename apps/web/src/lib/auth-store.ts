import { create } from 'zustand';
import { authApi, setAccessToken, type UserProfile } from './api';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Initialize from localStorage on app mount */
  init: () => Promise<void>;

  /** Login and persist tokens */
  login: (email: string, password: string) => Promise<void>;

  /** Register and persist tokens */
  register: (email: string, password: string) => Promise<void>;

  /** Logout — revoke refresh token and clear state */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  init: async () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const rt = localStorage.getItem('refreshToken');
    if (!rt) {
      set({ isLoading: false });
      return;
    }

    try {
      const tokens = await authApi.refresh(rt);
      setAccessToken(tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      const user = await authApi.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const tokens = await authApi.login(email, password);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    const user = await authApi.me();
    set({ user, isAuthenticated: true });
  },

  register: async (email, password) => {
    const tokens = await authApi.register(email, password);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    const user = await authApi.me();
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    const rt = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

    if (rt) {
      authApi.logout(rt).catch(() => {});
      localStorage.removeItem('refreshToken');
    }

    setAccessToken(null);
    set({ user: null, isAuthenticated: false });

    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  },
}));
