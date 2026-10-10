import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), read: vi.fn(), user: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: mocks.limit }));
vi.mock("@/lib/services/stripe-mode", () => ({ readStripeMode: mocks.read }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.user } } }));
import { GET } from "@/app/api/admin/payments/mode/route";
const request = () => new Request("https://example.test/api/admin/payments/mode");
beforeEach(() => { vi.clearAllMocks(); mocks.limit.mockReturnValue(null); mocks.user.mockResolvedValue({ role: "ADMIN" }); });

describe("admin-only payment mode read", () => {
  it("rejects anonymous requests before any Stripe call", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["BUYER", "VENDOR"])("rejects %s before any Stripe call", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "synthetic_user", role } });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns only admin mode verification with no-store headers", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "synthetic_admin", role: "ADMIN" } });
    mocks.read.mockResolvedValue({ livemode: false, commit: "test_commit" });
    const result = await GET(request());
    expect(await result.json()).toEqual({ livemode: false, commit: "test_commit" });
    expect(result.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not call Stripe when rate limited", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "synthetic_admin", role: "ADMIN" } });
    mocks.limit.mockReturnValue(new Response(null, { status: 429 }));
    expect((await GET(request())).status).toBe(429);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns unavailable rather than a guessed mode or raw error", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "synthetic_admin", role: "ADMIN" } });
    mocks.read.mockRejectedValue(new Error("private provider details"));
    const result = await GET(request());
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "Stripe mode could not be verified" });
  });
  it.each([null, { role: "BUYER" }])("rejects a revoked or deleted administrator", async (user) => {
    mocks.auth.mockResolvedValue({ user: { id: "former_admin", role: "ADMIN" } });
    mocks.user.mockResolvedValue(user);
    expect((await GET(request())).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("fails closed when the current administrator role cannot be read", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "synthetic_admin", role: "ADMIN" } });
    mocks.user.mockRejectedValue(new Error("database unavailable"));
    expect((await GET(request())).status).toBe(503);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
