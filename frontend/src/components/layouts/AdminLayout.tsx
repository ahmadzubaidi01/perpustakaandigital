'use client';

import React from 'react';
import Sidebar from '../layout/Sidebar';
import Topbar from '../layout/Topbar';
import { useSidebarStore } from '@/lib/store';

export interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { isMobileOpen } = useSidebarStore();

  return (
    <div
      id="AdminLayout"
      className="flex min-h-screen bg-background text-foreground transition-colors duration-300"
    >
      {/* ── Sidebar — Desktop collapsible & mobile drawer ── */}
      <div
        id="ResponsiveSidebar"
        className={`shrink-0 ${isMobileOpen ? 'z-50 relative' : 'z-20'}`}
      >
        <Sidebar />
      </div>

      {/* ── Main Content Area ── */}
      <div
        id="ContentWrapper"
        className="flex-1 flex flex-col min-w-0 overflow-x-hidden"
      >
        {/* Top navigation bar */}
        <div id="TopNavbar" className="shrink-0 sticky top-0 z-30">
          <Topbar />
        </div>

        {/* Scrollable content viewport */}
        <main
          id="DashboardContainer"
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          {/* Max-width centered page container */}
          <div
            id="PageContainer"
            className="dashboard-container page-max-width py-6 md:py-8 animate-fade-in"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
