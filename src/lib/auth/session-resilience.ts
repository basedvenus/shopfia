import { AsyncLocalStorage } from "node:async_hooks";

const sessionCheck = new AsyncLocalStorage<{ lookupUnavailable: boolean }>();
const transientCodes = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "ECONNRESET", "ETIMEDOUT"]);

/** Retry a transient read once; a missing account is never treated as an outage. */
export async function lookupSessionAccount<T>(lookup: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await lookup();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (attempt === 0 && transientCodes.has(code)) continue;
      const state = sessionCheck.getStore();
      if (state) state.lookupUnavailable = true;
      throw error;
    }
  }
}

/** Auth.js clears JWT cookies on callback exceptions, including database outages.
 * Deny this request without forwarding that deletion; the next check can recover.
 */
export async function withSessionCookieProtection(handler: () => Promise<Response>): Promise<Response> {
  return sessionCheck.run({ lookupUnavailable: false }, async () => {
    const response = await handler();
    if (!sessionCheck.getStore()?.lookupUnavailable) return response;
    return Response.json({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store", "Retry-After": "5" }
    });
  });
}
