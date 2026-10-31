import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './env';

export interface CustomerSessionPayload {
  customerId: string;
  phone: string;
  tenantId: string;
  role: 'CUSTOMER';
  loginTime?: number;
}

const CUSTOMER_COOKIE_NAME = 'autoledger_customer_token';

/**
 * Cryptographically signs a verified customer session JWT.
 */
export function signCustomerToken(payload: CustomerSessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

/**
 * Validates cryptographic signature and expiration of customer portal JWT.
 * Fails closed if token is invalid, forged, or expired.
 */
export function verifyCustomerToken(token: string): CustomerSessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded && decoded.customerId && decoded.tenantId && decoded.role === 'CUSTOMER') {
      return {
        customerId: decoded.customerId,
        phone: decoded.phone,
        tenantId: decoded.tenantId,
        role: 'CUSTOMER',
        loginTime: decoded.loginTime,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Authenticates customer request from HttpOnly cookie or Authorization Bearer header.
 * Disallows arbitrary unauthenticated x-customer-phone header injection.
 */
export function parseCustomerSession(req: NextRequest): CustomerSessionPayload | null {
  let token: string | null = null;

  // 1. Check HttpOnly Cookie
  const cookieVal = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (cookieVal) token = cookieVal;

  // 2. Check Authorization Header
  if (!token) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  // 3. Check custom token header
  if (!token) {
    token = req.headers.get('x-customer-token') || null;
  }

  if (!token) return null;

  return verifyCustomerToken(token);
}

export { CUSTOMER_COOKIE_NAME };
