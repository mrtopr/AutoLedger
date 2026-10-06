import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    const hasDb = await isPostgresAvailable();

    if (hasDb) {
      try {
        let tenant = auth?.tenantId 
          ? await prisma.tenant.findUnique({ where: { id: auth.tenantId } })
          : await prisma.tenant.findFirst();

        if (tenant) {
          return NextResponse.json({ success: true, tenant });
        }
      } catch (err) {
        console.warn('Prisma tenant fetch fallback:', err);
      }
    }

    const localTenant = (auth?.tenantId && localStore.getTenantById(auth.tenantId)) || localStore.getTenants()[0];
    return NextResponse.json({
      success: true,
      tenant: localTenant || {
        id: 'tenant-default',
        name: 'Shree Vishwakarma Honda',
        legalName: 'Shree Honda',
        gstin: '10ABCDE1234F1Z5',
        address: 'Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125',
        stateCode: '10 - Bihar',
        phone: '+91 9822100001',
        email: 'Rishi@honda.com',
        upiId: 'rishi@okhdfcbank',
        bankDetails: {
          bankName: 'HDFC Bank',
          accountNumber: '50200012345678',
          ifscCode: 'HDFC0001234',
        },
        settings: {
          invoicePrefix: 'INV/2026-27/',
          terms: '1. Goods once sold will not be accepted back without original tax invoice.\n2. Parts covered under OEM warranty only.',
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    const body = await req.json();
    const {
      name,
      legalName,
      gstin,
      address,
      stateCode,
      phone,
      email,
      upiId,
      bankDetails,
      settings,
    } = body;

    const hasDb = await isPostgresAvailable();
    let updatedTenant: any = null;

    if (hasDb) {
      try {
        // Find existing tenant or create first primary tenant in Neon DB
        let existingTenant = auth?.tenantId 
          ? await prisma.tenant.findUnique({ where: { id: auth.tenantId } })
          : await prisma.tenant.findFirst();

        const dataToSave = {
          ...(name !== undefined ? { name } : {}),
          ...(legalName !== undefined ? { legalName } : {}),
          ...(gstin !== undefined ? { gstin } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(stateCode !== undefined ? { stateCode } : {}),
          ...(upiId !== undefined ? { upiId } : {}),
          ...(bankDetails !== undefined ? { bankDetails } : {}),
          ...(settings !== undefined ? { settings: { ...((settings as any) || {}), phone, email } } : {}),
        };

        if (existingTenant) {
          updatedTenant = await prisma.tenant.update({
            where: { id: existingTenant.id },
            data: dataToSave,
          });
        } else {
          updatedTenant = await prisma.tenant.create({
            data: {
              name: name || 'Honda Auto Spares & Wholesalers',
              legalName: legalName || 'Shree Vishwakarma Honda Pvt Ltd',
              gstin: gstin || '27ABCDE1234F1Z5',
              address: address || 'Near Dak Bunglow, Takunatand, Rajauli, Bihar 805125',
              stateCode: stateCode || '10 - Bihar',
              upiId: upiId || 'rishi@okhdfcbank',
              bankDetails: bankDetails || {},
              settings: settings || { phone, email },
            },
          });
        }
      } catch (dbErr) {
        console.warn('Prisma tenant update error, falling back to local store:', dbErr);
      }
    }

    if (!updatedTenant) {
      const tenantId = auth?.tenantId || 'tenant-default';
      updatedTenant = localStore.updateTenant(tenantId, {
        ...(name !== undefined ? { name } : {}),
        ...(legalName !== undefined ? { legalName } : {}),
        ...(gstin !== undefined ? { gstin } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(stateCode !== undefined ? { stateCode } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(upiId !== undefined ? { upiId } : {}),
        ...(bankDetails !== undefined ? { bankDetails } : {}),
        ...(settings !== undefined ? { settings } : {}),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Dealership profile and invoice format saved successfully',
      tenant: updatedTenant,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
