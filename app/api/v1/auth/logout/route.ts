import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE_NAME } from '@/server/lib/auth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete(TOKEN_COOKIE_NAME);
  return response;
}
