import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE_NAME } from '@/server/lib/auth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  // Explicitly clear staff auth cookie
  response.cookies.set({
    name: TOKEN_COOKIE_NAME,
    value: '',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  // Explicitly clear customer portal auth cookie
  response.cookies.set({
    name: 'autoledger_customer_token',
    value: '',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return response;
}
