import { NextRequest, NextResponse } from 'next/server';
import { calculateInvoiceTax, LineItemInput } from '@/server/lib/tax';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, tenantStateCode = '27', placeOfSupplyStateCode = '27', discountPaise = '0' } = body;

    const parsedItems: LineItemInput[] = (items || []).map((item: any) => ({
      qty: parseFloat(item.qty) || 1,
      rate: BigInt(item.ratePaise || item.rate || 0),
      discountPaise: item.discountPaise ? BigInt(item.discountPaise) : 0n,
      discountPercent: item.discountPercent ? parseFloat(item.discountPercent) : 0,
      gstRateBp: parseInt(item.gstRateBp) || 1800,
      isTaxInclusive: Boolean(item.isTaxInclusive),
    }));

    const result = calculateInvoiceTax(
      parsedItems,
      tenantStateCode,
      placeOfSupplyStateCode,
      BigInt(discountPaise)
    );

    // Convert bigints to string for JSON serialization
    return NextResponse.json({
      success: true,
      data: {
        subtotal: result.subtotal.toString(),
        discountTotal: result.discountTotal.toString(),
        taxableValue: result.taxableValue.toString(),
        cgst: result.cgst.toString(),
        sgst: result.sgst.toString(),
        igst: result.igst.toString(),
        totalTax: result.totalTax.toString(),
        roundOff: result.roundOff.toString(),
        grandTotal: result.grandTotal.toString(),
        items: result.items.map((i) => ({
          qty: i.qty,
          rate: i.rate.toString(),
          discount: i.discount.toString(),
          taxableValue: i.taxableValue.toString(),
          gstRateBp: i.gstRateBp,
          cgst: i.cgst.toString(),
          sgst: i.sgst.toString(),
          igst: i.igst.toString(),
          taxAmount: i.taxAmount.toString(),
          lineTotal: i.lineTotal.toString(),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message || 'Failed to calculate taxes',
        },
      },
      { status: 400 }
    );
  }
}
