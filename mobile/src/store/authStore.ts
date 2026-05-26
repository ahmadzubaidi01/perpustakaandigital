import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface User {
  user_id: number;
  full_name: string;
  email_address: string;
  user_role: string;
  account_status: string;
  profile_photo_url: string | null;
  phone_number: string | null;
  student_id_number: string | null;
  class_name: string | null;
  member_qr_uuid: string | null;
  school_id: number | null;
  regency_id?: number | null;
  district_id?: number | null;
  school?: { school_id: number; school_name: string } | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
    if (user) {
      SecureStore.setItemAsync('user_profile', JSON.stringify(user)).catch(() => {});
    } else {
      SecureStore.deleteItemAsync('user_profile').catch(() => {});
    }
  },
  setLoading: (isLoading) => set({ isLoading }),

  login: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    await SecureStore.setItemAsync('user_profile', JSON.stringify(user));
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_profile');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const profileStr = await SecureStore.getItemAsync('user_profile');
      
      if (token && profileStr) {
        const user = JSON.parse(profileStr);
        set({ user, isAuthenticated: true, isLoading: false });
        console.log('[AuthStore] Session hydrated successfully from SecureStore');
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn('[AuthStore] Failed to hydrate session:', err);
      set({ isLoading: false });
    }
  },
}));
