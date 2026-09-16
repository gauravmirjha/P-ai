import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from '../lib/session.mjs';

const SECRET = 'correct horse battery staple';

test('a freshly issued token verifies against the same secret', async () => {
  const token = await createSessionToken({ secret: SECRET });

  assert.equal(await verifySessionToken({ token, secret: SECRET }), true);
});

test('the token never contains the secret itself', async () => {
  const token = await createSessionToken({ secret: SECRET });

  assert.ok(!token.includes(SECRET));
});

test('a token issued under a different secret is rejected', async () => {
  const token = await createSessionToken({ secret: SECRET });

  assert.equal(await verifySessionToken({ token, secret: 'a different password' }), false);
});

test('a tampered signature is rejected', async () => {
  const token = await createSessionToken({ secret: SECRET });
  const [exp] = token.split('.');

  assert.equal(await verifySessionToken({ token: `${exp}.deadbeef`, secret: SECRET }), false);
});

test('extending the expiry without resigning is rejected', async () => {
  const token = await createSessionToken({ secret: SECRET });
  const [, sig] = token.split('.');
  const forged = `${Date.now() + 10_000_000}.${sig}`;

  assert.equal(await verifySessionToken({ token: forged, secret: SECRET }), false);
});

test('an expired token is rejected', async () => {
  const issuedAt = Date.now() - 60_000;
  const token = await createSessionToken({ secret: SECRET, now: issuedAt, ttlMs: 1000 });

  assert.equal(await verifySessionToken({ token, secret: SECRET }), false);
});

test('a token still inside its window is accepted', async () => {
  const token = await createSessionToken({ secret: SECRET, ttlMs: 60_000 });

  assert.equal(await verifySessionToken({ token, secret: SECRET }), true);
});

test('malformed and empty tokens are rejected rather than throwing', async () => {
  for (const token of ['', 'garbage', 'a.b.c', '....', undefined, null]) {
    assert.equal(await verifySessionToken({ token, secret: SECRET }), false);
  }
});

test('verification fails closed when no secret is configured', async () => {
  const token = await createSessionToken({ secret: SECRET });

  assert.equal(await verifySessionToken({ token, secret: '' }), false);
  assert.equal(await verifySessionToken({ token, secret: undefined }), false);
});
