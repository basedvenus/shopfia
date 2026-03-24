const windows = new Map<string, number[]>();

export function checkRateLimit(key: string, limit = 10, intervalMs = 60_000) {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < intervalMs);
  if (hits.length >= limit) {
    return { ok: false, remaining: 0 };
  }
  hits.push(now);
  windows.set(key, hits);
  return { ok: true, remaining: Math.max(0, limit - hits.length) };
}
