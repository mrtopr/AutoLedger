import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || !auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }

    const hasDb = await isPostgresAvailable();

    if (hasDb && isUuid(auth.tenantId)) {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: auth.tenantId },
        });

        if (tenant) {
          return NextResponse.json({ success: true, tenant });
        }
      } catch (err) {
        console.warn('Prisma tenant fetch fallback:', err);
      }
    }

    const localTenant = localStore.getTenantById(auth.tenantId);
    if (localTenant) {
      return NextResponse.json({
        success: true,
        tenant: localTenant,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Tenant profile not found' },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || !auth.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }

    if (auth.role !== 'OWNER' && auth.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: only OWNER or MANAGER can update dealership profile' },
        { status: 403 }
      );
    }

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

    // Financial protection: only OWNER can alter settlement bank accounts and UPI IDs
    if ((bankDetails !== undefined || upiId !== undefined) && auth.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: only business OWNER can alter settlement bank accounts and UPI IDs' },
        { status: 403 }
      );
    }

    const hasDb = await isPostgresAvailable();
    let updatedTenant: any = null;

    if (hasDb && isUuid(auth.tenantId)) {
      try {
        const existingTenant = await prisma.tenant.findUnique({
          where: { id: auth.tenantId },
        });

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
            where: { id: auth.tenantId },
            data: dataToSave,
          });
        } else {
          updatedTenant = await prisma.tenant.create({
            data: {
              id: auth.tenantId,
              name: name || 'Dealership',
              legalName: legalName || 'Dealership Pvt Ltd',
              gstin: gstin || '27ABCDE1234F1Z5',
              address: address || '',
              stateCode: stateCode || '10 - Bihar',
              upiId: upiId || '',
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
      updatedTenant = localStore.updateTenant(auth.tenantId, {
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

    await createAuditLog({
      tenantId: auth.tenantId,
      userId: auth.id,
      action: 'SETTINGS_UPDATED',
      entity: 'TENANT',
      entityId: auth.tenantId,
      after: {
        name,
        legalName,
        gstin,
        address,
        upiId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Dealership profile and invoice format saved successfully',
      tenant: updatedTenant,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
