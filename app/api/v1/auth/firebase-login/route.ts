import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { signToken, TOKEN_COOKIE_NAME } from '@/server/lib/auth';

/**
 * Verify Firebase ID Token via Google Identity Toolkit REST API
 */
async function verifyFirebaseIdToken(idToken: string, apiKey: string) {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('Google Identity Toolkit token verification error:', errData);
      return null;
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      return data.users[0]; // { localId, phoneNumber, email, ... }
    }
    return null;
  } catch (error) {
    console.error('Network error verifying Firebase token:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, phone: providedPhone, mode = 'DEALERSHIP' } = body;

    if (!idToken) {
      return NextResponse.json(
        { error: 'Firebase ID Token is required for verification.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
    let verifiedPhone = '';

    if (apiKey) {
      // Live Google Identity Toolkit verification
      const googleUser = await verifyFirebaseIdToken(idToken, apiKey);
      if (!googleUser) {
        return NextResponse.json(
          { error: 'Invalid or expired Firebase verification token. Please retry login.' },
          { status: 401 }
        );
      }
      verifiedPhone = googleUser.phoneNumber || '';
    } else {
      // In dev fallback / demo without apiKey configured
      verifiedPhone = providedPhone || '';
    }

    const cleanPhone = verifiedPhone.replace(/[^0-9]/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: 'Could not resolve a valid 10-digit mobile number from verification.' },
        { status: 400 }
      );
    }

    // ==========================================
    // 1. DEALERSHIP STAFF / OWNER AUTHENTICATION
    // ==========================================
    if (mode === 'DEALERSHIP') {
      let user: any = null;

      const hasDb = await isPostgresAvailable();
      if (hasDb) {
        try {
          user = await prisma.user.findFirst({
            where: {
              phone: { contains: cleanPhone },
            },
            include: { tenant: true },
          });
        } catch (dbErr) {
          console.warn('Postgres lookup error during Firebase login:', dbErr);
        }
      }

      if (!user) {
        user = localStore.findUser(cleanPhone);
      }

      if (!user) {
        return NextResponse.json(
          {
            error: `No staff or owner account registered with mobile number +91 ${cleanPhone}. Please register or contact your administrator.`,
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

      const tenantInfo = user.tenant || {
        id: user.tenantId,
        name: 'Royal Auto Spares',
        gstin: '27ABCDE1234F1Z5',
        stateCode: '27',
        address: 'Nana Peth, Pune',
      };

      const token = signToken({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
        phone: user.phone,
      });

      const response = NextResponse.json({
        success: true,
        role: 'STAFF',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
        tenant: {
          id: tenantInfo.id,
          name: tenantInfo.name,
          gstin: tenantInfo.gstin,
          stateCode: tenantInfo.stateCode,
          address: tenantInfo.address,
        },
      });

      response.cookies.set({
        name: TOKEN_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return response;
    }

    // ==========================================
    // 2. CUSTOMER / GARAGE PORTAL AUTHENTICATION
    // ==========================================
    let customer: any = null;
    let tenant: any = null;

    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        customer = await prisma.customer.findFirst({
          where: {
            phone: { contains: cleanPhone },
          },
          include: { tenant: true },
        });
        if (customer && customer.tenant) {
          tenant = customer.tenant;
        }
      } catch (err) {
        console.warn('Postgres customer lookup error during Firebase login:', err);
      }
    }

    if (!customer) {
      customer = localStore.getCustomerByPhone(cleanPhone);
      if (customer) {
        tenant = localStore.getTenant(customer.tenantId);
      }
    }

    if (!customer) {
      return NextResponse.json(
        {
          error: `No customer account found for +91 ${cleanPhone}. Please ask your wholesale supplier to register your mobile number.`,
        },
        { status: 404 }
      );
    }

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
      role: 'CUSTOMER',
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
        id: tenant?.id || 'tenant-apex-1',
        name: tenant?.name || 'Apex Trade & Wholesale',
        phone: tenant?.phone || '+91 98221 00001',
        address: tenant?.address || 'Main Market, Commercial Trade Hub',
        gstin: tenant?.gstin,
        upiId: tenant?.upiId || 'tradeledger@okhdfcbank',
      },
    });

    response.cookies.set('autoledger_customer_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Firebase login error:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
