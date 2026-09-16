// OpenRouter's free tier is capped per *day*, account-wide across every free
// model — not per model, which is what the seat-per-model design originally
// assumed. A board meeting costs 23 of 50, so it is worth one cheap GET to
// find out before spending them.
//
// This endpoint does not count against the free-model allowance.

const KEY_URL = 'https://openrouter.ai/api/v1/auth/key';

export async function fetchFreeQuota({ apiKey, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(KEY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const payload = await res.json();
    const block = payload?.data?.free_model_daily_requests;
    if (!block || typeof block !== 'object') return null;

    const used = Number(block.used) || 0;
    const limit = Number(block.limit) || 0;
    const remaining =
      block.remaining === undefined || block.remaining === null
        ? Math.max(0, limit - used)
        : Math.max(0, Number(block.remaining) || 0);

    return { used, limit, remaining };
  } catch {
    // An unknown quota must never be the reason a meeting cannot happen.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Shared wording so the board and the content team explain this the same way.
export function quotaMessage({ needed, quota, what }) {
  return (
    `Not enough free quota to ${what}. It needs ${needed} model calls and ` +
    `${quota.remaining} of your ${quota.limit} daily free requests are left. ` +
    'The allowance resets daily, or 10 credits on OpenRouter raises it to 1000 a day.'
  );
}
