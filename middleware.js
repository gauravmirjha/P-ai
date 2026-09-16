import { NextResponse } from 'next/server';

// A lightweight gate so this isn't a wide-open URL on the public internet —
// not bank-grade security, just enough to keep it private to you. Treat it
// as a doorlock, not a vault: don't put real account numbers or passwords
// inside expense notes.
export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/cron')
  ) {
    return NextResponse.next();
  }

  const auth = req.cookies.get('personal_os_auth')?.value;
  if (process.env.APP_PASSWORD && auth === process.env.APP_PASSWORD) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // icon.png is the App Router's generated favicon. Left gated it redirects to
  // /login, so the browser never gets an icon and falls back to probing
  // /favicon.ico — which is where the 404s in the console came from.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|icons|sw.js).*)',
  ],
};
