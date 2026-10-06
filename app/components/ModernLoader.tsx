'use client';

import React from 'react';
import { useLanguage } from '@/app/context/LanguageContext';

interface ModernLoaderProps {
  title?: string;
  subtitle?: string;
  fullscreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Minimal & Aesthetic Motorbike Wheel Loader
 * Features a sleek, minimalist automotive alloy wheel with smooth spin
 */
export default function ModernLoader({
  title,
  subtitle,
  fullscreen = false,
  size = 'md',
}: ModernLoaderProps) {
  const { language } = useLanguage();

  const defaultTitle = language === 'hi' ? 'लोड हो रहा है...' : 'Loading...';

  const wheelDimensions = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }[size];

  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Sleek Minimalist Motorbike Alloy Wheel Spinner */}
      <div className={`relative ${wheelDimensions} mb-3 flex items-center justify-center`}>
        {/* Spinning Minimal Alloy Wheel */}
        <svg
          className="w-full h-full animate-spin text-[#DC2626] origin-center"
          style={{ animationDuration: '0.9s', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Tire & Rim */}
          <circle
            cx="24"
            cy="24"
            r="21"
            stroke="#E2E8F0"
            strokeWidth="3"
          />
          {/* Active Grip Arc (Honda Crimson) */}
          <circle
            cx="24"
            cy="24"
            r="21"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="40 90"
          />

          {/* Inner Brake Disc / Rim Ring */}
          <circle
            cx="24"
            cy="24"
            r="13"
            stroke="#CBD5E1"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Minimal 5-Spoke Motorbike Alloy Lines */}
          <line x1="24" y1="24" x2="24" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="24" y1="24" x2="43" y2="17.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="24" y1="24" x2="35.8" y2="40.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="24" y1="24" x2="12.2" y2="40.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="24" y1="24" x2="5" y2="17.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

          {/* Center Axle Hub */}
          <circle cx="24" cy="24" r="4.5" fill="#0F172A" />
          <circle cx="24" cy="24" r="2" fill="#FFFFFF" />
        </svg>

        {/* Subtle Ambient Red Glow */}
        <div className="absolute inset-0 rounded-full bg-red-600/10 blur-sm pointer-events-none -z-10" />
      </div>

      {/* Clean, Minimal Title */}
      {(title || defaultTitle) && (
        <p className="text-xs font-semibold text-slate-700 tracking-tight">
          {title || defaultTitle}
        </p>
      )}

      {/* Optional Minimal Subtitle */}
      {subtitle && (
        <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs leading-normal">
          {subtitle}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white/95 border border-slate-200 rounded-2xl shadow-xl p-2 max-w-xs w-full">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-10 flex items-center justify-center">
      {content}
    </div>
  );
}
