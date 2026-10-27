import { createHash } from "crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), create: vi.fn(), remove: vi.fn(), send: vi.fn(), rate: vi.fn(),
  config: { emailEnabled: true }
}));
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: mocks.findUnique },
  verificationToken: { create: mocks.create, delete: mocks.remove }
} }));
vi.mock("@/lib/auth/provider-config", () => ({ authProviderConfig: mocks.config }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: mocks.send }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("@/lib/security/audit-log", () => ({ securityLog: vi.fn() }));

import { requestPasswordResetAction } from "@/app/actions/password-reset";

function request(email = " Person@Example.com ") {
  const form = new FormData();
  form.set("email", email);
  return requestPasswordResetAction(form);
}

describe("password reset requests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXTAUTH_URL", "https://www.shopfia.app");
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    mocks.config.emailEnabled = true;
    mocks.findUnique.mockResolvedValue({ id: "user_1" });
    mocks.rate.mockResolvedValue({ ok: true });
    mocks.send.mockResolvedValue({ ok: true });
    mocks.create.mockResolvedValue({});
    mocks.remove.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("emails a random reset token, stores only its hash, and expires it in one hour", async () => {
    const before = Date.now();
    expect((await request()).ok).toBe(true);
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { email: "person@example.com" }, select: { id: true } });
    const [email, href] = mocks.send.mock.calls[0];
    const url = new URL(href);
    const raw = url.searchParams.get("token")!;
    expect(email).toBe("person@example.com");
    expect(url.origin + url.pathname).toBe("https://www.shopfia.app/account/reset-password");
    expect(url.searchParams.get("email")).toBe(email);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    const { data } = mocks.create.mock.calls[0][0];
    expect(data.identifier).toBe("password-reset:person@example.com");
    expect(data.token).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(data.expires.getTime()).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(data.expires.getTime()).toBeLessThanOrEqual(Date.now() + 3_600_000);
    expect(JSON.stringify(await request())).not.toContain(raw);
    expect(mocks.send.mock.calls[1][1]).not.toBe(href);
  });

  it("does not disclose whether an account exists", async () => {
    const existing = await request();
    mocks.findUnique.mockResolvedValue(null);
    mocks.send.mockClear();
    mocks.create.mockClear();
    expect(await request()).toEqual(existing);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid emails without database access", async () => {
    expect((await request("bad email")).ok).toBe(false);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rate limits before database access or email delivery", async () => {
    mocks.rate.mockResolvedValue({ ok: false });
    expect((await request()).ok).toBe(false);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("reports missing SMTP configuration instead of claiming email was sent", async () => {
    mocks.config.emailEnabled = false;
    expect((await request()).ok).toBe(false);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("removes only the new token on delivery failure and reports failure", async () => {
    mocks.send.mockResolvedValue({ ok: false });
    expect((await request()).ok).toBe(false);
    const { data } = mocks.create.mock.calls[0][0];
    expect(mocks.remove).toHaveBeenCalledWith({ where: { identifier_token: {
      identifier: data.identifier, token: data.token
    } } });
  });

  it("handles database failures without exposing details", async () => {
    mocks.create.mockRejectedValue(new Error("private database details"));
    const result = await request();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private database details");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses a missing or insecure production link origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "");
    expect((await request()).ok).toBe(false);
    vi.stubEnv("NEXTAUTH_URL", "http://www.shopfia.app");
    expect((await request()).ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
