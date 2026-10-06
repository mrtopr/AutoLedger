/**
 * Pure Payment Allocation Engine
 * Supports OLDEST_FIRST and MANUAL strategies.
 * Invariant 1: Sum(allocations) <= payment.amount
 * Invariant 2: allocation.amount <= invoice.balanceDue
 * Invariant 3: Excess payment is captured as unallocated advance.
 */

export interface OpenInvoice {
  id: string;
  number?: string | null;
  balanceDue: bigint;
  dueDate?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface ManualAllocationLine {
  invoiceId: string;
  amount: bigint;
}

export interface AllocationResult {
  allocations: {
    invoiceId: string;
    amount: bigint;
  }[];
  allocatedTotal: bigint;
  unallocatedAdvance: bigint;
}

export function allocatePayment(
  paymentAmount: bigint,
  openInvoices: OpenInvoice[],
  strategy: 'OLDEST_FIRST' | 'MANUAL' = 'OLDEST_FIRST',
  manualLines?: ManualAllocationLine[]
): AllocationResult {
  if (paymentAmount <= 0n) {
    return {
      allocations: [],
      allocatedTotal: 0n,
      unallocatedAdvance: 0n,
    };
  }

  let remainingPayment = paymentAmount;
  let allocatedTotal = 0n;
  const allocations: { invoiceId: string; amount: bigint }[] = [];

  if (strategy === 'MANUAL' && manualLines && manualLines.length > 0) {
    for (const line of manualLines) {
      if (remainingPayment <= 0n) break;
      const targetInvoice = openInvoices.find((inv) => inv.id === line.invoiceId);
      if (!targetInvoice || targetInvoice.balanceDue <= 0n) continue;

      // Cap at invoice balance and remaining payment
      let allocateAmt = line.amount;
      if (allocateAmt > targetInvoice.balanceDue) {
        allocateAmt = targetInvoice.balanceDue;
      }
      if (allocateAmt > remainingPayment) {
        allocateAmt = remainingPayment;
      }

      if (allocateAmt > 0n) {
        allocations.push({
          invoiceId: targetInvoice.id,
          amount: allocateAmt,
        });
        remainingPayment -= allocateAmt;
        allocatedTotal += allocateAmt;
      }
    }
  } else {
    // OLDEST_FIRST strategy (Default)
    // Filter invoices with positive balance and sort by due/creation date
    const sorted = [...openInvoices]
      .filter((inv) => inv.balanceDue > 0n)
      .sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return dateA - dateB;
      });

    for (const inv of sorted) {
      if (remainingPayment <= 0n) break;

      const allocateAmt = remainingPayment >= inv.balanceDue ? inv.balanceDue : remainingPayment;

      if (allocateAmt > 0n) {
        allocations.push({
          invoiceId: inv.id,
          amount: allocateAmt,
        });
        remainingPayment -= allocateAmt;
        allocatedTotal += allocateAmt;
      }
    }
  }

  return {
    allocations,
    allocatedTotal,
    unallocatedAdvance: remainingPayment,
  };
}
