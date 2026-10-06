'use client';

import React, { useState, useEffect } from 'react';
import { HondaWingIcon } from './HondaLogo';
import { useLanguage } from '@/app/context/LanguageContext';
import { Activity, Database, ShieldCheck, Zap, Gauge } from 'lucide-react';

interface ModernLoaderProps {
  title?: string;
  subtitle?: string;
  fullscreen?: boolean;
}

export default function ModernLoader({
  title,
  subtitle,
  fullscreen = false,
}: ModernLoaderProps) {
  const { language } = useLanguage();
  const [telemetryStage, setTelemetryStage] = useState(0);

  const stagesEn = [
    { text: 'Syncing live Postgres database...', icon: Database },
    { text: 'Indexing spare parts & OEM stock...', icon: Zap },
    { text: 'Auditing garage khata & ledgers...', icon: ShieldCheck },
    { text: 'Engine ignition & telemetry ready...', icon: Activity },
  ];

  const stagesHi = [
    { text: 'लाइव डेटाबेस से डेटा सिंक हो रहा है...', icon: Database },
    { text: 'स्पेयर पार्ट्स एवं स्टॉक इंडेक्सिंग...', icon: Zap },
    { text: 'गैराज खाता बही एवं लेजर ऑडिट...', icon: ShieldCheck },
    { text: 'सिस्टम तैयार हो रहा है...', icon: Activity },
  ];

  const stages = language === 'hi' ? stagesHi : stagesEn;

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryStage((prev) => (prev + 1) % stages.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [stages.length]);

  const CurrentIcon = stages[telemetryStage].icon;

  const displayTitle = title || (language === 'hi' ? 'ऑटोलेजर सिस्टम लोड हो रहा है...' : 'Starting AutoLedger Engine...');
  const displaySubtitle = subtitle || (language === 'hi' ? 'लाइव स्टॉक, बिलिंग और खाता विवरण तैयार किया जा रहा है...' : "Calibrating live telemetry, stock valuation & khata ledgers...");

  const content = (
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-center select-none relative overflow-hidden">
      
      {/* Background Subtle Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-tr from-red-600/10 via-amber-500/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. UNIQUE AUTOMOTIVE TACHOMETER / RPM PULSE GAUGE */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center mb-6">
        
        {/* Outer Circular Tachometer Dial Ring with Dash Ticks */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Background Track */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="5"
          />
          
          {/* Outer Tick Marks */}
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="1.5"
            strokeDasharray="2 6"
            className="opacity-70"
          />

          {/* High-Octane Sweeping Tachometer Arc */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="url(#rpmGradient)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray="260"
            strokeDashoffset="75"
            className="animate-[spin_2.4s_cubic-bezier(0.4,0,0.2,1)_infinite] origin-center"
          />

          {/* Gradient Definition */}
          <defs>
            <linearGradient id="rpmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="85%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
        </svg>

        {/* Orbiting Photon Satellite Light */}
        <div className="absolute inset-0 animate-[spin_1.8s_linear_infinite]">
          <div className="w-3 h-3 bg-red-600 rounded-full shadow-[0_0_12px_#DC2626] -translate-x-1.5 translate-y-2" />
        </div>

        {/* Inner Counter-Rotating Holographic Ring */}
        <div className="absolute inset-3 rounded-full border border-dashed border-red-500/30 animate-[spin_6s_linear_infinite_reverse]" />

        {/* Central Engine Core Pod */}
        <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0B0F19] to-slate-950 p-0.5 shadow-xl shadow-red-950/20 flex items-center justify-center border border-slate-700/60 group">
          
          {/* Core Pulsing Honda Crimson Backlight */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-600/30 to-amber-600/10 animate-pulse" />

          {/* Precision Honda Wing Emblem */}
          <div className="relative flex flex-col items-center justify-center">
            <HondaWingIcon className="w-8 h-8 text-white drop-shadow-[0_2px_8px_rgba(220,38,38,0.8)] animate-pulse" color="#FFFFFF" />
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[7px] font-mono font-bold tracking-widest text-slate-300">RPM</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. DYNAMIC TITLE & SUBTITLE */}
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
          <span>{displayTitle}</span>
          <span className="inline-flex gap-1 items-center ml-0.5">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        </h3>
        
        <p className="text-xs text-slate-500 leading-relaxed font-normal">
          {displaySubtitle}
        </p>
      </div>

      {/* 3. LIVE ROTATING TELEMETRY CHIP */}
      <div className="mt-4 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-full flex items-center gap-2 shadow-2xs transition-all duration-300">
        <CurrentIcon className="w-3.5 h-3.5 text-red-600 animate-spin [animation-duration:3s]" />
        <span className="text-[11px] font-mono font-semibold text-slate-700 animate-in fade-in duration-300">
          {stages[telemetryStage].text}
        </span>
      </div>

      {/* 4. SPEEDOMETER LASER FUEL BAR */}
      <div className="mt-5 w-44 h-1.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/60 p-0.5">
        <div className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-blue-600 rounded-full animate-[shimmer_1.4s_cubic-bezier(0.4,0,0.6,1)_infinite] w-2/3" />
      </div>

    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white/95 border border-slate-200/80 rounded-3xl shadow-2xl max-w-md w-full">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[360px] flex items-center justify-center bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
      {content}
    </div>
  );
}

