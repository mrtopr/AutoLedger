import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser, hashPassword } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { Role } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    let users: any[] = [];

    // 1. Try Prisma first if Postgres is reachable and tenantId is either absent or a valid UUID
    const hasDb = await isPostgresAvailable();
    if (hasDb && (!authUser?.tenantId || isUuid(authUser?.tenantId))) {
      try {
        const dbUsers = await prisma.user.findMany({
          where: { ...(authUser?.tenantId && isUuid(authUser.tenantId) ? { tenantId: authUser.tenantId } : {}) },
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

    // 2. If no users from DB, use localStore
    if (users.length === 0) {
      const localUsers = localStore.getUsers(authUser?.tenantId);
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
    const body = await req.json();
    const { name, phone, email, password, role = 'COUNTER_STAFF' } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: 'Name, phone number, and password are required' },
        { status: 400 }
      );
    }

    const targetTenantId = authUser?.tenantId || 'tenant-royal-1';
    const hashedPassword = await hashPassword(password);
    let createdUser: any = null;

    // 1. Try Prisma if available and targetTenantId is a valid UUID (or find default DB tenant)
    const hasDb = await isPostgresAvailable();
    let dbTenantId: string | null = null;
    if (hasDb) {
      if (isUuid(targetTenantId)) {
        dbTenantId = targetTenantId;
      } else {
        try {
          const firstTenant = await prisma.tenant.findFirst({ select: { id: true } });
          if (firstTenant && isUuid(firstTenant.id)) {
            dbTenantId = firstTenant.id;
          }
        } catch {}
      }
    }

    if (hasDb && dbTenantId) {
      try {
        const user = await prisma.user.create({
          data: {
            tenantId: dbTenantId,
            name,
            phone,
            email: email || null,
            password: hashedPassword,
            role: role as Role,
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
      } catch (dbErr) {
        console.warn('Postgres unavailable during staff create, using localStore fallback');
      }
    }

    // 2. Always persist in localStore as well
    const localUser = localStore.createUser({
      tenantId: targetTenantId,
      name,
      phone,
      email: email || undefined,
      password: hashedPassword,
      role: role as any,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      user: createdUser || {
        id: localUser.id,
        name: localUser.name,
        phone: localUser.phone,
        email: localUser.email,
        role: localUser.role,
        isActive: localUser.isActive,
        createdAt: localUser.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staff member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create staff member' },
      { status: 500 }
    );
  }
}
