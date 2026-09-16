// The session cookie used to be the password itself, which meant anything that
// could read the cookie — a browser profile, a proxy log, a backup — had the
// password. This issues a signed, expiring token instead: a leaked cookie now
// costs you a session, not the secret.
//
// Web Crypto rather than node:crypto, because middleware runs on the Edge
// runtime where node:crypto is not available.

const encoder = new TextEncoder();

// Bumping this invalidates every existing cookie, which is what you want if the
// signing scheme ever changes.
const VERSION = 'v1';

export const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

async function sign(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// The expiry is signed along with the version, so moving the expiry forward
// invalidates the signature rather than extending the session.
const payloadFor = (exp) => `${VERSION}:${exp}`;

export async function createSessionToken({ secret, now = Date.now(), ttlMs = DEFAULT_TTL_MS }) {
  const exp = now + ttlMs;
  return `${exp}.${await sign(secret, payloadFor(exp))}`;
}

// Compares in constant time. The signature is not secret, but comparing it with
// === leaks how much of it matched through timing.
function equalInConstantTime(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionToken({ token, secret, now = Date.now() }) {
  // No secret configured means no one gets in, rather than everyone.
  if (!secret || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expRaw, signature] = parts;
  if (!/^\d+$/.test(expRaw) || !signature) return false;

  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp <= now) return false;

  return equalInConstantTime(signature, await sign(secret, payloadFor(exp)));
}
