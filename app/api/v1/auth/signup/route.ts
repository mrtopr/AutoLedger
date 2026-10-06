import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { hashPassword, signToken, TOKEN_COOKIE_NAME } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { Role } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      businessName, 
      ownerName, 
      phone, 
      email, 
      password, 
      gstin, 
      address, 
      stateCode = '27' 
    } = body;

    if (!businessName || !ownerName || !phone || !password) {
      return NextResponse.json(
        { error: 'Business name, owner name, phone, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    let createdUser: any = null;
    let createdTenant: any = null;

    // 1. Try Prisma first if DB is reachable
    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { phone },
        });

        if (existingUser) {
          return NextResponse.json(
            { error: 'Phone number already registered. Please login.' },
            { status: 409 }
          );
        }

        const tenant = await prisma.tenant.create({
          data: {
            name: businessName,
            legalName: businessName,
            gstin: gstin || null,
            address: address || null,
            stateCode: stateCode || '27',
            users: {
              create: {
                name: ownerName,
                phone: phone,
                email: email || null,
                password: hashedPassword,
                role: Role.OWNER,
                isActive: true,
              }
            },
            invoiceSeries: {
              createMany: {
                data: [
                  { seriesCode: 'INV', fy: '2026-27', prefix: 'INV/2026-27/', lastNumber: 0 },
                  { seriesCode: 'RET', fy: '2026-27', prefix: 'RET/2026-27/', lastNumber: 0 },
                ]
              }
            }
          },
          include: { users: true }
        });

        createdTenant = tenant;
        createdUser = tenant.users[0];
      } catch (dbErr) {
        console.warn('Postgres unavailable during signup, using localStore fallback:', (dbErr as any)?.message);
      }
    }

    if (!createdUser) {
      // Check if phone exists in localStore
      const existing = localStore.findUser(phone);
      if (existing) {
        return NextResponse.json(
          { error: 'Phone number already registered. Please login.' },
          { status: 409 }
        );
      }

      // Create tenant & owner in localStore
      createdTenant = localStore.createTenant({
        name: businessName,
        legalName: businessName,
        gstin: gstin || undefined,
        address: address || undefined,
        stateCode: stateCode || '27',
      });

      createdUser = localStore.createUser({
        tenantId: createdTenant.id,
        name: ownerName,
        phone: phone,
        email: email || undefined,
        password: hashedPassword,
        role: 'OWNER',
        isActive: true,
      });
    }

    const token = signToken({
      userId: createdUser.id,
      tenantId: createdTenant.id,
      role: createdUser.role,
      name: createdUser.name,
      phone: createdUser.phone,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        name: createdUser.name,
        phone: createdUser.phone,
        email: createdUser.email,
        role: createdUser.role,
      },
      tenant: {
        id: createdTenant.id,
        name: createdTenant.name,
        gstin: createdTenant.gstin,
        stateCode: createdTenant.stateCode,
        address: createdTenant.address,
      }
    }, { status: 201 });

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
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
