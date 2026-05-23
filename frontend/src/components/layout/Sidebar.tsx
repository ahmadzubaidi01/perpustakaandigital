'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, useSidebarStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  BookOpen, Book, Users, School, QrCode, Bell, Settings,
  FileText, Star, History, ChevronLeft, ChevronRight, X, MapPin,
  LayoutDashboard, HandCoins, RotateCcw, Package, MessageSquare
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════
   Navigation Configuration
   ═══════════════════════════════════════════════════ */

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  roles?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Menu Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Katalog Buku', href: '/dashboard/books', icon: Book },
      { label: 'Riwayat Peminjaman', href: '/dashboard/borrowings', icon: History },
      { label: 'QR Scanner', href: '/dashboard/qr', icon: QrCode },
    ],
  },
  {
    title: 'Peminjaman',
    items: [
      { label: 'Pinjam Buku', href: '/dashboard/peminjaman/pinjam', icon: HandCoins, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
      { label: 'Pengembalian', href: '/dashboard/peminjaman/pengembalian', icon: RotateCcw, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
    ],
  },
  {
    title: 'Inventaris',
    items: [
      { label: 'QR Scanner & Stok', href: '/dashboard/inventory', icon: Package, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
    ],
  },
  {
    title: 'Kelola Data',
    items: [
      { label: 'Pengguna', href: '/dashboard/users', icon: Users, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
      { label: 'Sekolah', href: '/dashboard/schools', icon: School, roles: ['super_admin', 'regency_admin', 'district_admin'] },
      { label: 'Wilayah', href: '/dashboard/regions', icon: MapPin, roles: ['super_admin', 'regency_admin'] },
      { label: 'Kategori Buku', href: '/dashboard/categories', icon: FileText, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
      { label: 'Ulasan & Rating', href: '/dashboard/reviews', icon: Star },
    ],
  },
  {
    title: 'Komunikasi',
    items: [
      { label: 'Chat Admin', href: '/dashboard/chat', icon: MessageSquare, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { label: 'Notifikasi', href: '/dashboard/notifications', icon: Bell },
      { label: 'Pengaturan', href: '/dashboard/settings', icon: Settings, roles: ['super_admin', 'regency_admin', 'district_admin', 'school_admin'] },
    ],
  },
];

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  regency_admin: 'Admin Kabupaten',
  district_admin: 'Admin Kecamatan',
  school_admin: 'Admin Sekolah',
  student_member: 'Siswa',
};

const getDynamicRoleLabel = (u: any): string => {
  if (!u) return '';
  if (u.user_role === 'school_admin' && u.school?.school_name) {
    return `Admin ${u.school.school_name}`;
  }
  if (u.user_role === 'regency_admin' && u.regency?.regency_name) {
    return `Admin ${u.regency.regency_name}`;
  }
  if (u.user_role === 'district_admin' && u.district?.district_name) {
    return `Admin Kecamatan ${u.district.district_name}`;
  }
  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    regency_admin: 'Admin Kabupaten',
    district_admin: 'Admin Kecamatan',
    school_admin: 'Admin Sekolah',
    student_member: 'Siswa',
  };
  return roleLabels[u.user_role] || u.user_role || '';
};

/* ═══════════════════════════════════════════════════
   Sidebar Component
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   SidebarContent Component (Standalone)
   ═══════════════════════════════════════════════════ */
function SidebarContent({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { isCollapsed, toggle, setMobileOpen } = useSidebarStore();
  const userRole = user?.user_role || '';

  const collapsed = isMobile ? false : isCollapsed;

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || /^\/dashboard\/(super-admin|regency-admin|district-admin|school-admin|student)$/.test(pathname || '');
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      {/* ── Logo Header ── */}
      <div
        className={cn(
          'flex items-center border-b border-border shrink-0 transition-all duration-300',
          collapsed ? 'justify-center px-3' : 'gap-3 px-5',
        )}
        style={{ height: 'var(--topbar-height)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg shadow-indigo-500/10 shrink-0 transition-transform duration-205 hover:rotate-3">
            <BookOpen size={20} className="stroke-[2.5]" />
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-base font-bold tracking-tight text-foreground leading-tight">
                E-Pustaka
              </span>
              <span className="text-[10px] font-semibold text-primary uppercase tracking-widest leading-none mt-0.5">
                Digital Library
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── User Profile Card ── */}
      {!collapsed && user && (
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 shadow-md">
              {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {user.full_name || 'User'}
              </p>
              <span className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {getDynamicRoleLabel(user)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation List ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(userRole)
          );
          if (filteredItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              {/* Section title */}
              {!collapsed ? (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground select-none">
                  {group.title}
                </p>
              ) : (
                <div className="h-px bg-border my-3 mx-2" />
              )}

              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 outline-none select-none',
                        collapsed ? 'justify-center py-3 px-3' : 'py-2.5 px-3',
                        active
                          ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                      )}

                      <item.icon
                        size={19}
                        className={cn(
                          'shrink-0 transition-colors duration-200',
                          active
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />

                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}

                      {/* Collapsed Hover Tooltip */}
                      {collapsed && (
                        <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-slate-900 dark:bg-slate-950 text-white text-xs font-semibold px-3 py-2 rounded-lg opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl border border-slate-800 z-50 whitespace-nowrap">
                          {item.label}
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-slate-900 dark:bg-slate-950 border-l border-b border-slate-800" />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer Toggle (Desktop only) ── */}
      {!isMobile && (
        <div className="p-3 border-t border-border shrink-0">
          <button
            onClick={toggle}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold select-none',
              'text-muted-foreground hover:text-foreground hover:bg-accent',
              'transition-all duration-200 cursor-pointer bg-transparent border-none outline-none',
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span>Sembunyikan Menu</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sidebar Component
   ═══════════════════════════════════════════════════ */
export default function Sidebar() {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebarStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  if (!mounted) {
    return (
      <div className="hidden lg:block w-[260px] h-screen bg-card border-r border-border shrink-0" />
    );
  }

  return (
    <>
      {/* ── Mobile Overlay & Drawer ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Drawer panel */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-[280px] h-full flex flex-col bg-card shadow-2xl border-r border-border outline-none"
            >
              {/* Close Button */}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-3 z-50 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 cursor-pointer bg-transparent border-none active:scale-95 outline-none"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>

              <SidebarContent isMobile={true} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── Desktop Collapsible Sidebar ── */}
      <motion.aside
        animate={{
          width: isCollapsed ? 72 : 260,
        }}
        transition={{
          type: 'spring',
          damping: 26,
          stiffness: 200,
        }}
        className="hidden lg:flex flex-col h-screen sticky top-0 shrink-0 border-r border-border overflow-hidden z-20 bg-card"
      >
        <SidebarContent isMobile={false} />
      </motion.aside>
    </>
  );
}
