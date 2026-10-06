'use client';

import React from 'react';
import ModernLoader from './ModernLoader';

export default function PageSkeleton({ 
  title = "Loading Dealership Module...", 
  subtitle = "Compiling live records, stock inventory and metrics..." 
}: { 
  title?: string; 
  subtitle?: string; 
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Centered Modern Spinning Loader Card */}
      <ModernLoader title={title} subtitle={subtitle} />

      {/* Shimmering ERP Skeleton Background Grid */}
      <div className="space-y-5 animate-pulse opacity-40">
        {/* KPI Cards Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#E4E7EC] p-4 sm:p-5 rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="w-6 h-6 rounded-lg bg-slate-100" />
              </div>
              <div className="h-7 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Main Table Skeleton */}
        <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-[#E4E7EC] bg-slate-50/50 flex items-center justify-between">
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
          </div>
          <div className="p-4 divide-y divide-[#F2F4F7] space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100" />
                  <div className="space-y-1">
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-24 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-5 w-16 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
