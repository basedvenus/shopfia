import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
// Use the real Auth.js engine; bypass NextAuth's extensionless Next.js imports
// which require the Next build resolver rather than Vitest's native ESM loader.
vi.mock("next-auth", async () => {
  const { Auth } = await import("@auth/core");
  return { default: (config: Parameters<typeof Auth>[1]) => ({ handlers: { GET: (request: Request) => Auth(request, { ...config, basePath: "/api/auth" }) } }) };
});
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("@/lib/auth/provider-config", () => ({ authProviderConfig: { authSecret: "test-secret-for-session-resilience-only", googleEnabled: false, emailEnabled: false } }));
import { GET } from "@/app/api/auth/[...nextauth]/route";
import { lookupSessionAccount, withSessionCookieProtection } from "@/lib/auth/session-resilience";
const user = { id: "user_1", email: "saved@example.com", name: "Saved", role: "BUYER", username: "saved", image: null };
async function request() {
  const token = await encode({ secret: "test-secret-for-session-resilience-only", salt: "__Secure-authjs.session-token", token: { sub: "user_1", role: "ADMIN" } });
  return new NextRequest("https://www.shopfia.app/api/auth/session", { headers: { cookie: `__Secure-authjs.session-token=${token}` } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("real Auth.js session cookie persistence", () => {
  it("keeps a valid session cookie during a database outage, then recovers without signing in", async () => {
    mocks.findUnique.mockRejectedValue(new Error("database unavailable"));
    const sameBrowserRequest = await request();
    const failed = await GET(sameBrowserRequest);
    expect(failed.status).toBe(503);
    expect(failed.headers.get("Set-Cookie")).toBeNull();
    expect(failed.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await failed.json()).not.toHaveProperty("user");
    mocks.findUnique.mockResolvedValue(user);
    const recovered = await GET(sameBrowserRequest);
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).user).toMatchObject({ id: "user_1", role: "BUYER" });
    expect(recovered.headers.get("Set-Cookie")).toContain("__Secure-authjs.session-token=");
    expect(recovered.headers.get("Set-Cookie")).not.toContain("Max-Age=0");
    const expiry = new Date((await GET(sameBrowserRequest)).headers.get("Set-Cookie")!.match(/Expires=([^;]+)/)![1]);
    expect(expiry.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });
  it("retries a transient connection failure once without interrupting the session", async () => {
    mocks.findUnique.mockRejectedValueOnce(Object.assign(new Error("connection unavailable"), { code: "P1001" })).mockResolvedValueOnce(user);
    const response = await GET(await request());
    expect(response.status).toBe(200);
    expect((await response.json()).user.role).toBe("BUYER");
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });
  it("stops after two failed transient reads and preserves the cookie", async () => {
    mocks.findUnique.mockRejectedValue(Object.assign(new Error("connection unavailable"), { code: "P1001" }));
    const response = await GET(await request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });
  it("still clears the cookie for a deleted account", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await GET(await request());
    expect(await response.json()).toBeNull();
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("still clears an invalid JWT", async () => {
    const response = await GET(new NextRequest("https://www.shopfia.app/api/auth/session", { headers: { cookie: "__Secure-authjs.session-token=invalid" } }));
    expect(await response.json()).toBeNull();
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it("keeps concurrent request outage flags separate", async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const failed = withSessionCookieProtection(async () => {
      await lookupSessionAccount(async () => { throw new Error("offline"); }).catch(() => {});
      await waiting;
      return new Response("denied", { headers: { "Set-Cookie": "session=; Max-Age=0" } });
    });
    const healthy = await withSessionCookieProtection(async () => new Response("healthy", { headers: { "Set-Cookie": "session=healthy" } }));
    expect(healthy.status).toBe(200);
    expect(healthy.headers.get("Set-Cookie")).toBe("session=healthy");
    release();
    expect((await failed).status).toBe(503);
  });
});
