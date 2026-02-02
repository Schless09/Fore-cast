import { NextRequest, NextResponse } from 'next/server';

const ADMIN_UNLOCK_COOKIE = 'admin_unlocked';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const expected = process.env.ADMIN_CODE;
  
  if (!expected) {
    console.error('[Admin] ADMIN_CODE environment variable not set');
    return NextResponse.json({ error: 'Admin access not configured' }, { status: 500 });
  }

  if (code !== expected) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_UNLOCK_COOKIE, '1', {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
