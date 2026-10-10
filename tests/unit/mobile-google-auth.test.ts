import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountCreate: vi.fn(),
  accountFindUnique: vi.fn(),
  encode: vi.fn(async () => "signed-shopfia-jwt"),
  userCreate: vi.fn(),
  userFindUnique: vi.fn(),
  verifyIdToken: vi.fn()
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = mocks.verifyIdToken;
  }
}));
vi.mock("next-auth/jwt", () => ({ encode: mocks.encode }));
vi.mock("@/lib/auth/provider-config", () => ({
  authProviderConfig: {
    authSecret: "test-auth-secret",
    googleIosClientId: "12345.apps.googleusercontent.com"
  }
}));
vi.mock("@/lib/db", () => ({
  db: {
    account: {
      create: mocks.accountCreate,
      findUnique: mocks.accountFindUnique
    },
    user: {
      create: mocks.userCreate,
      findUnique: mocks.userFindUnique
    }
  }
}));

import { createMobileGoogleSession, MobileGoogleAuthError } from "@/lib/auth/mobile-google";

const existingUser = {
  email: "venus@example.com",
  id: "user_existing",
  image: "https://example.com/avatar.jpg",
  name: "Venus",
  role: "BUYER",
  username: "venus"
};

function verifiedGoogleIdentity() {
  mocks.verifyIdToken.mockResolvedValue({
    getPayload: () => ({
      email: "Venus@Example.com",
      email_verified: true,
      name: "Venus",
      picture: "https://example.com/google-avatar.jpg",
      sub: "google_account_123"
    })
  });
}

describe("mobile Google Auth.js session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifiedGoogleIdentity();
  });

  it("uses the existing Google account and mints the website Auth.js cookie", async () => {
    mocks.accountFindUnique.mockResolvedValue({ user: existingUser, userId: existingUser.id });

    const result = await createMobileGoogleSession(
      "google-id-token",
      "https://www.shopfia.app/api/mobile/auth/google"
    );

    expect(mocks.verifyIdToken).toHaveBeenCalledWith({
      audience: "12345.apps.googleusercontent.com",
      idToken: "google-id-token"
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.encode).toHaveBeenCalledWith(expect.objectContaining({
      salt: "__Secure-authjs.session-token",
      secret: "test-auth-secret",
      token: expect.objectContaining({ sub: existingUser.id, username: "venus" })
    }));
    expect(result.cookie).toContain("__Secure-authjs.session-token=signed-shopfia-jwt");
    expect(result.cookie).toContain("Secure");
    expect(result.session.user.id).toBe(existingUser.id);
    expect(result.createdUser).toBe(false);
  });

  it.each([
    { emailVerified: null, passwordHash: "attacker-controlled-password-hash" },
    { emailVerified: new Date("2026-01-01"), passwordHash: "existing-password-hash" },
    { emailVerified: new Date("2026-01-01"), passwordHash: null }
  ])("refuses email-only account linking without proof of the existing account ($emailVerified)", async (credentials) => {
    mocks.accountFindUnique.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue({ ...existingUser, ...credentials });
    mocks.accountCreate.mockResolvedValue({ id: "account_1" });

    await expect(createMobileGoogleSession(
      "google-id-token",
      "https://www.shopfia.app/api/mobile/auth/google"
    )).rejects.toEqual(expect.objectContaining<Partial<MobileGoogleAuthError>>({ status: 409 }));

    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { email: "venus@example.com" } });
    expect(mocks.accountCreate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
  });

  it("creates a new user only when neither the Google subject nor email has an account", async () => {
    mocks.accountFindUnique.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue(existingUser);

    const result = await createMobileGoogleSession(
      "google-id-token",
      "https://www.shopfia.app/api/mobile/auth/google"
    );

    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "venus@example.com",
        emailVerified: expect.any(Date),
        image: null,
        accounts: { create: { provider: "google", providerAccountId: "google_account_123", type: "oidc" } }
      })
    });
    expect(mocks.accountCreate).not.toHaveBeenCalled();
    expect(result.createdUser).toBe(true);
  });

  it("rejects an unverified Google identity without touching ShopFia accounts", async () => {
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "venus@example.com",
        email_verified: false,
        sub: "google_account_123"
      })
    });

    await expect(createMobileGoogleSession(
      "unverified-token",
      "https://www.shopfia.app/api/mobile/auth/google"
    )).rejects.toEqual(expect.objectContaining<Partial<MobileGoogleAuthError>>({ status: 401 }));
    expect(mocks.accountFindUnique).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });
});
