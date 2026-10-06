import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { createPaymentLink } from '@/server/lib/razorpay';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();

    const {
      amountPaise,
      amountRupees: inputRupees,
      customerId,
      invoiceId,
      customerName = 'Customer',
      customerPhone = '',
      description = 'AutoLedger Spares Payment',
    } = body;

    const finalAmountPaise = amountPaise 
      ? Number(amountPaise) 
      : inputRupees 
      ? Math.round(parseFloat(inputRupees) * 100) 
      : 0;

    if (!finalAmountPaise || finalAmountPaise <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount is required' },
        { status: 400 }
      );
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-default';
    const showroomName = authUser?.tenant?.name || 'AutoLedger Spares';

    // 1. Generate Razorpay Link
    const linkResult = await createPaymentLink({
      amountPaise: finalAmountPaise,
      description: `${showroomName} - ${description}`,
      customer: {
        name: customerName,
        contact: customerPhone || '9822100001',
      },
      tenantId: targetTenantId,
      customerId: customerId || undefined,
      invoiceId: invoiceId || undefined,
    });

    // 2. Build WhatsApp Shareable Text & URL
    const formattedRupees = (finalAmountPaise / 100).toLocaleString('en-IN');
    const whatsappMsg =
      `*PAYMENT REQUEST - ${showroomName.toUpperCase()}*\n` +
      `--------------------------------\n` +
      `Dear ${customerName},\n` +
      `Please complete your payment of *₹${formattedRupees}* using the secure link below:\n\n` +
      `🔗 *Pay Online:* ${linkResult.shortUrl}\n\n` +
      `*(Supports Google Pay, PhonePe, Paytm, UPI, Cards & NetBanking)*\n\n` +
      `Thank you!\n` +
      `*${showroomName}*`;

    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    const whatsappShareUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(whatsappMsg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMsg)}`;

    return NextResponse.json({
      success: true,
      id: linkResult.id,
      shortUrl: linkResult.shortUrl,
      amountPaise: linkResult.amountPaise,
      status: linkResult.status,
      qrUrl: linkResult.qrUrl,
      isMock: linkResult.isMock,
      whatsAppUrl: whatsappShareUrl,
      whatsappShareUrl,
      whatsappMsg,
      paymentLink: {
        id: linkResult.id,
        shortUrl: linkResult.shortUrl,
        amountPaise: linkResult.amountPaise,
        status: linkResult.status,
        qrUrl: linkResult.qrUrl,
        isMock: linkResult.isMock,
        whatsappMsg,
        whatsappShareUrl,
      },
    });
  } catch (error: any) {
    console.error('Error generating payment link:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
