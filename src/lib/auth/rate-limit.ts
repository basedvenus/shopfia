type RateWindow = {
  blockedUntil?: number;
  hits: number[];
  violations: number;
};

const windows = new Map<string, RateWindow>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs?: number;
};

export function checkRateLimit(key: string, limit = 10, intervalMs = 60_000): RateLimitResult {
  const now = Date.now();
  const state = windows.get(key) ?? { hits: [], violations: 0 };

  if (state.blockedUntil && state.blockedUntil > now) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: state.blockedUntil - now
    };
  }

  const hits = state.hits.filter((t) => now - t < intervalMs);
  if (hits.length >= limit) {
    const violations = state.violations + 1;
    const cooldownMs = Math.min(intervalMs * 10, intervalMs * Math.max(1, violations));
    windows.set(key, {
      blockedUntil: now + cooldownMs,
      hits,
      violations
    });
    return { ok: false, remaining: 0, retryAfterMs: cooldownMs };
  }

  hits.push(now);
  windows.set(key, {
    hits,
    violations: Math.max(0, state.violations - 1)
  });
  return { ok: true, remaining: Math.max(0, limit - hits.length) };
}

export function checkRateLimits(
  checks: Array<{ key: string; limit: number; intervalMs: number }>
): RateLimitResult {
  for (const check of checks) {
    const result = checkRateLimit(check.key, check.limit, check.intervalMs);
    if (!result.ok) return result;
  }

  return { ok: true, remaining: Math.min(...checks.map((check) => check.limit)) };
}
