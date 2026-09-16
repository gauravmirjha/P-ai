import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFreeQuota } from '../lib/quota.mjs';

const body = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });

test('reads the daily free-request allowance', async () => {
  const impl = async () =>
    body({ free_model_daily_requests: { used: 61, limit: 50, remaining: 0 } });

  const quota = await fetchFreeQuota({ apiKey: 'k', fetchImpl: impl });

  assert.deepEqual(quota, { used: 61, limit: 50, remaining: 0 });
});

test('derives remaining when the API omits it', async () => {
  const impl = async () => body({ free_model_daily_requests: { used: 20, limit: 50 } });

  const quota = await fetchFreeQuota({ apiKey: 'k', fetchImpl: impl });

  assert.equal(quota.remaining, 30);
});

test('never reports negative headroom', async () => {
  const impl = async () => body({ free_model_daily_requests: { used: 61, limit: 50 } });

  const quota = await fetchFreeQuota({ apiKey: 'k', fetchImpl: impl });

  assert.equal(quota.remaining, 0, 'over the cap is zero left, not minus eleven');
});

test('returns null when the response has no quota block', async () => {
  const impl = async () => body({ label: 'some key' });

  assert.equal(await fetchFreeQuota({ apiKey: 'k', fetchImpl: impl }), null);
});

test('returns null when the quota endpoint is unreachable', async () => {
  const impl = async () => {
    throw new Error('offline');
  };

  assert.equal(
    await fetchFreeQuota({ apiKey: 'k', fetchImpl: impl }),
    null,
    'an unknown quota must not block a meeting'
  );
});

test('returns null with no api key rather than calling out', async () => {
  let called = false;
  const impl = async () => {
    called = true;
    return body({});
  };

  assert.equal(await fetchFreeQuota({ apiKey: '', fetchImpl: impl }), null);
  assert.equal(called, false, 'no point asking about a key that does not exist');
});
