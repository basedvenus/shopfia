import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("EMAIL_SERVER_HOST", "smtp.resend.com");
  vi.stubEnv("EMAIL_SERVER_PORT", "465");
  vi.stubEnv("EMAIL_SERVER_USER", "resend");
  vi.stubEnv("EMAIL_FROM", "ShopFia <no-reply@shopfia.app>");
  vi.stubEnv("EMAIL_SERVER_PASSWORD", "");
  vi.stubEnv("RESEND_API_KEY", "test-resend-key");
});
afterEach(() => vi.unstubAllEnvs());

it("uses the Vercel-managed Resend key for Resend SMTP", async () => {
  const { authProviderConfig } = await import("@/lib/auth/provider-config");
  expect(authProviderConfig.emailEnabled).toBe(true);
  expect(authProviderConfig.email.password).toBe("test-resend-key");
});

it("does not send the Resend key to a different SMTP provider", async () => {
  vi.stubEnv("EMAIL_SERVER_HOST", "smtp.example.com");
  const { authProviderConfig } = await import("@/lib/auth/provider-config");
  expect(authProviderConfig.emailEnabled).toBe(false);
  expect(authProviderConfig.email.password).toBeUndefined();
});

it("preserves an explicitly configured SMTP password", async () => {
  vi.stubEnv("EMAIL_SERVER_PASSWORD", "existing-test-password");
  const { authProviderConfig } = await import("@/lib/auth/provider-config");
  expect(authProviderConfig.email.password).toBe("existing-test-password");
});
