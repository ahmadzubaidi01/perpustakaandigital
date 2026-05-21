'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { authAPI } from '@/lib/api';
import Cookies from 'js-cookie';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = Cookies.get('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await authAPI.getProfile();
        setUser(res.data.data);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [setUser, setLoading, logout]);

  return <>{children}</>;
}
