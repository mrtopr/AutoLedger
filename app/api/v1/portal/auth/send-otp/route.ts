import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { activeOtpStore } from '@/server/lib/otpStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone = body?.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    let customer: any = null;
    let tenantName = 'Apex Trade & Wholesale';

    // 1. Try Prisma if available
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        customer = await prisma.customer.findFirst({
          where: {
            phone: { contains: cleanPhone },
          },
          include: {
            tenant: true,
          }
        });
        if (customer && customer.tenant) {
          tenantName = customer.tenant.name;
        }
      } catch (err) {
        console.warn('Postgres customer lookup failed, falling back to localStore:', err);
      }
    }

    // 2. Fallback to localStore
    if (!customer) {
      customer = localStore.getCustomerByPhone(cleanPhone);
      if (customer) {
        const tenant = localStore.getTenant(customer.tenantId);
        if (tenant) tenantName = tenant.name;
      }
    }

    if (!customer) {
      return NextResponse.json(
        { 
          error: `No customer account found for +91 ${cleanPhone}. Please ask your merchant or supplier to register your mobile number into their customer accounts directory.` 
        },
        { status: 404 }
      );
    }

    // Generate 4-digit OTP (Default 1234 for seamless instant demo)
    const generatedOtp = '1234';
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    activeOtpStore.set(cleanPhone, {
      otp: generatedOtp,
      expiresAt,
      customerId: customer.id,
      tenantId: customer.tenantId || 'tenant-honda-1',
    });

    return NextResponse.json({
      success: true,
      message: `OTP sent to +91 ${cleanPhone}`,
      customer: {
        id: customer.id,
        name: customer.name,
        shopName: customer.shopName || customer.name,
        phone: customer.phone,
        dealership: tenantName,
      },
      demoOtp: generatedOtp, // Provided for instant verification
    });
  } catch (error: any) {
    console.error('Error sending portal OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}
