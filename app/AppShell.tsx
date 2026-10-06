'use client';

import React, { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MobileNav from './components/MobileNav';
import ProgressBar from './components/ProgressBar';
import CommandPalette from './components/CommandPalette';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/onboarding';

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[#F5F6F8]">
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#0F172A] flex flex-col font-sans antialiased">
      {/* Top Transition Progress Bar */}
      <Suspense fallback={null}>
        <ProgressBar />
      </Suspense>

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette />

      {/* Fixed Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area (Offset for 240px Sidebar on Desktop) */}
      <div className="lg:pl-[240px] flex flex-col min-h-screen">
        {/* Slim Topbar (64px) */}
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Dashboard Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-7xl w-full mx-auto pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
