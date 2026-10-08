'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  CheckCircle2, 
  Receipt, 
  Search, 
  Users, 
  Boxes, 
  BarChart3, 
  Landmark, 
  Zap,
  ExternalLink
} from 'lucide-react';
import ClientPortal from './ClientPortal';

interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  badge: string;
  shortcut?: string;
  description: string;
  path?: string;
  icon: React.ElementType;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    targetSelector: 'body',
    title: 'Welcome to TradeLedger',
    badge: 'Quick Tour',
    description: 'Universal B2B wholesale platform for billing, stock management, and customer ledgers.',
    icon: Sparkles,
  },
  {
    id: 'search',
    targetSelector: '[data-tour="search-bar"]',
    title: 'Global Search',
    badge: 'Search',
    shortcut: 'Ctrl + K',
    description: 'Quickly find any customer account, previous invoice, or item SKU.',
    icon: Search,
  },
  {
    id: 'new-bill',
    targetSelector: '[data-tour="new-bill-btn"]',
    title: 'POS Billing',
    badge: 'New Bill',
    shortcut: 'F2',
    description: 'Create fast sales bills for retail walk-in or customer credit accounts.',
    path: '/pos',
    icon: Receipt,
  },
  {
    id: 'customers',
    targetSelector: '[data-tour="nav-customers"]',
    title: 'Customer Directory',
    badge: 'Accounts',
    shortcut: 'C',
    description: 'Track customer balances, credit limits, payment history, and statements.',
    path: '/customers',
    icon: Users,
  },
  {
    id: 'inventory',
    targetSelector: '[data-tour="nav-inventory"]',
    title: 'Inventory & Stock',
    badge: 'Inventory',
    shortcut: 'I',
    description: 'Check stock levels, get low-stock alerts, or import full catalogs via Excel.',
    path: '/inventory',
    icon: Boxes,
  },
  {
    id: 'reports',
    targetSelector: '[data-tour="nav-reports"]',
    title: 'Reports & Analytics',
    badge: 'Reports',
    description: 'View sales registers, customer aging dues, and pre-computed GST schedules.',
    path: '/reports',
    icon: BarChart3,
  },
  {
    id: 'settlement',
    targetSelector: '[data-tour="nav-settlement"]',
    title: 'Day-End Settlement',
    badge: 'Settlement',
    description: 'Reconcile drawer cash collections and export closing entries to Tally.',
    path: '/settlement',
    icon: Landmark,
  },
];

const TOUR_STORAGE_KEY = 'tradeledger_tour_completed_v3';

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const router = useRouter();

  // Check if first-time visitor on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const hasSeenTour = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for manual tour trigger
  useEffect(() => {
    const handleStartTour = () => {
      setCurrentStepIdx(0);
      setIsOpen(true);
    };

    window.addEventListener('tradeledger:start-tour', handleStartTour);
    return () => window.removeEventListener('tradeledger:start-tour', handleStartTour);
  }, []);

  const currentStep = TOUR_STEPS[currentStepIdx];

  // Calculate target element position on step change or resize
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    const updateRect = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });

      if (currentStep.targetSelector === 'body') {
        setTargetRect(null);
        return;
      }

      const el = document.querySelector(currentStep.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const timer = setTimeout(updateRect, 100);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [isOpen, currentStepIdx, currentStep]);

  const handleNext = () => {
    if (currentStepIdx < TOUR_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const StepIcon = currentStep.icon;
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === TOUR_STEPS.length - 1;

  // Compute non-overlapping smart position and arrow attachment
  const cardWidth = Math.min(380, windowSize.width - 32);
  let cardTop = 0;
  let cardLeft = 0;
  let placement: 'center' | 'bottom' | 'right' = 'center';
  let arrowLeft = 0;
  let arrowTop = 0;

  if (targetRect) {
    const isSidebarItem = targetRect.left < 280 && targetRect.top > 50;
    
    if (isSidebarItem) {
      // Position strictly to the right of the sidebar
      placement = 'right';
      cardLeft = Math.min(windowSize.width - cardWidth - 20, targetRect.right + 20);
      cardTop = Math.max(20, Math.min(windowSize.height - 320, targetRect.top + targetRect.height / 2 - 80));
      arrowTop = Math.max(24, Math.min(220, targetRect.top + targetRect.height / 2 - cardTop));
    } else {
      // Position strictly below the target (e.g. topbar search or new bill button)
      placement = 'bottom';
      cardTop = Math.min(windowSize.height - 320, targetRect.bottom + 18);
      // Center card under the target element, bounded inside screen
      const idealLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2;
      cardLeft = Math.max(16, Math.min(windowSize.width - cardWidth - 16, idealLeft));
      // Calculate where the arrow should sit on the card's top edge to point at target center
      arrowLeft = Math.max(24, Math.min(cardWidth - 24, (targetRect.left + targetRect.width / 2) - cardLeft));
    }
  }

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[999] pointer-events-auto select-none">
        
        {/* 1. True SVG Cutout Spotlight (Transparent hole over active element) */}
        <svg className="fixed inset-0 w-full h-full pointer-events-none transition-all duration-300">
          <defs>
            <mask id="tour-cutout-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={Math.max(0, targetRect.left - 4)}
                  y={Math.max(0, targetRect.top - 4)}
                  width={targetRect.width + 8}
                  height={targetRect.height + 8}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.72)"
            mask="url(#tour-cutout-mask)"
          />
        </svg>

        {/* 2. Spotlight Red Ring around target */}
        {targetRect && (
          <div
            className="fixed rounded-lg pointer-events-none transition-all duration-300 z-[1000] border-2 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)] ring-2 ring-red-400/30"
            style={{
              top: `${Math.max(0, targetRect.top - 4)}px`,
              left: `${Math.max(0, targetRect.left - 4)}px`,
              width: `${targetRect.width + 8}px`,
              height: `${targetRect.height + 8}px`,
            }}
          />
        )}

        {/* 3. Non-Overlapping Walkthrough Card */}
        <div 
          className={`z-[1001] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] overflow-visible transition-all duration-200 ${
            placement === 'center' ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-95' : 'fixed animate-in fade-in-50'
          }`}
          style={placement !== 'center' ? {
            width: `${cardWidth}px`,
            top: `${cardTop}px`,
            left: `${cardLeft}px`,
          } : {
            width: `${cardWidth}px`,
          }}
        >
          
          {/* Crisp Arrow pointing UP (when card is below target) */}
          {placement === 'bottom' && (
            <div 
              className="absolute -top-[9px] w-4 h-4 bg-white border-t border-l border-[#E2E8F0] rotate-45 transform pointer-events-none shadow-[-2px_-2px_4px_rgba(0,0,0,0.03)]"
              style={{ left: `${arrowLeft - 8}px` }}
            />
          )}

          {/* Crisp Arrow pointing LEFT (when card is to right of sidebar) */}
          {placement === 'right' && (
            <div 
              className="absolute -left-[9px] w-4 h-4 bg-white border-b border-l border-[#E2E8F0] rotate-45 transform pointer-events-none shadow-[-2px_2px_4px_rgba(0,0,0,0.03)]"
              style={{ top: `${arrowTop - 8}px` }}
            />
          )}

          {/* Card Header Strip */}
          <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E2E8F0] rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold text-xs shadow-2xs border border-[#FEE2E2]">
                <StepIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-[#0F172A] tracking-tight">
                {currentStep.badge}
              </span>
              {currentStep.shortcut && (
                <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-white text-[#C81E1E] border border-[#CBD5E1] rounded shadow-2xs">
                  {currentStep.shortcut}
                </kbd>
              )}
            </div>

            {/* Step Counter & Skip */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold text-[#64748B]">
                {currentStepIdx + 1} of {TOUR_STEPS.length}
              </span>
              <button
                onClick={handleSkip}
                className="p-1 text-[#94A3B8] hover:text-[#0F172A] hover:bg-white rounded transition"
                title="Skip tour"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-2">
            <h3 className="text-sm font-bold text-[#0F172A] tracking-tight leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Card Footer Navigation */}
          <div className="px-4 py-2.5 bg-[#F8F9FA] border-t border-[#E2E8F0] rounded-b-xl flex items-center justify-between">
            {/* Step Progress Dots */}
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStepIdx(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStepIdx
                      ? 'w-4 bg-[#C81E1E]'
                      : idx < currentStepIdx
                      ? 'w-1.5 bg-[#94A3B8]'
                      : 'w-1.5 bg-[#CBD5E1]'
                  }`}
                  title={`Step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className="h-7 px-2.5 text-xs font-semibold text-[#475569] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md transition hover:bg-[#F8F9FA] shadow-2xs"
                >
                  Back
                </button>
              )}

              <button
                onClick={handleNext}
                className="h-7 px-3 text-xs font-semibold text-white bg-[#C81E1E] hover:bg-[#A81818] rounded-md transition flex items-center gap-1 shadow-2xs"
              >
                <span>{isLastStep ? 'Done' : 'Next'}</span>
                {isLastStep ? <CheckCircle2 className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
              </button>
            </div>
          </div>

        </div>
      </div>
    </ClientPortal>
  );
}
