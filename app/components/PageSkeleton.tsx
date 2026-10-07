'use client';

import React from 'react';
import ModernLoader from './ModernLoader';

export default function PageSkeleton({ 
  title = "Loading...", 
  subtitle 
}: { 
  title?: string; 
  subtitle?: string; 
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Centered Precision Automotive Wheel Loader */}
      <ModernLoader title={title} subtitle={subtitle} size="md" showProgress={true} />

      {/* Structured Dashboard & ERP Surface Skeleton */}
      <div className="space-y-4 opacity-40 select-none pointer-events-none">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="w-5 h-5 rounded-md bg-slate-100" />
              </div>
              <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-2.5 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        {/* Content Table / Card Skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
            <div className="h-7 w-20 bg-slate-100 rounded-lg" />
          </div>
          <div className="space-y-2.5">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between py-2 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100" />
                  <div className="space-y-1">
                    <div className="h-3.5 w-40 bg-slate-200 rounded animate-pulse" />
                    <div className="h-2.5 w-24 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
