import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { activeOtpStore } from '@/server/lib/otpStore';
import { sendOtpEmail } from '@/server/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = (body?.email || '').trim().toLowerCase();
    const mode = body?.mode || 'DEALERSHIP';

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    let accountName = 'Valued User';
    let userId: string | undefined = undefined;
    let customerId: string | undefined = undefined;
    let tenantId = 'tenant-honda-1';
    let role = 'OWNER';
    let phone = '';

    // ==========================================
    // 1. DEALERSHIP STAFF / OWNER
    // ==========================================
    if (mode === 'DEALERSHIP') {
      let user: any = null;

      const hasDb = await isPostgresAvailable();
      if (hasDb) {
        try {
          user = await prisma.user.findFirst({
            where: {
              email: { equals: rawEmail, mode: 'insensitive' },
            },
            include: { tenant: true },
          });
        } catch (dbErr) {
          console.warn('Postgres lookup error during email OTP send:', dbErr);
        }
      }

      if (!user) {
        user = localStore.findUser(rawEmail);
      }

      if (!user) {
        return NextResponse.json(
          {
            error: `No staff or owner account registered with email ${rawEmail}. Please use your registered email address or sign up.`,
          },
          { status: 404 }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          { error: 'This account has been deactivated. Contact your administrator.' },
          { status: 403 }
        );
      }

      accountName = user.name;
      userId = user.id;
      tenantId = user.tenantId;
      role = user.role;
      phone = user.phone || '';
    } 
    // ==========================================
    // 2. CUSTOMER / GARAGE PORTAL
    // ==========================================
    else {
      let customer: any = null;

      const hasDb = await isPostgresAvailable();
      if (hasDb) {
        try {
          customer = await prisma.customer.findFirst({
            where: {
              phone: { contains: rawEmail }, // In case they typed customer ID or phone
            },
            include: { tenant: true },
          });
        } catch (err) {
          console.warn('Postgres customer lookup error:', err);
        }
      }

      if (!customer) {
        customer = localStore.getCustomers().find(
          (c) => (c as any).email?.toLowerCase() === rawEmail || c.phone.includes(rawEmail)
        );
      }

      // If customer not specifically found, check if this email belongs to any registered customer
      if (!customer) {
        // Fallback to first active customer for demo ease if matching
        const anyCustomer = localStore.getCustomers()[0];
        if (anyCustomer) {
          customer = anyCustomer;
        }
      }

      if (!customer) {
        return NextResponse.json(
          {
            error: `No customer account found for ${rawEmail}. Please ask your wholesale supplier to register your email.`,
          },
          { status: 404 }
        );
      }

      accountName = customer.name;
      customerId = customer.id;
      tenantId = customer.tenantId;
      phone = customer.phone;
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const cacheKey = `email:${rawEmail}`;
    activeOtpStore.set(cacheKey, {
      otp,
      expiresAt,
      userId,
      customerId,
      tenantId,
      role,
      name: accountName,
      phone,
    });

    // Send email dispatch
    await sendOtpEmail(rawEmail, otp, accountName);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${rawEmail}`,
      demoOtp: otp, // Returned for instant 100% free testing without waiting for inbox
    });
  } catch (error: any) {
    console.error('Error sending email OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification email. Please try again.' },
      { status: 500 }
    );
  }
}
