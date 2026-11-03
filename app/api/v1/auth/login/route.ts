import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { comparePassword, signToken, TOKEN_COOKIE_NAME } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loginId, password } = body;

    if (!loginId || !password) {
      return NextResponse.json(
        { error: 'Phone number/Email and password are required' },
        { status: 400 }
      );
    }

    const cleanLoginId = loginId.trim();
    let user: any = null;

    // 1. Try Prisma first if DB is available
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const matchedUsers = await prisma.user.findMany({
          where: {
            OR: [
              { phone: cleanLoginId },
              { email: cleanLoginId.toLowerCase() },
            ],
          },
          include: { 
            tenant: {
              include: {
                _count: { select: { invoices: true } }
              }
            } 
          }
        });

        if (matchedUsers.length > 0) {
          // Check each account for password match, prioritizing most active shop
          matchedUsers.sort((a, b) => (b.tenant?._count?.invoices || 0) - (a.tenant?._count?.invoices || 0));
          
          for (const u of matchedUsers) {
            if (u.password && (await comparePassword(password, u.password))) {
              user = u;
              break;
            }
          }

          // If no password matched yet, default to most active user to check error conditions
          if (!user) {
            user = matchedUsers[0];
          }
        }
      } catch (dbErr) {
        console.warn('Postgres unavailable during login, using localStore fallback');
      }
    }

    // 2. If not found in Prisma or DB offline, check localStore
    if (!user) {
      user = localStore.findUser(cleanLoginId);
      if (user && hasDb) {
        try {
          let targetTenantId = (user.tenantId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.tenantId))
            ? user.tenantId
            : null;
          if (!targetTenantId && user.tenantId) {
            const localT = localStore.getTenantById(user.tenantId);
            if (localT) {
              const matchedTenant = await prisma.tenant.findFirst({ where: { name: localT.name }, select: { id: true } });
              if (matchedTenant) targetTenantId = matchedTenant.id;
            }
          }
          if (targetTenantId) {
            const syncedUser = await prisma.user.create({
              data: {
                tenantId: targetTenantId,
                name: user.name,
                phone: user.phone,
                email: user.email || null,
                password: user.password || null,
                role: (user.role as any) || 'COUNTER_STAFF',
                isActive: true,
              },
              include: { tenant: true },
            });
            user = syncedUser;
          }
        } catch (syncErr) {
          console.warn('Auto-sync user to DB failed during login:', syncErr);
        }
      }
    }

    if (!user && cleanLoginId.toLowerCase() === 'demo@autoledger.app' && password === 'Demo@123') {
      let demoTenant = localStore.getTenants().find((t) => t.name === 'AutoLedger Demo Motors');
      if (!demoTenant) {
        demoTenant = localStore.createTenant({
          name: 'AutoLedger Demo Motors',
          legalName: 'AutoLedger Demo Motors LLP',
          gstin: '27AABCA1234F1Z9',
          address: 'Shop No. 12-14, Pune Auto Spare Market, Nana Peth, Pune - 411002',
          stateCode: '27',
          phone: '9822012345',
          email: 'demo@autoledger.app',
        });
      }
      user = localStore.findUser('demo@autoledger.app');
      if (!user) {
        const hashedDemoPass = await comparePassword('Demo@123', '$2a$10$wT8f6u7UuHl8rXo6x.4DveR6.VvB1zJvX4a3nI2tQ7zF5rVbYxQeK') ? '$2a$10$wT8f6u7UuHl8rXo6x.4DveR6.VvB1zJvX4a3nI2tQ7zF5rVbYxQeK' : undefined;
        user = localStore.createUser({
          tenantId: demoTenant.id,
          name: 'Rajesh Sharma (Owner)',
          email: 'demo@autoledger.app',
          phone: '9822012345',
          password: hashedDemoPass,
          role: 'OWNER',
          isActive: true,
        });
        user = { ...user, tenant: demoTenant };
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this phone/email. Please sign up.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'This account has been deactivated. Contact your administrator.' },
        { status: 403 }
      );
    }

    let isValidPassword = false;
    if (user.password) {
      isValidPassword = await comparePassword(password, user.password);
    } else {
      // In production with PostgreSQL, passwordless accounts must fail closed
      const isDevFallback = process.env.NODE_ENV !== 'production' && (process.env.ALLOW_DEV_PASSWORDS === 'true' || !process.env.NODE_ENV);
      isValidPassword = isDevFallback && (password === 'admin123' || password === 'password123');
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
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
      }
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
  } catch (error: any) {
    console.error('Login error:', error?.message || error);
    return NextResponse.json(
      { error: 'Login failed. Please check your credentials and try again.' },
      { status: 500 }
    );
  }
}
