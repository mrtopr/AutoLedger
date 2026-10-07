'use client';

import React from 'react';
import { useLanguage } from '@/app/context/LanguageContext';

interface ModernLoaderProps {
  title?: string;
  subtitle?: string;
  fullscreen?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showProgress?: boolean;
  variant?: 'wheel' | 'turbo' | 'minimal';
}

/**
 * Enhanced Precision Automotive Wheel & Telemetry Loader
 * Features a sport alloy wheel with cross-drilled brake rotor, caliper,
 * precision spoke aerodynamics, and ambient engine glow.
 */
export default function ModernLoader({
  title,
  subtitle,
  fullscreen = false,
  size = 'md',
  showProgress = false,
  variant = 'wheel',
}: ModernLoaderProps) {
  const { language } = useLanguage();

  const defaultTitle = language === 'hi' ? 'लोड हो रहा है...' : 'Loading...';

  const dimensions = {
    xs: { box: 'w-4 h-4', svg: 18, text: 'text-[10px]', gap: 'gap-1' },
    sm: { box: 'w-7 h-7', svg: 28, text: 'text-xs', gap: 'gap-1.5' },
    md: { box: 'w-12 h-12', svg: 48, text: 'text-xs', gap: 'gap-2' },
    lg: { box: 'w-16 h-16', svg: 64, text: 'text-sm', gap: 'gap-3' },
    xl: { box: 'w-20 h-20', svg: 80, text: 'text-base', gap: 'gap-3.5' },
  }[size];

  const wheelGraphic = (
    <div className={`relative ${dimensions.box} flex items-center justify-center select-none`}>
      {/* Outer ambient glow */}
      <div className="absolute inset-0 rounded-full bg-red-600/15 blur-md scale-110 pointer-events-none animate-pulse" />

      {/* Static Brake Caliper Accent (Stationary on Top-Right) */}
      {size !== 'xs' && (
        <div className="absolute top-0 right-0 z-10 pointer-events-none transform translate-x-[10%] -translate-y-[5%]">
          <div className="w-[30%] h-[40%] bg-gradient-to-br from-red-600 to-red-700 rounded-xs border border-red-500/80 shadow-2xs flex items-center justify-center">
            <span className="text-[4px] font-mono font-black text-white/90 tracking-tighter scale-75">HD</span>
          </div>
        </div>
      )}

      {/* Spinning Automotive Assembly */}
      <svg
        className="w-full h-full animate-spin text-[#C81E1E] origin-center will-change-transform"
        style={{
          animationDuration: size === 'xs' ? '0.65s' : '0.85s',
          animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="hondaRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id="metalDisc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
        </defs>

        {/* Outer Tire Tread Ring */}
        <circle cx="32" cy="32" r="30" stroke="#0F172A" strokeWidth="2.5" />
        <circle
          cx="32"
          cy="32"
          r="29.5"
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.6"
        />

        {/* Outer Alloy Rim Lip */}
        <circle cx="32" cy="32" r="27" stroke="#94A3B8" strokeWidth="1.5" />
        
        {/* Dynamic Velocity Grip Arc */}
        <circle
          cx="32"
          cy="32"
          r="27"
          stroke="url(#hondaRed)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="45 125"
        />

        {/* Cross-drilled Brake Rotor Disc */}
        <circle cx="32" cy="32" r="19" fill="url(#metalDisc)" opacity="0.35" stroke="#CBD5E1" strokeWidth="0.75" />
        
        {/* Rotor Vent Holes */}
        <circle cx="32" cy="18" r="1" fill="#64748B" />
        <circle cx="32" cy="46" r="1" fill="#64748B" />
        <circle cx="18" cy="32" r="1" fill="#64748B" />
        <circle cx="46" cy="32" r="1" fill="#64748B" />
        <circle cx="22" cy="22" r="0.9" fill="#64748B" />
        <circle cx="42" cy="42" r="0.9" fill="#64748B" />
        <circle cx="22" cy="42" r="0.9" fill="#64748B" />
        <circle cx="42" cy="22" r="0.9" fill="#64748B" />

        {/* 5-Blade Aerodynamic Sport Alloy Spokes */}
        {/* Spoke 1 - Top (0 deg) */}
        <path d="M30 32L31 8H33L34 32Z" fill="url(#rimGrad)" stroke="#1E293B" strokeWidth="0.5" />
        <line x1="32" y1="32" x2="32" y2="7" stroke="url(#hondaRed)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Spoke 2 - Top Right (72 deg) */}
        <path d="M32 30L54.8 22.6L55.5 24.5L33 33Z" fill="url(#rimGrad)" stroke="#1E293B" strokeWidth="0.5" />
        <line x1="32" y1="32" x2="55.8" y2="24.3" stroke="url(#hondaRed)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Spoke 3 - Bottom Right (144 deg) */}
        <path d="M33 31L46.7 51.2L45 52.4L31 33Z" fill="url(#rimGrad)" stroke="#1E293B" strokeWidth="0.5" />
        <line x1="32" y1="32" x2="46.7" y2="52.2" stroke="url(#hondaRed)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Spoke 4 - Bottom Left (216 deg) */}
        <path d="M31 33L17.3 51.2L19 52.4L33 31Z" fill="url(#rimGrad)" stroke="#1E293B" strokeWidth="0.5" />
        <line x1="32" y1="32" x2="17.3" y2="52.2" stroke="url(#hondaRed)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Spoke 5 - Top Left (288 deg) */}
        <path d="M32 30L9.2 22.6L8.5 24.5L31 33Z" fill="url(#rimGrad)" stroke="#1E293B" strokeWidth="0.5" />
        <line x1="32" y1="32" x2="8.2" y2="24.3" stroke="url(#hondaRed)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Center Hubcap Core */}
        <circle cx="32" cy="32" r="7" fill="#0F172A" stroke="#E2E8F0" strokeWidth="1" />
        <circle cx="32" cy="32" r="4.5" fill="url(#hondaRed)" />
        <circle cx="32" cy="32" r="2" fill="#FFFFFF" />

        {/* 5 Wheel Lug Nuts */}
        <circle cx="32" cy="27" r="0.9" fill="#CBD5E1" />
        <circle cx="36.7" cy="28.5" r="0.9" fill="#CBD5E1" />
        <circle cx="35" cy="35.5" r="0.9" fill="#CBD5E1" />
        <circle cx="29" cy="35.5" r="0.9" fill="#CBD5E1" />
        <circle cx="27.3" cy="28.5" r="0.9" fill="#CBD5E1" />
      </svg>
    </div>
  );

  // Minimal inline rendering for buttons & small badges
  if (size === 'xs') {
    return wheelGraphic;
  }

  const content = (
    <div className={`flex flex-col items-center justify-center p-5 text-center select-none ${dimensions.gap}`}>
      {wheelGraphic}

      {/* Title & Telemetry */}
      {(title || defaultTitle) && (
        <div className="flex items-center gap-1.5 mt-1">
          <p className={`${dimensions.text} font-bold text-slate-800 tracking-tight`}>
            {title || defaultTitle}
          </p>
          {/* Animated 3-pulse dots */}
          <span className="flex items-center gap-0.5 ml-0.5">
            <span className="w-1 h-1 rounded-full bg-red-600 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 rounded-full bg-red-600 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 rounded-full bg-red-600 animate-bounce" />
          </span>
        </div>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
          {subtitle}
        </p>
      )}

      {/* Optional RPM / Progress Bar */}
      {showProgress && (
        <div className="w-40 h-1 bg-slate-100 rounded-full overflow-hidden mt-2 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 rounded-full animate-pulse w-full" />
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white/95 border border-slate-200/90 rounded-2xl shadow-2xl p-4 max-w-sm w-full backdrop-blur-md">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8 flex items-center justify-center animate-in fade-in duration-150">
      {content}
    </div>
  );
}
