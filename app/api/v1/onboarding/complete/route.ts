import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { hashPassword, signToken, TOKEN_COOKIE_NAME } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { parseRupeesToPaise } from '@/server/lib/tax';
import { Role } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { business, products = [] } = body;

    if (!business?.businessName || !business?.ownerName || !business?.phone || !business?.password) {
      return NextResponse.json(
        { error: 'Business name, owner name, phone, and password are required' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(business.password);
    let createdUser: any = null;
    let createdTenant: any = null;
    let createdProductsCount = 0;

    // 1. Try Prisma DB first
    try {
      const existingUser = await prisma.user.findUnique({
        where: { phone: business.phone },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Phone number already registered. Please login or use another number.' },
          { status: 409 }
        );
      }

      const tenant = await prisma.tenant.create({
        data: {
          name: business.businessName,
          legalName: business.businessName,
          gstin: business.gstin || null,
          address: business.address || null,
          stateCode: business.stateCode || '27',
          users: {
            create: {
              name: business.ownerName,
              phone: business.phone,
              email: business.email || null,
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

      // Ingest Products if provided
      for (const p of products) {
        const salePaise = parseRupeesToPaise(p.salePriceRupees || '0');
        const purchasePaise = parseRupeesToPaise(p.purchasePriceRupees || '0');
        const mrpPaise = parseRupeesToPaise(p.mrpRupees || '0');

        const dbProduct = await prisma.product.create({
          data: {
            tenantId: tenant.id,
            name: p.name,
            partNumber: p.partNumber || `SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            brand: p.brand || 'Genuine',
            category: p.category || 'General Spares',
            hsnCode: p.hsnCode || '8714',
            gstRateBp: p.gstRateBp || 1800,
            unit: p.unit || 'pcs',
            salePrice: salePaise,
            purchasePrice: purchasePaise,
            mrp: mrpPaise,
            reorderLevel: p.reorderLevel || 10,
            stockMovements: {
              create: {
                tenantId: tenant.id,
                reason: 'OPENING',
                qty: p.stockQty || 0,
                unitCost: purchasePaise,
                refType: 'ONBOARDING',
              }
            }
          }
        });
        createdProductsCount++;
      }
    } catch (dbErr) {
      console.warn('Postgres unavailable during onboarding, using localStore fallback:', (dbErr as any)?.message);

      // LocalStore check
      const existing = localStore.findUser(business.phone);
      if (existing) {
        return NextResponse.json(
          { error: 'Phone number already registered. Please login.' },
          { status: 409 }
        );
      }

      createdTenant = localStore.createTenant({
        name: business.businessName,
        legalName: business.businessName,
        gstin: business.gstin || undefined,
        address: business.address || undefined,
        stateCode: business.stateCode || '27',
      });

      createdUser = localStore.createUser({
        tenantId: createdTenant.id,
        name: business.ownerName,
        phone: business.phone,
        email: business.email || undefined,
        password: hashedPassword,
        role: 'OWNER',
        isActive: true,
      });

      // Ingest Products into localStore
      for (const p of products) {
        const salePaise = parseRupeesToPaise(p.salePriceRupees || '0').toString();
        const purchasePaise = parseRupeesToPaise(p.purchasePriceRupees || '0').toString();
        const mrpPaise = parseRupeesToPaise(p.mrpRupees || '0').toString();

        localStore.createProduct({
          tenantId: createdTenant.id,
          name: p.name,
          partNumber: p.partNumber || `SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          brand: p.brand || 'Genuine',
          category: p.category || 'General Spares',
          hsnCode: p.hsnCode || '8714',
          gstRateBp: p.gstRateBp || 1800,
          unit: p.unit || 'pcs',
          salePricePaise: salePaise,
          purchasePricePaise: purchasePaise,
          mrpPaise: mrpPaise,
          stockQty: p.stockQty || 0,
          reorderLevel: p.reorderLevel || 10,
          models: p.models || ['Universal'],
        });
        createdProductsCount++;
      }
    }

    // Generate JWT auth token
    const token = await signToken({
      userId: createdUser.id,
      tenantId: createdTenant.id,
      role: createdUser.role,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Business setup completed successfully',
      user: {
        id: createdUser.id,
        name: createdUser.name,
        phone: createdUser.phone,
        email: createdUser.email,
        role: createdUser.role,
      },
      tenant: createdTenant,
      productsCount: createdProductsCount,
    });

    response.cookies.set({
      name: TOKEN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Onboarding complete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete business setup' },
      { status: 500 }
    );
  }
}
