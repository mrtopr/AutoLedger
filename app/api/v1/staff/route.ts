import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser, hashPassword } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { Role } from '@prisma/client';
import { createAuditLog } from '@/server/lib/audit';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
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
        { error: 'Forbidden: only OWNER or MANAGER can view staff list' },
        { status: 403 }
      );
    }

    const tenantId = authUser.tenantId;
    let users: any[] = [];

    // 1. Try Prisma first if Postgres is reachable and tenantId is a valid UUID
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(tenantId)) {
      try {
        const dbUsers = await prisma.user.findMany({
          where: { tenantId },
          orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          }
        });
        if (dbUsers.length > 0) users = dbUsers;
      } catch (dbErr) {
        console.warn('Postgres unavailable for staff GET, using localStore fallback');
      }
    }

    // 2. If no users from DB, use localStore scoped to tenantId
    if (users.length === 0) {
      const localUsers = localStore.getUsers(tenantId);
      users = localUsers.map(u => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email || null,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));
    }

    return NextResponse.json({ success: true, count: users.length, staff: users });
  } catch (error: any) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch staff' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
        { error: 'Forbidden: only OWNER or MANAGER can add staff' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, phone, email, password, role = 'COUNTER_STAFF' } = body;

    // Privilege escalation prevention: only an OWNER can create another OWNER
    if (role === 'OWNER' && authUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: only an OWNER can create an OWNER account' },
        { status: 403 }
      );
    }

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: 'Name, phone number, and password are required' },
        { status: 400 }
      );
    }

    const targetTenantId = authUser.tenantId;
    const hashedPassword = await hashPassword(password);
    let createdUser: any = null;

    // 1. Try Prisma if available and targetTenantId is a valid UUID
    const hasDb = await isPostgresAvailable();
    if (hasDb && isUuid(targetTenantId)) {
      try {
        const user = await prisma.user.create({
          data: {
            tenantId: targetTenantId,
            name,
            phone,
            email: email || null,
            password: hashedPassword,
            role: (role as Role) || Role.COUNTER_STAFF,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          }
        });
        createdUser = user;

        await createAuditLog({
          tenantId: targetTenantId,
          userId: authUser.id,
          action: 'USER_CREATED',
          entity: 'USER',
          entityId: user.id,
          after: { name: user.name, phone: user.phone, role: user.role },
        });
      } catch (dbErr: any) {
        console.warn('Postgres user create error, falling back to localStore:', dbErr?.message);
      }
    }

    // 2. Fallback to localStore
    if (!createdUser) {
      const localUser = localStore.createUser({
        tenantId: targetTenantId,
        name,
        phone,
        email: email || undefined,
        password: hashedPassword,
        role: (role as any) || 'COUNTER_STAFF',
        isActive: true,
      });

      createdUser = {
        id: localUser.id,
        name: localUser.name,
        phone: localUser.phone,
        email: localUser.email || null,
        role: localUser.role,
        isActive: localUser.isActive,
        createdAt: localUser.createdAt,
      };
    }

    return NextResponse.json(
      { success: true, message: 'Staff member added successfully', user: createdUser },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error adding staff member:', error);
    return NextResponse.json({ error: error.message || 'Failed to add staff member' }, { status: 500 });
  }
}
