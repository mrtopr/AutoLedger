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
      {/* Centered Minimal Spinning Motorbike Wheel Loader */}
      <ModernLoader title={title} subtitle={subtitle} />

      {/* Subtle Shimmering Skeleton Background */}
      <div className="space-y-5 animate-pulse opacity-30">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200 p-4 sm:p-5 rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 bg-slate-200 rounded" />
                <div className="w-5 h-5 rounded-lg bg-slate-100" />
              </div>
              <div className="h-6 w-28 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
