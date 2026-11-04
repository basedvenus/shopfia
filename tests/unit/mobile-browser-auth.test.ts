import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), user: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { verificationToken: { create: mocks.create, findUnique: mocks.findUnique, deleteMany: mocks.deleteMany }, user: { findUnique: mocks.user } } }));
vi.mock("@/lib/auth/mobile-session", () => ({ createMobileAuthSession: mocks.session }));
import { browserLoginParameters, issueBrowserHandoff, redeemBrowserHandoff, verifierChallenge } from "@/lib/auth/mobile-browser";
const state = "s".repeat(43), verifier = "v".repeat(43), code = "c".repeat(43);
function record(overrides = {}) {
  return { token: createHash("sha256").update(code).digest("hex"), identifier: "mobile-browser-v1:" + JSON.stringify({ userId: "user-1", state, challenge: verifierChallenge(verifier) }), expires: new Date(Date.now() + 60_000), ...overrides };
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.findUnique.mockResolvedValue(record()); mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.user.mockResolvedValue({ id: "user-1", email: "test@example.com", name: "Test", username: "test", role: "BUYER", image: null });
  mocks.session.mockResolvedValue({ cookie: "session", session: {} });
});
describe("browser to native app sign-in handoff", () => {
  it("requires strong state and SHA256 PKCE parameters", () => {
    expect(browserLoginParameters.safeParse({ state: "weak", challenge: "weak" }).success).toBe(false);
    expect(browserLoginParameters.safeParse({ state, challenge: verifierChallenge(verifier) }).success).toBe(true);
  });
  it("stores only a code hash and uses a fixed app callback without session credentials", async () => {
    const callback = await issueBrowserHandoff("user-1", { state, challenge: verifierChallenge(verifier) });
    expect(callback.protocol).toBe("shopfia-preview:"); expect(callback.host).toBe("auth");
    expect([...callback.searchParams.keys()]).toEqual(["state", "code"]);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.token).toBe(createHash("sha256").update(callback.searchParams.get("code")!).digest("hex"));
    expect(data.expires.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
    expect(mocks.deleteMany.mock.calls[0][0].where.identifier.startsWith).toBe("mobile-browser-v1:");
  });
  it("rejects a stolen code without its original PKCE verifier", async () => {
    await expect(redeemBrowserHandoff({ code, state, verifier: "x".repeat(43) }, "https://www.shopfia.app")).rejects.toThrow();
    expect(mocks.deleteMany).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled();
  });
  it("rejects mismatched app state and expired or unrelated tokens", async () => {
    await expect(redeemBrowserHandoff({ code, state: "x".repeat(43), verifier }, "https://www.shopfia.app")).rejects.toThrow();
    mocks.findUnique.mockResolvedValue(record({ expires: new Date(0) }));
    await expect(redeemBrowserHandoff({ code, state, verifier }, "https://www.shopfia.app")).rejects.toThrow();
    mocks.findUnique.mockResolvedValue(record({ identifier: "email-login" }));
    await expect(redeemBrowserHandoff({ code, state, verifier }, "https://www.shopfia.app")).rejects.toThrow();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("consumes atomically and refuses replay or a lost exchange race", async () => {
    await redeemBrowserHandoff({ code, state, verifier }, "https://www.shopfia.app");
    expect(mocks.session).toHaveBeenCalledOnce();
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    await expect(redeemBrowserHandoff({ code, state, verifier }, "https://www.shopfia.app")).rejects.toThrow();
    expect(mocks.session).toHaveBeenCalledOnce();
  });
});
