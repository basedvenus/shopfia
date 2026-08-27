import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  favorite: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
  },
  favoriteCollection: {
    findMany: vi.fn(),
    upsert: vi.fn()
  },
  offering: { findUnique: vi.fn() },
  partyEvent: { findUnique: vi.fn() },
  vendorProfile: { findUnique: vi.fn() }
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: vi.fn(() => ({ ok: true })) }));
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: vi.fn(() => null) }));
vi.mock("@/lib/party-photo-url", () => ({ partyPhotoUrl: vi.fn(() => "/party-photo") }));
vi.mock("@/lib/utils", () => ({ formatCurrency: vi.fn((cents: number) => `$${(cents / 100).toFixed(2)}`) }));

describe("mobile favorites API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "buyer_1" } });
    dbMock.favorite.findMany.mockResolvedValue([]);
    dbMock.favoriteCollection.findMany.mockResolvedValue([]);
  });

  it("saves a website vendor favorite through the shared database", async () => {
    const { POST } = await import("@/app/api/mobile/favorites/route");
    dbMock.vendorProfile.findUnique.mockResolvedValue({ id: "vendor_1" });
    dbMock.favorite.findUnique.mockResolvedValue(null);
    dbMock.favorite.create.mockResolvedValue({ id: "favorite_1" });

    const response = await POST(new Request("http://shopfia.test/api/mobile/favorites", {
      body: JSON.stringify({ action: "toggle", targetId: "vendor_1", targetType: "vendor" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ saved: true, targetId: "vendor_1" });
    expect(dbMock.favorite.create).toHaveBeenCalledWith({
      data: { buyerId: "buyer_1", vendorId: "vendor_1" }
    });
  });

  it("removes an existing party favorite", async () => {
    const { POST } = await import("@/app/api/mobile/favorites/route");
    dbMock.partyEvent.findUnique.mockResolvedValue({ id: "party_1" });
    dbMock.favorite.findUnique.mockResolvedValue({ id: "favorite_1" });

    const response = await POST(new Request("http://shopfia.test/api/mobile/favorites", {
      body: JSON.stringify({ action: "toggle", targetId: "party_1", targetType: "party" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ saved: false, targetId: "party_1" });
    expect(dbMock.favorite.delete).toHaveBeenCalledWith({ where: { id: "favorite_1" } });
  });

  it("returns the same saved collection counts used by the website", async () => {
    const { GET } = await import("@/app/api/mobile/favorites/route");
    dbMock.favoriteCollection.findMany.mockResolvedValue([
      { _count: { favorites: 2 }, id: "collection_1", name: "Wedding Inspiration" }
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.collections).toEqual([
      { count: 2, id: "collection_1", name: "Wedding Inspiration" }
    ]);
    expect(body.savedIds).toEqual({ offerings: [], parties: [], vendors: [] });
  });
});
