// Which paths the cookie gate lets through, and what to do when the gate
// itself fails. Kept out of middleware.js so it can be tested directly —
// middleware runs on the Edge runtime and is awkward to exercise in a test.

// /api/cron is exempt from the cookie because Vercel's scheduler has no
// cookie; that route authenticates itself with CRON_SECRET instead.
const PUBLIC_PREFIXES = ['/login', '/api/login', '/api/cron'];

export function isPublicPath(pathname) {
  // Matching on the segment boundary, not a bare prefix: a plain startsWith
  // would also have exempted /loginsomething from the gate.
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// If the gate throws, a 500 takes down every page at once. Treat an unexpected
// failure as "not logged in" and send the user to the login page — except on
// the login page itself, which would redirect to itself forever.
export function fallbackFor(pathname) {
  return isPublicPath(pathname) ? 'allow' : 'redirect';
}
