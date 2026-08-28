import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  createMobileAuthSession: vi.fn(),
  userFindUnique: vi.fn()
}));

vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/auth/provider-config", () => ({
  authProviderConfig: { authSecret: "test-auth-secret" }
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true }))
}));
vi.mock("@/lib/auth/mobile-session", () => ({
  createMobileAuthSession: mocks.createMobileAuthSession
}));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: mocks.userFindUnique } }
}));
vi.mock("@/lib/security/request", () => ({
  enforceRequestRateLimit: vi.fn(() => null)
}));

const user = {
  email: "venus@example.com",
  id: "user_1",
  image: null,
  name: "Venus",
  passwordHash: "stored-password-hash",
  role: "BUYER",
  username: "venus"
};

describe("mobile password authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(user);
    mocks.compare.mockResolvedValue(true);
    mocks.createMobileAuthSession.mockResolvedValue({
      cookie: "__Secure-authjs.session-token=signed-mobile-session; Path=/; HttpOnly; Secure",
      session: {
        expires: "2026-09-27T00:00:00.000Z",
        user: { ...user, passwordHash: undefined }
      }
    });
  });

  it("signs an existing website password account into the shared Auth.js session", async () => {
    const { POST } = await import("@/app/api/mobile/auth/password/route");
    const response = await POST(new Request("https://www.shopfia.app/api/mobile/auth/password", {
      body: JSON.stringify({ email: " Venus@Example.com ", password: "correct horse battery staple" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.userFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "venus@example.com" }
    }));
    expect(mocks.compare).toHaveBeenCalledWith("correct horse battery staple", "stored-password-hash");
    expect(mocks.createMobileAuthSession).toHaveBeenCalledWith(user, "https://www.shopfia.app/api/mobile/auth/password");
    expect(body.sessionCookie).toBe("__Secure-authjs.session-token=signed-mobile-session");
    expect(response.headers.get("set-cookie")).toContain("signed-mobile-session");
  });

  it("returns the same generic error for an incorrect password", async () => {
    mocks.compare.mockResolvedValue(false);
    const { POST } = await import("@/app/api/mobile/auth/password/route");
    const response = await POST(new Request("https://www.shopfia.app/api/mobile/auth/password", {
      body: JSON.stringify({ email: "venus@example.com", password: "incorrect" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Email or password is incorrect." });
    expect(mocks.createMobileAuthSession).not.toHaveBeenCalled();
  });

  it("rejects malformed credentials without querying ShopFia accounts", async () => {
    const { POST } = await import("@/app/api/mobile/auth/password/route");
    const response = await POST(new Request("https://www.shopfia.app/api/mobile/auth/password", {
      body: JSON.stringify({ email: "not-an-email", password: "" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));

    expect(response.status).toBe(400);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });
});
