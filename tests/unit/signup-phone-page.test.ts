import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), configured: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: mocks.query } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/services/twilio-verify", () => ({ isPhoneVerificationConfigured: mocks.configured }));
vi.mock("@/components/account/phone-verification-form", () => ({ PhoneVerificationForm: () => null }));
import VerifyPhonePage from "@/app/account/verify-phone/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "new-user" } });
  mocks.query.mockResolvedValue([]);
  mocks.configured.mockReturnValue(true);
});
it("requires sign-in before reading a phone record", async () => {
  mocks.auth.mockResolvedValue(null);
  await expect(VerifyPhonePage()).rejects.toThrow("redirect:/account");
  expect(mocks.query).not.toHaveBeenCalled();
});
it("advances only after the server has a verified phone", async () => {
  mocks.query.mockResolvedValue([{ phone: "+14155550123", verifiedAt: new Date() }]);
  await expect(VerifyPhonePage()).rejects.toThrow("redirect:/account/setup");
});
it.each([{ record: [] }, { record: [{ phone: "+14155550123", verifiedAt: null }] }])("keeps an unverified account on phone verification", async ({ record }) => {
  mocks.query.mockResolvedValue(record);
  const page = await VerifyPhonePage();
  expect(page.type).toBe("section");
  expect(mocks.configured).toHaveBeenCalledOnce();
});
