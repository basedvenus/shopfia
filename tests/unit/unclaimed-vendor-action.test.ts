import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), rate: vi.fn(), category: vi.fn(), findVendor: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: mocks.session, requireRole: vi.fn(), requireVerifiedVendorProfile: vi.fn() }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("@/lib/db", () => ({ db: { category: { upsert: mocks.category }, vendorProfile: { findUnique: mocks.findVendor, create: mocks.create } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createUnclaimedVendorAction } from "@/app/actions/vendor";
const input = { name: "Sample Florist", city: "Fairfield", state: "CA", categories: ["Florals"], bookingChannel: "Instagram DM", bookingDetails: "Private booking contact", instagramHandle: "sampleflorist", website: "sampleflorist.example" };
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: "reporter" } }); mocks.rate.mockResolvedValue({ ok: true }); mocks.findVendor.mockResolvedValue(null); mocks.category.mockResolvedValue({ id: "category" }); mocks.create.mockResolvedValue({ id: "vendor", name: input.name, city: input.city, state: input.state, slug: "sample-florist", status: "UNCLAIMED" }); });
describe("guided unclaimed vendor creation", () => {
  it("stores business location and private reporter-owned booking details atomically", async () => {
    const result = await createUnclaimedVendorAction(input);
    expect(result.ok).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ city: "Fairfield", state: "CA", status: "UNCLAIMED", verified: false, communitySubmissions: { create: { userId: "reporter", bookingChannel: "Instagram DM", bookingDetails: "Private booking contact" } } }) }));
    expect(mocks.create.mock.calls[0][0].select).not.toHaveProperty("communitySubmissions");
    expect(result.vendor).not.toHaveProperty("bookingDetails");
    expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty("userId");
  });
  it("credits a local store branch for a custom cake without requiring a vendor account", async () => {
    const result = await createUnclaimedVendorAction({ ...input, name: "Baskin-Robbins", city: "Fairfield", categories: ["Stores & Local Shops", "Cakes & Desserts"], bookingChannel: "In-store purchase or custom order", bookingDetails: "Custom birthday cake ordered at the local shop" });
    expect(result.ok).toBe(true);
    expect(mocks.category.mock.calls.map(([query]) => query.where.name)).toEqual(["Stores & Local Shops", "Cakes & Desserts"]);
    const saved = mocks.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({ name: "Baskin-Robbins", city: "Fairfield", state: "CA", status: "UNCLAIMED" });
    expect(saved.communitySubmissions.create.bookingChannel).toBe("In-store purchase or custom order");
    expect(saved).not.toHaveProperty("userId");
    expect(result.vendor).not.toHaveProperty("bookingDetails");
  });
  it.each([
    { city: "" }, { state: "" }, { state: "invalid" }, { categories: [] }, { bookingChannel: "" }, { bookingChannel: "made-up-channel" }
  ])("requires city, a vendor type, and an honest booking method: %j", async (change) => {
    expect(await createUnclaimedVendorAction({ ...input, ...change })).toMatchObject({ ok: false });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.category).not.toHaveBeenCalled();
  });
  it.each(["Other", "Website or booking form"])("requires specifics for %s", async (bookingChannel) => {
    expect(await createUnclaimedVendorAction({ ...input, bookingChannel, bookingDetails: " " })).toMatchObject({ ok: false });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(await createUnclaimedVendorAction({ ...input, bookingChannel, bookingDetails: "business.example/booking" })).toMatchObject({ ok: true });
  });
  it("merges legacy entertainment labels before creating category links", async () => {
    expect(await createUnclaimedVendorAction({ ...input, categories: ["Children's Entertainment", "Entertainment"] })).toMatchObject({ ok: true });
    expect(mocks.category).toHaveBeenCalledTimes(1);
    expect(mocks.category).toHaveBeenCalledWith(expect.objectContaining({ where: { name: "Entertainment" } }));
  });
  it("saves both public social profiles without requiring an owner account", async () => {
    expect(await createUnclaimedVendorAction({ ...input, instagramHandle: "https://instagram.com/sampleflorist/?igsh=123", tiktokHandle: "@sampleflorist" })).toMatchObject({ ok: true });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ instagramUrl: "https://www.instagram.com/sampleflorist/", tiktokUrl: "https://www.tiktok.com/@sampleflorist/", status: "UNCLAIMED" });
  });
  it.each([{ instagramHandle: "https://evil.test/vendor" }, { tiktokHandle: "https://tiktok.com/@sample/video/123" }])("rejects invalid social profiles before creating a business: %j", async (change) => {
    expect(await createUnclaimedVendorAction({ ...input, ...change })).toMatchObject({ ok: false });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("honors rate limits before creating a profile", async () => {
    mocks.rate.mockResolvedValue({ ok: false }); expect(await createUnclaimedVendorAction(input)).toMatchObject({ ok: false }); expect(mocks.create).not.toHaveBeenCalled();
  });
});
