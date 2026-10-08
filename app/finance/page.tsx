'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Landmark, Users, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatPaiseToRupees } from '@/server/lib/tax';
import { useLanguage } from '@/app/context/LanguageContext';

export default function FinancePage() {
  const { t, language } = useLanguage();
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/v1/customers')
      .then(r => r.json())
      .then(d => {
        if (d.customers) setCustomers(d.customers);
      })
      .catch(console.error);
  }, []);

  const totalOutstanding = customers.reduce((sum, c) => sum + BigInt(c.balancePaise || 0), 0n);
  const totalOverdue = customers.reduce((sum, c) => sum + BigInt(c.overduePaise || 0), 0n);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[#0F172A] flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[#C81E1E]" />
            <span>Lending & Khata Credit Finance</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Client credit limits, aging analysis, and payment terms
          </p>
        </div>

        <Link
          href="/customers"
          className="h-8.5 px-3.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] font-medium text-xs rounded-xl border border-[#CBD5E1] transition inline-flex items-center gap-1.5 shadow-2xs"
        >
          <Users className="w-3.5 h-3.5 text-[#64748B]" />
          <span>Manage Customers</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Total Credit Extended
          </div>
          <div className="text-xl font-bold text-[#0F172A] font-mono mt-1">
            {formatPaiseToRupees(totalOutstanding)}
          </div>
        </div>
        <div className="bg-[#FEF2F2] border border-[#FECACA] p-4 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#B91C1C] uppercase tracking-wider">
            Total Overdue
          </div>
          <div className="text-xl font-bold text-[#B91C1C] font-mono mt-1">
            {formatPaiseToRupees(totalOverdue)}
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Active Khata Accounts
          </div>
          <div className="text-xl font-bold text-[#0F172A] font-mono mt-1">
            {customers.length} Accounts
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8F9FA] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
            Khata Accounts & Credit Limits
          </h2>
          <span className="text-[11px] text-[#64748B]">
            {customers.length} Accounts Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B] font-medium text-[11px]">
                <th className="py-2.5 px-4">{t('khata.customer_name', 'Customer / Business')}</th>
                <th className="py-2.5 px-3 font-mono">{t('khata.phone', 'Phone')}</th>
                <th className="py-2.5 px-3 text-right">{t('khata.credit_limit', 'Credit Limit')}</th>
                <th className="py-2.5 px-3 text-right">{t('khata.current_balance', 'Outstanding')}</th>
                <th className="py-2.5 px-4 text-center">{t('inv.actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#64748B]">
                    No customer accounts registered yet.
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className="hover:bg-[#F8F9FA] transition">
                    <td className="py-3 px-4 font-semibold text-[#0F172A]">{c.shopName}</td>
                    <td className="py-3 px-3 font-mono text-[#64748B]">{c.phone}</td>
                    <td className="py-3 px-3 text-right font-mono text-[#64748B]">
                      {formatPaiseToRupees(BigInt(c.creditLimitPaise || 5000000))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#0F172A]">
                      {formatPaiseToRupees(BigInt(c.balancePaise || 0))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/customers/${c.id}`}
                        className="px-2.5 py-1 bg-white hover:bg-[#F1F5F9] text-[#2563EB] rounded-lg text-[11px] font-semibold border border-[#CBD5E1] transition shadow-2xs"
                      >
                        {t('khata.view_ledger', 'Ledger')}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
