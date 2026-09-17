import { NextResponse } from 'next/server';
import { verifySessionToken } from './lib/session.mjs';
import { isPublicPath, fallbackFor } from './lib/gate.mjs';

// A lightweight gate so this isn't a wide-open URL on the public internet —
// not bank-grade security, just enough to keep it private to you. Treat it
// as a doorlock, not a vault: don't put real account numbers or passwords
// inside expense notes.
//
// This was middleware.js until Next 16, which renamed the convention to
// "proxy". The rename is not cosmetic here: middleware ran on the Edge
// runtime, proxy defaults to Node.js, and the Edge build was what failed to
// initialise in production with MIDDLEWARE_INVOCATION_FAILED.
export async function proxy(req) {
  const { pathname } = req.nextUrl;

  try {
    if (isPublicPath(pathname)) return NextResponse.next();

    // The cookie is a signed token rather than the password, so an unset
    // APP_PASSWORD fails closed: nothing verifies and everything redirects.
    const token = req.cookies.get('personal_os_auth')?.value;
    if (await verifySessionToken({ token, secret: process.env.APP_PASSWORD })) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/login', req.url));
  } catch (err) {
    // Anything thrown here takes down every route at once rather than one
    // page. Log the cause so it is visible in the platform's runtime logs,
    // then degrade to "not logged in" instead of to a crash.
    console.error(`[proxy] gate failed for ${pathname}:`, err?.stack || err);

    try {
      if (fallbackFor(pathname) === 'allow') return NextResponse.next();
      return NextResponse.redirect(new URL('/login', req.url));
    } catch {
      // Even building the redirect failed. Refuse the request rather than
      // letting it through — this path must never fail open.
      return new NextResponse('Authentication unavailable', { status: 503 });
    }
  }
}

export const config = {
  // icon.png is the App Router's generated favicon. Left gated it redirects to
  // /login, so the browser never gets an icon and falls back to probing
  // /favicon.ico — which is where the 404s in the console came from.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|icons|sw.js).*)',
  ],
};
