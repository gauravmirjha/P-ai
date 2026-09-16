import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, fallbackFor } from '../lib/gate.mjs';

test('the login page and its endpoint are reachable without a session', () => {
  assert.equal(isPublicPath('/login'), true);
  assert.equal(isPublicPath('/api/login'), true);
});

test('the cron endpoint bypasses the cookie gate and guards itself', () => {
  assert.equal(isPublicPath('/api/cron/generate-ideas'), true);
});

test('everything else is gated', () => {
  for (const path of ['/', '/ledger', '/ideas', '/board', '/api/expenses', '/preview']) {
    assert.equal(isPublicPath(path), false, `${path} should be gated`);
  }
});

test('a path merely starting with the same letters is not public', () => {
  assert.equal(isPublicPath('/loginsomething'), false);
  assert.equal(isPublicPath('/api/loginx'), false);
});

// If the gate throws, the whole site must not 500. It has to fail closed —
// but redirecting /login to /login would loop forever.
test('an unexpected failure on a gated path redirects rather than crashing', () => {
  assert.equal(fallbackFor('/'), 'redirect');
  assert.equal(fallbackFor('/ledger'), 'redirect');
});

test('an unexpected failure on the login page is allowed through, not looped', () => {
  assert.equal(fallbackFor('/login'), 'allow');
  assert.equal(fallbackFor('/api/login'), 'allow');
});
