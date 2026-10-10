import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), transaction: vi.fn(), update: vi.fn(), upsert: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); } }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction, vendorProfile: { update: mocks.update }, vendorProfileManager: { upsert: mocks.upsert } } }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: mocks.requireSession, requireRole: vi.fn(), requireVerifiedVendorProfile: vi.fn() }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/services/marketplace-fees", () => ({ createListing: vi.fn(), ensureSellerAccountForVendorProfile: vi.fn() }));
import { claimUnclaimedVendorAction } from "@/app/actions/vendor";
beforeEach(() => vi.clearAllMocks());
describe("business ownership claim boundary", () => {
  it.each(["BUYER", "VENDOR", "ADMIN"])("never grants ownership from only a public ID for %s", async (role) => {
    mocks.requireSession.mockResolvedValue({ user: { id: "unrelated-user", role } });
    const form = new FormData(); form.set("vendorId", "public-business-id");
    await expect(claimUnclaimedVendorAction(form)).rejects.toThrow("Business+ownership+must+be+reviewed");
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("still requires a signed-in session", async () => {
    mocks.requireSession.mockRejectedValueOnce(new Error("Sign in required"));
    await expect(claimUnclaimedVendorAction(new FormData())).rejects.toThrow("Sign in required");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
