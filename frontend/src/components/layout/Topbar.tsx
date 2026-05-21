'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore, useSidebarStore } from '@/lib/store';
import { authAPI } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Cookies from 'js-cookie';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { setMobileOpen } = useSidebarStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = Cookies.get('refresh_token');
      await authAPI.logout(refreshToken);
    } catch { /* ignore */ }
    logout();
    toast.success('Berhasil keluar');
    router.push('/login');
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 shrink-0 glassmorphism border-b border-border transition-all duration-300"
      style={{ height: 'var(--topbar-height)' }}
    >
      {/* Left: sidebar toggle (mobile only) */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 cursor-pointer bg-transparent border-none active:scale-95 outline-none"
          onClick={() => setMobileOpen(true)}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <Link
          href="/dashboard/notifications"
          className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 flex items-center justify-center"
          aria-label="Notifikasi"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse-glow ring-2 ring-card" />
        </Link>

        {/* Profile dropdown */}
        <div className="relative ml-1" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-secondary transition-all duration-200 cursor-pointer bg-transparent text-foreground border-none active:scale-[0.98] outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-muted-foreground max-w-[120px] truncate">
              {user?.full_name || 'User'}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                'text-muted-foreground transition-transform duration-200',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl py-1.5 bg-card border border-border shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {user?.email_address || ''}
                </p>
              </div>
              <Link
                href="/dashboard/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150"
              >
                Profil Saya
              </Link>
              <div className="h-px bg-border mx-2" />
              <button
                onClick={() => { setDropdownOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer bg-transparent border-none text-left"
              >
                <LogOut size={16} />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
