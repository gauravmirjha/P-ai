import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, isFatal, MAX_ATTEMPTS, attemptOrder } from '../lib/openrouterFailure.mjs';

// --- classification -------------------------------------------------------

test('a daily free-cap 429 is told apart from an ordinary rate limit', () => {
  const daily = classifyFailure(429, '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}');
  assert.equal(daily, 'daily_cap');
});

test('wording variants of the daily cap are still recognised', () => {
  for (const body of [
    'free-models-per-day',
    'You have exceeded your daily quota',
    'limit reached for free models per day',
    'DAILY LIMIT EXCEEDED',
  ]) {
    assert.equal(classifyFailure(429, body), 'daily_cap', body);
  }
});

test('a per-minute rate limit stays retryable on another model', () => {
  // This one really is per model, so moving down the list is the right move.
  assert.equal(classifyFailure(429, 'rate limit exceeded, please slow down'), 'rate_limited');
});

test('an unreadable 429 body is treated as retryable, bounded by the attempt cap', () => {
  for (const body of ['', null, undefined, '<html>502</html>']) {
    assert.equal(classifyFailure(429, body), 'rate_limited', JSON.stringify(body));
  }
});

test('other statuses keep their existing meanings', () => {
  assert.equal(classifyFailure(404, ''), 'unavailable');
  assert.equal(classifyFailure(500, ''), 'http_error');
  assert.equal(classifyFailure(403, ''), 'http_error');
});

// --- what to do about it --------------------------------------------------

test('only the daily cap stops the whole run', () => {
  assert.equal(isFatal('daily_cap'), true, 'every other model shares the same exhausted allowance');
  for (const code of ['rate_limited', 'unavailable', 'http_error', 'timeout', undefined]) {
    assert.equal(isFatal(code), false, `${code} should still fall through to the next model`);
  }
});

// --- attempt budget -------------------------------------------------------

test('a single call never walks the whole model list', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const order = attemptOrder(list);
  assert.equal(order.length, MAX_ATTEMPTS, 'bounded, so one failing call cannot burn nine requests');
  assert.deepEqual(order, list.slice(0, MAX_ATTEMPTS), 'and it keeps the preferred order');
});

test('a short list is used as-is', () => {
  assert.deepEqual(attemptOrder(['a', 'b']), ['a', 'b']);
  assert.deepEqual(attemptOrder([]), []);
});
