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
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#172033]">
          {language === 'hi' ? 'उधार खाता एवं वित्तीय प्रबंधन' : 'Lending & Khata Credit Finance'}
        </h1>
        <p className="text-xs sm:text-sm text-[#667085] mt-0.5">
          {language === 'hi' ? 'गैराज क्रेडिट लिमिट, बकाया राशि और समय सीमा विश्लेषण' : 'Garage credit limits, aging analysis, and interest terms'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">
            {language === 'hi' ? 'कुल दिया गया उधार' : 'Total Credit Extended'}
          </div>
          <div className="text-xl font-bold text-[#172033] font-mono-numeric mt-2">
            {formatPaiseToRupees(totalOutstanding)}
          </div>
        </div>
        <div className="bg-white border border-rose-200 p-4 rounded-xl shadow-2xs bg-rose-50/20">
          <div className="text-xs font-semibold text-rose-700">
            {language === 'hi' ? 'कुल अतिदेय / पुराना बकाया' : 'Total Overdue'}
          </div>
          <div className="text-xl font-bold text-rose-700 font-mono-numeric mt-2">
            {formatPaiseToRupees(totalOverdue)}
          </div>
        </div>
        <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-2xs">
          <div className="text-xs font-semibold text-[#667085]">
            {language === 'hi' ? 'सक्रिय खाताधारक गैराज' : 'Active Khata Accounts'}
          </div>
          <div className="text-xl font-bold text-[#172033] font-mono-numeric mt-2">
            {customers.length} {language === 'hi' ? 'गैराज' : 'Garages'}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-[#E4E7EC] bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
            {language === 'hi' ? 'खाता विवरण व क्रेडिट लिमिट' : 'Khata Accounts & Credit Limits'}
          </h2>
          <Link href="/customers" className="text-xs font-semibold text-blue-600 hover:underline">
            {language === 'hi' ? 'ग्राहक प्रबंधित करें' : 'Manage Customers'}
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F7F8FA] text-[#667085] font-semibold">
                <th className="py-2.5 px-4">{t('khata.customer_name', 'Garage / Shop')}</th>
                <th className="py-2.5 px-3 font-mono">{t('khata.phone', 'Phone')}</th>
                <th className="py-2.5 px-3 text-right">{t('khata.credit_limit', 'Credit Limit')}</th>
                <th className="py-2.5 px-3 text-right">{t('khata.current_balance', 'Outstanding')}</th>
                <th className="py-2.5 px-4 text-center">{t('inv.actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#667085]">
                    {language === 'hi' ? 'अभी तक कोई गैराज खाता दर्ज नहीं है।' : 'No garage accounts registered yet.'}
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-[#172033]">{c.shopName}</td>
                    <td className="py-3 px-3 font-mono text-[#667085]">{c.phone}</td>
                    <td className="py-3 px-3 text-right font-mono text-[#667085]">
                      {formatPaiseToRupees(BigInt(c.creditLimitPaise || 5000000))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatPaiseToRupees(BigInt(c.balancePaise || 0))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/customers/${c.id}`}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold border border-blue-200"
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
