import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser, hashPassword } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { Role } from '@prisma/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const userId = params.id;
    const body = await req.json();
    const { name, phone, email, role, isActive, password } = body;

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

    if (hasDb) {
      try {
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
      });
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
    const userId = params.id;
    const hasDb = await isPostgresAvailable();

    if (hasDb) {
      try {
        await prisma.user.delete({
          where: { id: userId },
        });
      } catch (dbErr) {
        // Fallback update
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
      }
    }

    localStore.updateUser(userId, { isActive: false });

    return NextResponse.json({ success: true, message: 'Staff member removed successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove staff member' }, { status: 500 });
  }
}
