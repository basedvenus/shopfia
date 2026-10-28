import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), rate: vi.fn(), photo: vi.fn(), vendor: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: mocks.session, requireRole: vi.fn(), requireVerifiedVendorProfile: vi.fn() }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("@/lib/db", () => ({ db: { partyPhoto: { findFirst: mocks.photo }, vendorProfile: { findFirst: mocks.vendor, updateMany: mocks.update } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { updateUnclaimedVendorSocialsAction } from "@/app/actions/vendor";
const input = { vendorId: "cmv00417g000392dgmtxxlwjz", photoId: "cmv0042cg000592dgxq7ftq67", instagram: "@qstar", tiktok: "qstar", website: "qstar.example", original: { instagramUrl: null, tiktokUrl: null, website: null } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "party-owner" } });
  mocks.rate.mockResolvedValue({ ok: true });
  mocks.photo.mockResolvedValue({ id: input.photoId });
  mocks.vendor.mockResolvedValue({ slug: "q-star" });
  mocks.update.mockResolvedValue({ count: 1 });
});
describe("community vendor social links from the party editor", () => {
  it("accepts usernames and immediately updates the shared unclaimed profile", async () => {
    const result = await updateUnclaimedVendorSocialsAction(input);
    expect(result).toMatchObject({ ok: true, socials: { instagramUrl: "https://www.instagram.com/qstar/", tiktokUrl: "https://www.tiktok.com/@qstar/", website: "https://qstar.example" } });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: input.vendorId, status: "UNCLAIMED", userId: null, ...input.original }, data: result.ok ? result.socials : null });
    expect(mocks.revalidate).toHaveBeenCalledWith("/vendor/profile/q-star");
    expect(mocks.revalidate).toHaveBeenCalledWith("/q-star");
  });
  it("accepts profile URLs and permits correcting or removing existing links on later party edits", async () => {
    const original = { instagramUrl: "https://instagram.com/oldname", tiktokUrl: "https://tiktok.com/@oldname", website: "https://old.example" };
    expect(await updateUnclaimedVendorSocialsAction({ ...input, original, instagram: "https://instagram.com/qstar/?igsh=123", tiktok: "", website: "" })).toMatchObject({ ok: true, socials: { instagramUrl: "https://www.instagram.com/qstar/", tiktokUrl: null, website: null } });
    expect(mocks.update.mock.calls[0][0].where).toMatchObject(original);
  });
  it("requires the signed-in user's party photo including draft uploads", async () => {
    mocks.photo.mockResolvedValue(null);
    expect(await updateUnclaimedVendorSocialsAction(input)).toMatchObject({ ok: false });
    expect(mocks.photo).toHaveBeenCalledWith({ where: { id: input.photoId, userId: "party-owner", OR: [{ eventId: null }, { event: { userId: "party-owner" } }] }, select: { id: true } });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("blocks claimed and owner-managed profiles", async () => {
    mocks.vendor.mockResolvedValue(null);
    expect(await updateUnclaimedVendorSocialsAction(input)).toMatchObject({ ok: false, error: expect.stringContaining("owner now manages") });
    expect(mocks.vendor.mock.calls[0][0].where).toMatchObject({ status: "UNCLAIMED", userId: null });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("cannot overwrite a simultaneous claim or another community edit", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect(await updateUnclaimedVendorSocialsAction(input)).toMatchObject({ ok: false, error: expect.stringContaining("Refresh") });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each([{ instagram: "https://evil.test/qstar" }, { tiktok: "https://tiktok.com/@qstar/video/123" }, { website: "javascript:alert(1)" }, { website: "https://user:password@example.com" }])("rejects invalid public links: %j", async (change) => {
    expect(await updateUnclaimedVendorSocialsAction({ ...input, ...change })).toMatchObject({ ok: false });
    expect(mocks.photo).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("honors rate limits", async () => {
    mocks.rate.mockResolvedValue({ ok: false });
    expect(await updateUnclaimedVendorSocialsAction(input)).toMatchObject({ ok: false });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mocks.session.mockRejectedValue(new Error("Sign in required"));
    await expect(updateUnclaimedVendorSocialsAction(input)).rejects.toThrow("Sign in required");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
