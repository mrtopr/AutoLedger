import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, isPostgresAvailable } from './prisma';
import { localStore } from './store';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'b2b-khata-jwt-super-secret-key-2026';
const TOKEN_COOKIE_NAME = 'auth_token';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: string;
  name: string;
  phone: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (err) {
    return null;
  }
}

export async function getAuthenticatedUser(req: NextRequest | Request) {
  let token: string | null = null;

  // 1. Check cookies
  if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
    token = (req as any).cookies.get(TOKEN_COOKIE_NAME)?.value || null;
  } else {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|; )${TOKEN_COOKIE_NAME}=([^;]*)`));
    if (match) token = decodeURIComponent(match[1]);
  }

  // 2. Check Authorization header
  if (!token) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.userId);
  const hasDb = await isPostgresAvailable();
  if (hasDb && isUuid) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { tenant: true },
      });

      if (user && user.isActive) {
        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenant: user.tenant,
        };
      }
    } catch (error) {
      // Fallback to local store when PostgreSQL is offline
    }
  }

  const localUser = localStore.findUserById(payload.userId);
  if (localUser && localUser.isActive) {
    return {
      id: localUser.id,
      name: localUser.name,
      phone: localUser.phone,
      email: localUser.email || null,
      role: localUser.role,
      tenantId: localUser.tenantId,
      tenant: localUser.tenant || {
        id: localUser.tenantId,
        name: 'Royal Auto Spares',
        gstin: '27ABCDE1234F1Z5',
        stateCode: '27',
      },
    };
  }

  return {
    id: payload.userId,
    name: payload.name,
    phone: payload.phone,
    email: null,
    role: payload.role as any,
    tenantId: payload.tenantId,
    tenant: {
      id: payload.tenantId,
      name: 'Royal Auto Spares',
      gstin: '27ABCDE1234F1Z5',
      stateCode: '27',
    } as any,
  };
}

export { TOKEN_COOKIE_NAME };
