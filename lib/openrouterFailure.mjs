// How a failed OpenRouter call should be read, and how hard to keep trying.
//
// This exists because of a real incident: the free allowance is 50 requests a
// day account-wide, and on a 429 the caller used to move down the model list.
// But an account-wide cap is not a property of the model, so every fallback
// 429s as well — and every one of those still counts. A key with a limit of 50
// finished the day on 61 used, and a meeting estimated at 9 calls could spend
// many times that.

// Matched against the 429 body. OpenRouter's wording has changed before, so
// this deliberately matches the idea rather than one exact string.
const DAILY = /free-models-per-day|per[-\s]?day|daily/i;

export function classifyFailure(status, body) {
  if (status === 429) {
    // An unreadable body is treated as the ordinary kind. Guessing "daily"
    // would abandon a meeting that a different model could have finished; the
    // attempt cap below bounds the cost of guessing wrong this way.
    return DAILY.test(String(body ?? '')) ? 'daily_cap' : 'rate_limited';
  }
  if (status === 404) return 'unavailable';
  return 'http_error';
}

// Only the daily cap is worth abandoning everything for, because it is the one
// failure every other model in the list shares.
export function isFatal(code) {
  return code === 'daily_cap';
}

// A backstop independent of classification. Free models rotate out, so falling
// down the list is worth doing — but not nine times per call. Three attempts
// keeps the resilience and bounds the worst case.
export const MAX_ATTEMPTS = 3;

export function attemptOrder(models) {
  return models.slice(0, MAX_ATTEMPTS);
}
