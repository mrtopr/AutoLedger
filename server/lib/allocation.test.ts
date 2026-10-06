import { describe, it, expect } from 'vitest';
import { allocatePayment, OpenInvoice } from './allocation';

describe('Payment Allocation Engine (allocation.ts)', () => {
  const invoices: OpenInvoice[] = [
    {
      id: 'inv-1',
      number: 'INV/2026-27/00001',
      dueDate: new Date('2026-09-01'),
      balanceDue: 1800000n, // ₹18,000.00
    },
    {
      id: 'inv-2',
      number: 'INV/2026-27/00002',
      dueDate: new Date('2026-09-15'),
      balanceDue: 2500000n, // ₹25,000.00
    },
    {
      id: 'inv-3',
      number: 'INV/2026-27/00003',
      dueDate: new Date('2026-10-01'),
      balanceDue: 1000000n, // ₹10,000.00
    },
  ];

  it('should allocate payment oldest-first and clear first invoice with remainder to second invoice', () => {
    const paymentAmount = 2000000n; // ₹20,000.00
    const result = allocatePayment(paymentAmount, invoices, 'OLDEST_FIRST');

    expect(result.allocatedTotal).toBe(2000000n);
    expect(result.unallocatedAdvance).toBe(0n);
    expect(result.allocations).toHaveLength(2);
    // Clears inv-1 (₹18,000) completely
    expect(result.allocations[0]).toEqual({
      invoiceId: 'inv-1',
      amount: 1800000n,
    });
    // Allocates remaining ₹2,000 to inv-2
    expect(result.allocations[1]).toEqual({
      invoiceId: 'inv-2',
      amount: 200000n,
    });
  });

  it('should handle excess payment as unallocated advance when payment exceeds total balance', () => {
    const paymentAmount = 6000000n; // ₹60,000.00 (Total due is ₹53,000.00)
    const result = allocatePayment(paymentAmount, invoices, 'OLDEST_FIRST');

    expect(result.allocatedTotal).toBe(5300000n); // ₹53,000.00
    expect(result.unallocatedAdvance).toBe(700000n); // ₹7,000.00 advance
    expect(result.allocations).toHaveLength(3);
  });

  it('should respect manual allocation lines and cap at individual invoice balances', () => {
    const paymentAmount = 1500000n; // ₹15,000.00
    const manualLines = [
      { invoiceId: 'inv-2', amount: 1000000n }, // ₹10,000 to inv-2
      { invoiceId: 'inv-3', amount: 500000n },  // ₹5,000 to inv-3
    ];

    const result = allocatePayment(paymentAmount, invoices, 'MANUAL', manualLines);

    expect(result.allocatedTotal).toBe(1500000n);
    expect(result.unallocatedAdvance).toBe(0n);
    expect(result.allocations).toEqual([
      { invoiceId: 'inv-2', amount: 1000000n },
      { invoiceId: 'inv-3', amount: 500000n },
    ]);
  });
});
