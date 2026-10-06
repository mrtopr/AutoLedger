'use client';

import React from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { Languages } from 'lucide-react';

export default function LanguageToggle({ className = '', variant = 'pill' }: { className?: string; variant?: 'pill' | 'compact' | 'sidebar' }) {
  const { language, setLanguage, toggleLanguage } = useLanguage();

  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggleLanguage}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 ${className}`}
        title="Toggle English / हिन्दी"
      >
        <div className="flex items-center gap-2">
          <Languages className="w-3.5 h-3.5 text-amber-400" />
          <span>भाषा / Language</span>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono">
          {language === 'hi' ? 'हिन्दी' : 'EN'}
        </span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleLanguage}
        className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-medium text-slate-700 ${className}`}
        title="Switch Language / भाषा बदलें"
      >
        <Languages className="w-4 h-4 text-slate-600" />
        <span className="font-bold text-[11px]">{language === 'hi' ? 'हिन्दी' : 'EN'}</span>
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center rounded-lg p-0.5 bg-slate-100 border border-slate-200/80 ${className}`}>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
          language === 'en'
            ? 'bg-white text-slate-900 shadow-2xs'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
          language === 'hi'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        हिन्दी
      </button>
    </div>
  );
}
