'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Trigger loading animation on route or query change
  useEffect(() => {
    setLoading(true);
    setProgress(30);

    const t1 = setTimeout(() => {
      setProgress(75);
    }, 100);

    const t2 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
    }, 250);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname, searchParams]);

  // Intercept all internal clicks on <a> tags to immediately start progress animation
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target && target.href && target.href.startsWith(window.location.origin) && !target.target && !e.ctrlKey && !e.metaKey) {
        if (target.pathname !== window.location.pathname || target.search !== window.location.search) {
          setLoading(true);
          setProgress(40);
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 pointer-events-none h-1 bg-transparent">
      <div 
        className="h-full bg-linear-to-r from-[#E60012] via-[#1570EF] to-[#12B76A] shadow-md transition-all duration-200 ease-out"
        style={{ 
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
