'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MobileNav from './components/MobileNav';
import ProgressBar from './components/ProgressBar';
import CommandPalette from './components/CommandPalette';
import { Loader2 } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/onboarding';

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, loading, isAuthPage, router]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center text-white">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center p-2 mb-4">
          <img src="/logo.png" alt="AutoLedger" className="w-full h-full object-contain animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex flex-col font-sans antialiased">
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
        {/* Compact Topbar (48px) */}
        <Topbar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Dashboard Content Container */}
        <main className="flex-1 p-4 sm:p-5 max-w-7xl w-full mx-auto pb-16 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
