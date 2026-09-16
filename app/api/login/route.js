import { NextResponse } from 'next/server';
import { createSessionToken, DEFAULT_TTL_MS } from '@/lib/session.mjs';

export async function POST(req) {
  const { password } = await req.json();
  const expected = process.env.APP_PASSWORD;

  if (password && expected && password === expected) {
    // The cookie carries a signed token, not the password. Signing it with the
    // password means changing APP_PASSWORD also logs every old session out.
    const res = NextResponse.json({ ok: true });
    res.cookies.set('personal_os_auth', await createSessionToken({ secret: expected }), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: DEFAULT_TTL_MS / 1000,
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
}
