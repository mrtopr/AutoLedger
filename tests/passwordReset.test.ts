import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendEmailOtp } from '@/app/api/v1/auth/email-otp/send/route';
import { POST as resetPassword } from '@/app/api/v1/auth/reset-password/route';
import { POST as login } from '@/app/api/v1/auth/login/route';
import { localStore } from '@/server/lib/store';
import { activeOtpStore } from '@/server/lib/otpStore';
import * as prismaModule from '@/server/lib/prisma';
import { hashPassword } from '@/server/lib/auth';

describe('TradeLedger — Forgot Password & Password Reset Flow', () => {
  const TEST_EMAIL = 'counter.staff@dealership.com';
  const INITIAL_PASSWORD = 'oldPassword123';
  const NEW_PASSWORD = 'newSecurePassword456';

  beforeEach(async () => {
    vi.spyOn(prismaModule, 'isPostgresAvailable').mockResolvedValue(false);
    activeOtpStore.clear();

    // Seed local user with initial password
    const hashed = await hashPassword(INITIAL_PASSWORD);
    localStore.createUser({
      tenantId: 'tenant-01',
      name: 'Counter Staff',
      phone: '9822100000',
      email: TEST_EMAIL,
      role: 'COUNTER_STAFF',
      password: hashed,
      isActive: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid email address', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        otp: '123456',
        newPassword: NEW_PASSWORD,
      }),
    });
    const res = await resetPassword(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('valid email');
  });

  it('rejects password shorter than 6 characters', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        otp: '123456',
        newPassword: '123',
      }),
    });
    const res = await resetPassword(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('at least 6 characters');
  });

  it('rejects invalid or expired OTP code', async () => {
    // Seed expired or mismatching OTP
    activeOtpStore.set(`email:${TEST_EMAIL}`, {
      otp: '999999',
      expiresAt: Date.now() - 1000, // expired
      userId: 'staff-user-01',
      tenantId: 'tenant-01',
      role: 'COUNTER_STAFF',
      name: 'Counter Staff',
    });

    const req = new NextRequest('http://localhost:3000/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        otp: '111222',
        newPassword: NEW_PASSWORD,
      }),
    });
    const res = await resetPassword(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('verification code');
  });

  it('successfully resets password, sets auth cookie, and permits login with new password', async () => {
    // 1. Request OTP via email-otp send
    const sendReq = new NextRequest('http://localhost:3000/api/v1/auth/email-otp/send', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        mode: 'DEALERSHIP',
      }),
    });
    const sendRes = await sendEmailOtp(sendReq);
    expect(sendRes.status).toBe(200);

    // Retrieve active OTP stored for this email
    const session = activeOtpStore.get(`email:${TEST_EMAIL}`);
    expect(session).toBeDefined();
    const generatedOtp = session!.otp;

    // 2. Submit password reset with the generated OTP
    const resetReq = new NextRequest('http://localhost:3000/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        otp: generatedOtp,
        newPassword: NEW_PASSWORD,
        mode: 'DEALERSHIP',
      }),
    });
    const resetRes = await resetPassword(resetReq);
    expect(resetRes.status).toBe(200);
    const resetBody = await resetRes.json();
    expect(resetBody.success).toBe(true);
    expect(resetRes.headers.get('set-cookie')).toBeDefined();

    // OTP session should now be cleaned up
    expect(activeOtpStore.get(`email:${TEST_EMAIL}`)).toBeUndefined();

    // 3. Verify user can now log in using NEW_PASSWORD
    const loginReq = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: TEST_EMAIL,
        password: NEW_PASSWORD,
      }),
    });
    const loginRes = await login(loginReq);
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);

    // 4. Verify old password no longer works
    const oldLoginReq = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: TEST_EMAIL,
        password: INITIAL_PASSWORD,
      }),
    });
    const oldLoginRes = await login(oldLoginReq);
    expect(oldLoginRes.status).toBe(401);
  });
});
