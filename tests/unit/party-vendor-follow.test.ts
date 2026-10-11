import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), revalidate: vi.fn(), vendor: vi.fn(), follow: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { vendorProfile: { findUnique: mocks.vendor }, follow: { upsert: mocks.follow } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
import { followPartyVendorAction } from "@/app/actions/auth";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "viewer" } });
  mocks.rate.mockResolvedValue({ ok: true });
  mocks.vendor.mockResolvedValue({ userId: "vendor-owner", status: "CLAIMED", slug: "bakery" });
});
describe("following a tagged party vendor", () => {
  it("follows the resolved vendor owner without toggling an existing follow off", async () => {
    expect(await followPartyVendorAction("vendor-id")).toEqual({ ok: true });
    expect(mocks.vendor).toHaveBeenCalledWith({ where: { id: "vendor-id" }, select: { userId: true, status: true, slug: true } });
    expect(mocks.follow).toHaveBeenCalledWith({ where: { followerId_followingId: { followerId: "viewer", followingId: "vendor-owner" } }, create: { followerId: "viewer", followingId: "vendor-owner" }, update: {} });
  });
  it("requires a signed-in user", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await followPartyVendorAction("vendor-id")).ok).toBe(false);
    expect(mocks.follow).not.toHaveBeenCalled();
  });
  it("does not follow an unclaimed or ownerless vendor", async () => {
    mocks.vendor.mockResolvedValue({ userId: null, status: "UNCLAIMED", slug: "bakery" });
    expect((await followPartyVendorAction("vendor-id")).ok).toBe(false);
    expect(mocks.follow).not.toHaveBeenCalled();
  });
  it("does not follow your own vendor profile", async () => {
    mocks.vendor.mockResolvedValue({ userId: "viewer", status: "CLAIMED", slug: "bakery" });
    expect((await followPartyVendorAction("vendor-id")).ok).toBe(false);
    expect(mocks.follow).not.toHaveBeenCalled();
  });
});
