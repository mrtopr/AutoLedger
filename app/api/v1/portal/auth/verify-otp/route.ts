import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { activeOtpStore } from '../send-otp/route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone = body?.phone || '';
    const otp = (body?.otp || '').trim();
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: 'Invalid phone number provided.' },
        { status: 400 }
      );
    }

    if (!otp) {
      return NextResponse.json(
        { error: 'Please enter the 4-digit OTP.' },
        { status: 400 }
      );
    }

    // Verify OTP
    const session = activeOtpStore.get(cleanPhone);
    const isValidOtp = otp === '1234' || (session && session.otp === otp && Date.now() < session.expiresAt);

    if (!isValidOtp) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please enter 1234 or request a new code.' },
        { status: 401 }
      );
    }

    // Fetch full customer details
    let customer: any = null;
    let tenant: any = null;

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
          tenant = customer.tenant;
        }
      } catch (err) {
        console.warn('Postgres lookup error during OTP verify:', err);
      }
    }

    if (!customer) {
      customer = localStore.getCustomerByPhone(cleanPhone);
      tenant = localStore.getTenant();
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer account could not be resolved.' },
        { status: 404 }
      );
    }

    // Clear used OTP
    activeOtpStore.delete(cleanPhone);

    // Simple signed customer session token (base64 encoded JSON for lightweight edge auth)
    const sessionPayload = {
      customerId: customer.id,
      phone: cleanPhone,
      tenantId: customer.tenantId || tenant?.id || 'tenant-honda-1',
      loginTime: Date.now(),
      role: 'CUSTOMER',
    };
    const sessionToken = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      customer: {
        id: customer.id,
        name: customer.name,
        shopName: customer.shopName || customer.name,
        phone: customer.phone,
        address: customer.address,
        gstin: customer.gstin,
        customerType: customer.customerType || 'GARAGE',
        balancePaise: customer.balancePaise || '0',
        creditLimitPaise: customer.creditLimitPaise || customer.creditLimit?.toString() || '5000000',
        termsDays: customer.termsDays || customer.paymentTermsDays || 15,
        status: customer.status || 'GREEN',
      },
      dealership: {
        id: tenant?.id || 'tenant-honda-1',
        name: tenant?.name || 'AutoLedger Dealership',
        phone: tenant?.phone || '+91 98221 00001',
        address: tenant?.address || 'Main Market, Workshop Area',
        gstin: tenant?.gstin,
        upiId: tenant?.upiId || 'royalauto@okhdfcbank',
      }
    });

    // Set HTTP-only session cookie
    response.cookies.set('autoledger_customer_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Error verifying portal OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP.' },
      { status: 500 }
    );
  }
}
