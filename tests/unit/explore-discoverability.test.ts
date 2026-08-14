import { beforeEach, describe, expect, it, vi } from "vitest";
import { getExploreData } from "@/lib/data/explore";
import { getExploreCategoryCounts } from "@/lib/data/category-counts";

const dbMock = vi.hoisted(() => ({
  category: { findMany: vi.fn() },
  offering: { count: vi.fn(), findMany: vi.fn() },
  partyEvent: { findMany: vi.fn() },
  vendorProfile: { count: vi.fn(), findMany: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("Explore discoverability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.category.findMany.mockResolvedValue([]);
    dbMock.partyEvent.findMany.mockResolvedValue([]);
    dbMock.vendorProfile.findMany.mockResolvedValue([]);
    dbMock.offering.findMany.mockResolvedValue([]);
  });

  it("searches exact vendor business names and vendor usernames", async () => {
    const vendor = makeVendor({
      name: "Venus & Aura",
      slug: "venus-aura",
      username: "venusaura"
    });
    dbMock.vendorProfile.findMany.mockResolvedValue([vendor]);

    const result = await getExploreData({ q: "Venus & Aura" });

    expect(result.vendors).toEqual([vendor]);
    const vendorWhere = dbMock.vendorProfile.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(vendorWhere)).toContain("username");
    expect(JSON.stringify(vendorWhere)).toContain("slug");
    expect(JSON.stringify(vendorWhere)).toContain("name");
    expect(JSON.stringify(vendorWhere)).toContain("serviceAreaNotes");
  });

  it("searches offerings by title, category, vendor name, and vendor location", async () => {
    const offering = makeOffering({
      categoryName: "Florals",
      title: "Codex Meadow Centerpieces",
      vendorName: "Codex Florals"
    });
    dbMock.offering.findMany.mockResolvedValue([offering]);

    const result = await getExploreData({ q: "Codex Meadow Centerpieces" });

    expect(result.offerings).toEqual([offering]);
    const offeringWhere = dbMock.offering.findMany.mock.calls[0][0].where;
    const serialized = JSON.stringify(offeringWhere);
    expect(serialized).toContain("title");
    expect(serialized).toContain("category");
    expect(serialized).toContain("vendor");
    expect(serialized).toContain("city");
    expect(serialized).toContain("zipCode");
  });

  it("uses matching category filters for vendor and offering Explore results", async () => {
    await getExploreData({ categoryId: "cm00000000000000000000000" });

    const vendorWhere = JSON.stringify(dbMock.vendorProfile.findMany.mock.calls[0][0].where);
    const offeringWhere = JSON.stringify(dbMock.offering.findMany.mock.calls[0][0].where);

    expect(vendorWhere).toContain("categoryId");
    expect(vendorWhere).toContain("offerings");
    expect(offeringWhere).toContain("active");
    expect(offeringWhere).toContain("vendor");
    expect(offeringWhere).toContain("categories");
  });
});

describe("Category counts", () => {
  it("counts only Explore-visible active offerings and matching vendors", async () => {
    const categoryId = "cm00000000000000000000000";
    const db = {
      vendorProfile: { count: vi.fn().mockResolvedValue(2) },
      offering: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1) }
    };

    await expect(getExploreCategoryCounts(db, categoryId)).resolves.toEqual({
      eventOfferings: 1,
      offerings: 3,
      vendors: 2
    });

    expect(JSON.stringify(db.vendorProfile.count.mock.calls[0][0])).toContain("offerings");
    expect(JSON.stringify(db.vendorProfile.count.mock.calls[0][0])).toContain("active");
    expect(JSON.stringify(db.offering.count.mock.calls[0][0])).toContain("\"active\":true");
    expect(JSON.stringify(db.offering.count.mock.calls[0][0])).toContain("vendor");
  });
});

function makeVendor(overrides: Record<string, unknown> = {}) {
  return {
    averageRating: 0,
    categories: [{ category: { name: "Florals" } }],
    city: "Fairfield",
    coverPhoto: null,
    id: "vendor_1",
    locationLat: null,
    locationLng: null,
    name: "Vendor",
    offerings: [],
    photos: [],
    rankingScore: null,
    reviewCount: 0,
    sellerRatingAggregate: null,
    serviceRadiusMiles: 25,
    slug: "vendor",
    startingPriceCents: null,
    state: "CA",
    status: "CLAIMED",
    user: { createdAt: new Date("2026-01-01"), email: "vendor@example.com", username: "vendor" },
    username: "vendor",
    verified: false,
    weekendAvailable: true,
    zipCode: "94533",
    ...overrides
  };
}

function makeOffering({
  categoryName = "Florals",
  title = "Offering",
  vendorName = "Vendor"
}: {
  categoryName?: string;
  title?: string;
  vendorName?: string;
}) {
  return {
    active: true,
    basePriceCents: 15000,
    categories: [{ category: { name: categoryName } }],
    category: { name: categoryName },
    categoryId: "cm00000000000000000000000",
    createdAt: new Date("2026-01-02"),
    description: "A discoverable offering for local celebrations.",
    durationMinutes: null,
    eventCategories: [],
    id: "offering_1",
    inventoryCount: null,
    messageForPricing: false,
    photoCrops: null,
    photos: [],
    slug: "offering",
    tags: [],
    title,
    turnaroundDays: null,
    type: "SERVICE",
    updatedAt: new Date("2026-01-03"),
    vendor: makeVendor({ name: vendorName }),
    vendorId: "vendor_1"
  };
}
