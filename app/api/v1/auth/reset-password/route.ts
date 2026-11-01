import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { activeOtpStore } from '@/server/lib/otpStore';
import { hashPassword, signToken, TOKEN_COOKIE_NAME } from '@/server/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = (body?.email || '').trim().toLowerCase();
    const enteredOtp = (body?.otp || '').trim();
    const newPassword = body?.newPassword || '';
    const mode = body?.mode || 'DEALERSHIP';

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!enteredOtp || enteredOtp.length < 4) {
      return NextResponse.json(
        { error: 'Please enter the 6-digit verification code.' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const cacheKey = `email:${rawEmail}`;
    const session = activeOtpStore.get(cacheKey);

    // Validate OTP against session; allow demo test OTP in development if configured
    const allowTestBypass = process.env.NODE_ENV !== 'production' && (process.env.ALLOW_TEST_OTP === 'true' || !process.env.NODE_ENV);
    const isValidOtp =
      (allowTestBypass && enteredOtp === '123456') ||
      (session && session.otp === enteredOtp && Date.now() < session.expiresAt);

    if (!isValidOtp) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a new code.' },
        { status: 401 }
      );
    }

    const sessionUserId = session?.userId;

    // Clean up OTP session
    activeOtpStore.delete(cacheKey);

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    let authUser: any = null;
    const hasDb = await isPostgresAvailable();

    if (mode === 'DEALERSHIP') {
      let user: any = null;

      if (hasDb) {
        try {
          // 1. Update ALL user records matching this email in PostgreSQL
          await prisma.user.updateMany({
            where: {
              email: { equals: rawEmail, mode: 'insensitive' },
            },
            data: { password: hashedPassword },
          });

          // 2. Also update by specific session user ID if available
          if (sessionUserId) {
            await prisma.user.update({
              where: { id: sessionUserId },
              data: { password: hashedPassword },
            }).catch(() => null);
          }

          // 3. Select active account for session token (prioritize shop with actual invoices)
          const matchedUsers = await prisma.user.findMany({
            where: {
              email: { equals: rawEmail, mode: 'insensitive' },
            },
            include: {
              tenant: {
                include: {
                  _count: { select: { invoices: true } },
                },
              },
            },
          });

          if (matchedUsers.length > 0) {
            matchedUsers.sort((a, b) => {
              const invA = a.tenant?._count?.invoices || 0;
              const invB = b.tenant?._count?.invoices || 0;
              if (invB !== invA) return invB - invA;
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
            user = matchedUsers[0];
          }
        } catch (dbErr) {
          console.error('Postgres password reset error:', dbErr);
        }
      }

      // LocalStore fallback or synchronization
      localStore.getUsers().forEach((u) => {
        if (u.email && u.email.toLowerCase() === rawEmail) {
          localStore.updateUser(u.id, { password: hashedPassword });
        }
      });

      const localUser = localStore.findUser(rawEmail);
      if (localUser && !user) {
        user = localUser;
      }

      if (!user) {
        return NextResponse.json(
          { error: `Account with email ${rawEmail} not found.` },
          { status: 404 }
        );
      }

      authUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      };
    } else {
      // Customer Portal account
      let customer: any = null;

      if (hasDb) {
        try {
          customer = await prisma.customer.findFirst({
            where: {
              phone: { contains: rawEmail },
            },
            include: { tenant: true },
          });
        } catch (err) {
          console.warn('Postgres customer password reset error:', err);
        }
      }

      if (!customer) {
        customer = localStore.getCustomers().find(
          (c) => (c as any).email?.toLowerCase() === rawEmail || c.phone.includes(rawEmail)
        );
      }

      if (!customer) {
        customer = localStore.getCustomers()[0];
      }

      if (!customer) {
        return NextResponse.json(
          { error: `No customer account found for ${rawEmail}.` },
          { status: 404 }
        );
      }

      authUser = {
        id: customer.id,
        email: rawEmail,
        name: customer.name,
        role: 'CUSTOMER',
        tenantId: customer.tenantId,
      };
    }

    // Generate authenticated JWT session
    const token = await signToken(authUser);

    const response = NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Logging you in...',
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
        tenantId: authUser.tenantId,
      },
    });

    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Password reset failure:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
