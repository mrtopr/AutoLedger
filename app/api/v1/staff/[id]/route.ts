import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser, hashPassword } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { Role } from '@prisma/client';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }

    if (authUser.role !== 'OWNER' && authUser.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: only OWNER or MANAGER can update staff members' },
        { status: 403 }
      );
    }

    const tenantId = authUser.tenantId;
    const userId = params.id;
    const body = await req.json();
    const { name, phone, email, role, isActive, password } = body;

    if (role === 'OWNER' && authUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: only an OWNER can grant the OWNER role' },
        { status: 403 }
      );
    }

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (phone) dataToUpdate.phone = phone;
    if (email !== undefined) dataToUpdate.email = email || null;
    if (isActive !== undefined) dataToUpdate.isActive = !!isActive;
    if (role) dataToUpdate.role = role as Role;
    if (password) {
      dataToUpdate.password = await hashPassword(password);
    }

    const hasDb = await isPostgresAvailable();
    let updated: any = null;

    if (hasDb && isUuid(userId) && isUuid(tenantId)) {
      try {
        // Verify user belongs to tenant first to prevent cross-tenant mutations
        const existing = await prisma.user.findFirst({
          where: { id: userId, tenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        // Privilege escalation & OWNER protection
        if (existing.role === 'OWNER' && authUser.role !== 'OWNER') {
          return NextResponse.json(
            { error: 'Forbidden: only an OWNER can modify an OWNER account' },
            { status: 403 }
          );
        }

        if (role === 'OWNER' && authUser.role !== 'OWNER') {
          return NextResponse.json(
            { error: 'Forbidden: only an OWNER can grant the OWNER role' },
            { status: 403 }
          );
        }

        updated = await prisma.user.update({
          where: { id: userId },
          data: dataToUpdate,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
          }
        });

        await createAuditLog({
          tenantId,
          userId: authUser.id,
          action: 'USER_UPDATED',
          entity: 'USER',
          entityId: userId,
          before: { name: existing.name, role: existing.role, isActive: existing.isActive },
          after: { name: updated.name, role: updated.role, isActive: updated.isActive },
        });
      } catch (dbErr) {
        console.warn('Postgres user update fallback:', dbErr);
      }
    }

    if (!updated) {
      updated = localStore.updateUser(userId, {
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
        ...(role ? { role: role as any } : {}),
        ...(password ? { password: await hashPassword(password) } : {}),
      }, tenantId);

      if (!updated) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Error updating staff member:', error);
    return NextResponse.json({ error: error.message || 'Failed to update staff' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: missing authentication or tenant context' },
        { status: 401 }
      );
    }

    // Only OWNER can delete/remove staff members
    if (authUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: only the business OWNER can delete staff accounts' },
        { status: 403 }
      );
    }

    const tenantId = authUser.tenantId;
    const userId = params.id;

    // Self-deletion prevention
    if (authUser.id === userId) {
      return NextResponse.json(
        { error: 'Forbidden: you cannot delete your own account' },
        { status: 400 }
      );
    }

    const hasDb = await isPostgresAvailable();

    if (hasDb && isUuid(userId) && isUuid(tenantId)) {
      try {
        const existing = await prisma.user.findFirst({
          where: { id: userId, tenantId },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        if (existing.role === 'OWNER') {
          return NextResponse.json(
            { error: 'Forbidden: OWNER accounts cannot be deleted' },
            { status: 403 }
          );
        }

        try {
          await prisma.user.delete({
            where: { id: userId },
          });
        } catch (dbErr) {
          // Fallback soft delete
          await prisma.user.update({
            where: { id: userId },
            data: { isActive: false },
          });
        }

        await createAuditLog({
          tenantId,
          userId: authUser.id,
          action: 'USER_DELETED',
          entity: 'USER',
          entityId: userId,
          before: { name: existing.name, role: existing.role, phone: existing.phone },
        });
      } catch (dbErr) {
        console.warn('Postgres user delete error:', dbErr);
      }
    }

    const updated = localStore.updateUser(userId, { isActive: false }, tenantId);
    if (!updated && !hasDb) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Staff member removed successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove staff member' }, { status: 500 });
  }
}
