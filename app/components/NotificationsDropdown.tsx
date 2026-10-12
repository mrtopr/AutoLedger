'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Clock, 
  CheckCheck, 
  ArrowRight, 
  Boxes, 
  Users, 
  Receipt, 
  Landmark,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'LOW_STOCK' | 'OVERDUE' | 'INVOICE' | 'SETTLEMENT';
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  actionUrl: string;
  actionLabel: string;
  severity: 'warning' | 'danger' | 'info' | 'success';
  read: boolean;
}

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STOCK' | 'KHATA'>('ALL');
  const [hasUnread, setHasUnread] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch real notifications on mount and when opened
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/v1/notifications');
        if (res.ok) {
          const data = await res.json();
          if (data.notifications) {
            setNotifications(data.notifications);
            setHasUnread(data.unreadCount > 0);
          }
        }
      } catch (err) {
        console.warn('Could not load notifications:', err);
      }
    };

    fetchNotifications();
  }, []);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setHasUnread(false);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'STOCK') return n.type === 'LOW_STOCK';
    if (activeFilter === 'KHATA') return n.type === 'OVERDUE';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-md relative transition cursor-pointer ${
          isOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
        title="Notifications & Alerts"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        
        {/* Unread Alert Dot Badge */}
        {hasUnread && unreadCount > 0 && (
          <span className="w-2.5 h-2.5 rounded-full bg-[#C81E1E] absolute top-1.5 right-1.5 ring-2 ring-white animate-pulse" />
        )}
      </button>

      {/* Flyout Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl py-0 text-xs text-slate-700 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          
          {/* Header */}
          <div className="p-3.5 bg-slate-50/80 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#C81E1E] font-bold text-[10px] font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-slate-500 hover:text-[#C81E1E] transition flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1 bg-white">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('STOCK')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                activeFilter === 'STOCK'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Low Stock
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('KHATA')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                activeFilter === 'KHATA'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Khata Dues
            </button>
          </div>

          {/* List of Notifications */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1.5">
                <Sparkles className="w-6 h-6 mx-auto text-slate-300" />
                <div className="text-xs font-semibold text-slate-600">All caught up!</div>
                <div className="text-[11px] text-slate-400">No active alerts at the moment.</div>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                let IconComponent = AlertTriangle;
                let iconColor = 'text-amber-600 bg-amber-50 border-amber-200';

                if (notif.type === 'LOW_STOCK') {
                  IconComponent = Boxes;
                  iconColor = 'text-rose-600 bg-rose-50 border-rose-200';
                } else if (notif.type === 'OVERDUE') {
                  IconComponent = Users;
                  iconColor = 'text-amber-600 bg-amber-50 border-amber-200';
                } else if (notif.type === 'INVOICE') {
                  IconComponent = Receipt;
                  iconColor = 'text-blue-600 bg-blue-50 border-blue-200';
                } else if (notif.type === 'SETTLEMENT') {
                  IconComponent = Landmark;
                  iconColor = 'text-purple-600 bg-purple-50 border-purple-200';
                }

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 hover:bg-slate-50 transition flex items-start gap-3 relative ${
                      !notif.read ? 'bg-red-50/20' : ''
                    }`}
                  >
                    {/* Unread indicator bar */}
                    {!notif.read && (
                      <span className="w-1 absolute left-0 top-0 bottom-0 bg-[#C81E1E]" />
                    )}

                    <div className={`p-2 rounded-xl border shrink-0 ${iconColor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900 truncate text-xs">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium font-mono">
                          {notif.timeAgo}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="pt-1 flex items-center justify-between">
                        <Link
                          href={notif.actionUrl}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C81E1E] hover:underline"
                        >
                          <span>{notif.actionLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-2.5 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-[11px]">
            <Link
              href="/inventory"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 hover:text-slate-900 font-semibold transition"
            >
              Inventory Matrix →
            </Link>
            <Link
              href="/customers"
              onClick={() => setIsOpen(false)}
              className="text-[#C81E1E] font-bold hover:underline"
            >
              Customer Khata →
            </Link>
          </div>

        </div>
      )}
    </div>
  );
}
