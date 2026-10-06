import { NextRequest, NextResponse } from 'next/server';
import { allocatePayment, OpenInvoice, ManualAllocationLine } from '@/server/lib/allocation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentAmountPaise, openInvoices = [], strategy = 'OLDEST_FIRST', manualLines = [] } = body;

    const parsedInvoices: OpenInvoice[] = openInvoices.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      balanceDue: BigInt(inv.balanceDuePaise || inv.balanceDue || 0),
      dueDate: inv.dueDate,
    }));

    const parsedManualLines: ManualAllocationLine[] = manualLines.map((line: any) => ({
      invoiceId: line.invoiceId,
      amount: BigInt(line.amountPaise || line.amount || 0),
    }));

    const result = allocatePayment(
      BigInt(paymentAmountPaise || 0),
      parsedInvoices,
      strategy,
      parsedManualLines
    );

    return NextResponse.json({
      success: true,
      data: {
        allocatedTotal: result.allocatedTotal.toString(),
        unallocatedAdvance: result.unallocatedAdvance.toString(),
        allocations: result.allocations.map((a) => ({
          invoiceId: a.invoiceId,
          amount: a.amount.toString(),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: 'ALLOCATION_FAILED',
          message: error.message || 'Failed to allocate payment',
        },
      },
      { status: 400 }
    );
  }
}
