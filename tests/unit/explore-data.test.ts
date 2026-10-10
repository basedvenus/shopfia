import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExploreSearch } from "@/components/explore/explore-search";
import { getExploreData } from "@/lib/data/explore";
import { exploreSearchSchema } from "@/lib/validators/search";

const dbMock = vi.hoisted(() => ({
  category: { findMany: vi.fn() },
  offering: { findMany: vi.fn() },
  partyEvent: { findMany: vi.fn() },
  vendorProfile: { findMany: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

type Row = Record<string, unknown>;
let vendors: Row[];
let offerings: Row[];
let parties: Row[];
let categories: Row[];

// Execute the generated Prisma predicate against fixtures, including nested
// relations. A mock that returns every row regardless of `where` would miss
// location, price, category, and AND/OR regressions.
function matches(value: unknown, condition: unknown): boolean {
  if (condition === undefined) return true;
  if (condition === null) return value == null;
  if (typeof condition !== "object") return value === condition;
  const filter = condition as Row;
  const text = (input: unknown) => filter.mode === "insensitive" ? String(input).toLowerCase() : String(input);
  return Object.entries(filter).every(([key, expected]) => {
    if (expected === undefined || key === "mode") return true;
    if (key === "AND") return (Array.isArray(expected) ? expected : [expected]).every((item) => matches(value, item));
    if (key === "OR") return (expected as unknown[]).some((item) => matches(value, item));
    if (key === "some") return Array.isArray(value) && value.some((item) => matches(item, expected));
    if (key === "in") return (expected as unknown[]).includes(value);
    if (key === "notIn") return !(expected as unknown[]).includes(value);
    if (key === "has") return Array.isArray(value) && value.includes(expected);
    if (key === "isEmpty") return Array.isArray(value) && (value.length === 0) === expected;
    if (key === "not") return !matches(value, expected);
    if (key === "equals") return value != null && text(value) === text(expected);
    if (key === "contains") return value != null && text(value).includes(text(expected));
    if (key === "gte") return value != null && Number(value) >= Number(expected);
    if (key === "lte") return value != null && Number(value) <= Number(expected);
    return matches((value as Row | null)?.[key], expected);
  });
}

function query(rows: Row[], args: { where?: unknown; skip?: number; take?: number }) {
  const filtered = rows.filter((row) => matches(row, args.where));
  const start = args.skip ?? 0;
  return filtered.slice(start, args.take == null ? undefined : start + args.take);
}

function vendor(overrides: Row = {}): Row {
  return {
    id: "vendor-1", name: "Local Florist", username: "florist", slug: "local-florist", bio: "Floral styling",
    city: "Fairfield", state: "CA", zipCode: "94533", formattedAddress: "Fairfield, CA 94533",
    googlePlaceId: null, locationLat: 0, locationLng: 0.05, serviceRadiusMiles: 25,
    verified: false, averageRating: 4, reviewCount: 2, weekendAvailable: true,
    status: "CLAIMED", startingPriceCents: 10000, photos: [], coverPhoto: null,
    user: { username: "florist-owner" }, rankingScore: null, offerings: [], categories: [],
    ...overrides
  };
}

function offering(overrides: Row = {}): Row {
  return {
    id: "offering-1", title: "Flower centerpieces", description: "Local arrangements", active: true,
    basePriceCents: 10000, messageForPricing: false, tags: [], categories: [], eventCategories: [],
    categoryId: "vendor-florals", category: { name: "Florals" }, vendor: vendor(),
    vendorId: (overrides.vendor as Row | undefined)?.id ?? "vendor-1",
    ...overrides
  };
}

function party(overrides: Row = {}): Row {
  return {
    id: "party-1", title: "Spring gathering", theme: "Garden Party", description: "A local celebration",
    city: "Fairfield", state: "CA", zipCode: "94533", formattedAddress: "Fairfield, CA 94533",
    location: "Fairfield", locationLat: 0, locationLng: 0.05, googlePlaceId: null,
    coverImageUrl: "https://example.com/photo.jpg", imageUrls: [], photos: [], tags: [], taggedVendors: [],
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vendors = [];
  offerings = [];
  parties = [];
  categories = [];
  dbMock.vendorProfile.findMany.mockImplementation(async (args) => query(vendors, args));
  dbMock.offering.findMany.mockImplementation(async (args) => query(offerings, args));
  dbMock.partyEvent.findMany.mockImplementation(async (args) => query(parties, args));
  dbMock.category.findMany.mockImplementation(async (args) => query(categories, args));
});

describe("Explore location filters", () => {
  it("applies exact ZIP filters to vendors, offerings, and parties", async () => {
    vendors = [vendor(), vendor({ id: "other", zipCode: "94534" })];
    offerings = [offering(), offering({ id: "other", vendor: vendor({ zipCode: "94534" }) })];
    parties = [party(), party({ id: "other", zipCode: "94534" })];
    const result = await getExploreData({ zip: "94533" });
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["offering-1"]);
    expect(result.parties.map((row) => row.id)).toEqual(["party-1"]);
  });

  it("honors a place ID even when coordinates and a label are absent", async () => {
    vendors = [vendor({ googlePlaceId: "selected-place" }), vendor({ id: "other" })];
    offerings = [offering({ vendor: vendors[0] }), offering({ id: "other" })];
    parties = [party({ googlePlaceId: "selected-place" }), party({ id: "other" })];
    const result = await getExploreData({ placeId: "selected-place" });
    expect(result.vendors).toHaveLength(1);
    expect(result.offerings).toHaveLength(1);
    expect(result.parties).toHaveLength(1);
  });

  it("uses the same case-insensitive city/state matching across result types", async () => {
    vendors = [vendor(), vendor({ id: "other", city: "Reno", state: "NV", formattedAddress: "Reno, NV" })];
    offerings = [offering(), offering({ id: "other", vendor: vendors[1] })];
    parties = [party(), party({ id: "other", city: "Reno", state: "NV", formattedAddress: "Reno, NV", location: "Reno" })];
    const result = await getExploreData({ city: "ca" });
    expect(result.vendors).toHaveLength(1);
    expect(result.offerings).toHaveLength(1);
    expect(result.parties).toHaveLength(1);
  });

  it("honors a location label without a city field", async () => {
    vendors = [vendor(), vendor({ id: "other", city: "Reno", formattedAddress: "Reno" })];
    const result = await getExploreData({ locationLabel: "Fairfield" });
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
  });

  it("caps point searches at the explicit distance regardless of vendor travel radius", async () => {
    vendors = [vendor({ serviceRadiusMiles: 1 }), vendor({ id: "far", locationLng: 0.3, serviceRadiusMiles: 200 })];
    offerings = vendors.map((row) => offering({ id: row.id, vendor: row }));
    parties = [party(), party({ id: "far", locationLng: 0.3 })];
    const result = await getExploreData({ lat: "0", lng: "0", radius: "10" });
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(result.parties.map((row) => row.id)).toEqual(["party-1"]);
    expect(JSON.stringify(dbMock.vendorProfile.findMany.mock.calls[0][0].where)).not.toContain("serviceRadiusMiles");
  });

  it("keeps radius-only filtering as the advertised vendor travel capability", async () => {
    vendors = [vendor({ serviceRadiusMiles: 10 }), vendor({ id: "travels", serviceRadiusMiles: 100 })];
    offerings = vendors.map((row) => offering({ id: row.id, vendor: row }));
    const result = await getExploreData({ radius: "50" });
    expect(result.vendors.map((row) => row.id)).toEqual(["travels"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["travels"]);
  });

  it("uses a 50-mile default for parties and retains vendors whose service area reaches farther", async () => {
    vendors = [vendor({ locationLng: 1, serviceRadiusMiles: 100 })];
    offerings = [offering({ vendor: vendors[0] })];
    parties = [party(), party({ id: "far", locationLng: 1 })];
    const result = await getExploreData({ lat: "0", lng: "0" });
    expect(result.vendors).toHaveLength(1);
    expect(result.offerings).toHaveLength(1);
    expect(result.parties.map((row) => row.id)).toEqual(["party-1"]);
  });

  it("does not retain records with unknown coordinates and no positive location evidence", async () => {
    vendors = [vendor({ city: "", locationLat: null, locationLng: null })];
    offerings = [offering({ vendor: vendors[0] })];
    parties = [party({ city: null, locationLat: null, locationLng: null })];
    const result = await getExploreData({ lat: "0", lng: "0" });
    expect(result.vendors).toEqual([]);
    expect(result.offerings).toEqual([]);
    expect(result.parties).toEqual([]);
  });

  it("uses structured autocomplete city/state fields for legacy coordinate-free records", async () => {
    vendors = [
      vendor({ locationLat: null, locationLng: null }),
      vendor({ id: "wrong-state", state: "OH", locationLat: null, locationLng: null }),
      vendor({ id: "empty-city", city: "", locationLat: null, locationLng: null })
    ];
    const result = await getExploreData({
      city: "A venue, Fairfield, CA, USA", locationLabel: "A venue, Fairfield, CA, USA",
      locationCity: "Fairfield", locationState: "CA", lat: "0", lng: "0"
    });
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
  });

  it("does not match a partial city name inside a different city", async () => {
    vendors = [vendor({ city: "York", state: "NY", locationLat: null, locationLng: null })];
    expect((await getExploreData({ lat: "0", lng: "0", locationLabel: "New York, NY, USA" })).vendors).toEqual([]);
  });

  it("handles searches across the antimeridian and near the pole", async () => {
    vendors = [vendor({ locationLat: 0, locationLng: -179.95 })];
    expect((await getExploreData({ lat: "0", lng: "179.95", radius: "10" })).vendors).toHaveLength(1);
    vendors = [vendor({ locationLat: 89.99, locationLng: -150 })];
    expect((await getExploreData({ lat: "89.99", lng: "30", radius: "10" })).vendors).toHaveLength(1);
  });

  it("reads beyond a full batch of bounding-box candidates outside the actual circle", async () => {
    vendors = Array.from({ length: 100 }, (_, index) => vendor({ id: `corner-${index}`, locationLat: 0.13, locationLng: 0.13 }));
    vendors.push(vendor({ id: "nearby-after-batch" }));
    const result = await getExploreData({ lat: "0", lng: "0", radius: "10" });
    expect(result.vendors.map((row) => row.id)).toEqual(["nearby-after-batch"]);
    expect(dbMock.vendorProfile.findMany).toHaveBeenCalledTimes(2);
    expect(dbMock.vendorProfile.findMany.mock.calls[1][0]).toMatchObject({ skip: 100, take: 100 });
  });

  it("sorts offerings, vendors, and parties by distance before applying display limits", async () => {
    vendors = [vendor({ id: "farther", locationLng: 0.1 }), vendor({ id: "closer", locationLng: 0.01 })];
    offerings = vendors.map((row) => offering({ id: row.id, vendor: row }));
    parties = [party({ id: "farther", locationLng: 0.1 }), party({ id: "closer", locationLng: 0.01 })];
    const result = await getExploreData({ lat: "0", lng: "0", radius: "10", sort: "distance" });
    expect(result.vendors.map((row) => row.id)).toEqual(["closer", "farther"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["closer", "farther"]);
    expect(result.parties.map((row) => row.id)).toEqual(["closer", "farther"]);
  });

  it("bounds a dense location sort to 1,000 coarse-filtered candidates", async () => {
    vendors = Array.from({ length: 1100 }, (_, index) => vendor({ id: `vendor-${index}` }));
    const result = await getExploreData({ lat: "0", lng: "0", sort: "distance" });
    expect(result.vendors).toHaveLength(30);
    expect(result.truncated).toEqual({ vendors: true, offerings: false, parties: false });
    expect(dbMock.vendorProfile.findMany).toHaveBeenCalledTimes(10);
    expect(dbMock.vendorProfile.findMany.mock.calls[9][0]).toMatchObject({ skip: 900, take: 100 });
  });
  it("reports a location cap instead of implying no match exists beyond 1,000 candidates", async () => {
    vendors = Array.from({ length: 1000 }, (_, index) => vendor({ id: `corner-${index}`, locationLat: 0.13, locationLng: 0.13 }));
    vendors.push(vendor({ id: "unscanned-nearby" }));
    offerings = vendors.map((row) => offering({ id: row.id, vendor: row }));
    parties = vendors.map((row) => party({ id: row.id, locationLat: row.locationLat, locationLng: row.locationLng }));
    const result = await getExploreData({ lat: "0", lng: "0", radius: "10" });
    expect(result.vendors).toEqual([]);
    expect(result.offerings).toEqual([]);
    expect(result.parties).toEqual([]);
    expect(result.truncated).toEqual({ vendors: true, offerings: true, parties: true });
  });

});

describe("Explore categories, search, and budgets", () => {
  it("accepts persisted non-CUID service category IDs and preserves vendor-category discovery", async () => {
    const categoryId = "vendor-florals";
    vendors = [vendor({ categories: [{ categoryId, category: { name: "Florals" } }] })];
    offerings = [offering({ categoryId: "vendor-rentals", vendor: vendors[0] })];
    parties = [party({ taggedVendors: vendors })];
    const result = await getExploreData({ categoryId });
    expect(result.vendors).toHaveLength(1);
    expect(result.offerings).toHaveLength(1);
    expect(result.parties).toHaveLength(1);
  });

  it("matches any selected service category without admitting inactive offerings", async () => {
    offerings = [
      offering({ categoryId: "vendor-florals" }),
      offering({ id: "second", categoryId: "vendor-balloons" }),
      offering({ id: "inactive", active: false }),
      offering({ id: "unrelated", categoryId: "vendor-rentals" })
    ];
    const result = await getExploreData({ categoryId: ["vendor-florals", "vendor-balloons"] });
    expect(result.offerings.map((row) => row.id)).toEqual(["offering-1", "second"]);
  });

  it("combines text search and selected themes for party inspiration", async () => {
    parties = [
      party({ title: "Rose birthday", theme: "Birthday Party" }),
      party({ id: "query-only", title: "Rose picnic", theme: "Picnic Party" }),
      party({ id: "theme-only", title: "Ocean birthday", theme: "Birthday Party" })
    ];
    const result = await getExploreData({ q: "Rose", theme: "Birthday Party" });
    expect(result.parties.map((row) => row.id)).toEqual(["party-1"]);
  });

  it("resolves event type IDs to party themes and keeps offering relation filters", async () => {
    categories = [{ id: "birthday-id", name: "Birthday Party", audience: "BUYER" }];
    parties = [party({ title: "Our birthday", theme: "Birthday Party" }), party({ id: "other" })];
    offerings = [offering({ eventCategories: [{ categoryId: "birthday-id" }] }), offering({ id: "other" })];
    vendors = [vendor({ offerings: [offerings[0]] }), vendor({ id: "other" })];
    const result = await getExploreData({ eventCategoryId: "birthday-id" });
    expect(result.parties.map((row) => row.id)).toEqual(["party-1"]);
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["offering-1"]);
    expect((await getExploreData({ eventCategoryId: "missing-id" })).parties).toEqual([]);
  });

  it("lists configured event categories beyond the historical display order", async () => {
    categories = [
      { id: "retirement", name: "Retirement Party", audience: "BUYER" },
      { id: "wedding", name: "Wedding", audience: "BUYER" }
    ];
    expect((await getExploreData({})).eventCategories.map((row) => row.name)).toEqual(["Wedding", "Retirement Party"]);
  });

  it("requires a known advertised price when a budget is supplied, including zero", async () => {
    vendors = [vendor({ startingPriceCents: 0 }), vendor({ id: "unknown", startingPriceCents: null }), vendor({ id: "paid" })];
    offerings = [
      offering({ basePriceCents: 0 }), offering({ id: "unknown", basePriceCents: null }),
      offering({ id: "custom", basePriceCents: 0, messageForPricing: true }), offering({ id: "paid" })
    ];
    const free = await getExploreData({ maxPrice: "0" });
    expect(free.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(free.offerings.map((row) => row.id)).toEqual(["offering-1"]);
    const paid = await getExploreData({ minPrice: "1" });
    expect(paid.vendors.map((row) => row.id)).toEqual(["paid"]);
    expect(paid.offerings.map((row) => row.id)).toEqual(["paid"]);
    expect((await getExploreData({})).offerings).toHaveLength(4);
  });

  it("applies price filters before database display limits with dollar-to-cent conversion", async () => {
    vendors = Array.from({ length: 40 }, (_, index) => vendor({ id: `expensive-${index}`, startingPriceCents: 100000 }));
    vendors.push(vendor({ id: "affordable", startingPriceCents: 12525 }));
    offerings = vendors.map((row) => offering({ id: row.id, basePriceCents: row.startingPriceCents }));
    const result = await getExploreData({ minPrice: "125.25", maxPrice: "125.25" });
    expect(result.vendors.map((row) => row.id)).toEqual(["affordable"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["affordable"]);
    expect(dbMock.vendorProfile.findMany).toHaveBeenCalledTimes(1);
  });

  it("combines verification, minimum rating, and explicit unavailable-weekend filters", async () => {
    const matching = vendor({ verified: true, averageRating: 4.8, weekendAvailable: false });
    vendors = [matching, vendor(), vendor({ id: "weekend", verified: true, averageRating: 5 })];
    offerings = vendors.map((row) => offering({ id: row.id, vendor: row }));
    const result = await getExploreData({ verified: "true", minRating: "4.5", availableWeekend: "false" });
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["vendor-1"]);
  });

  it("keeps ordinary database reads capped and does not hide vendors by their names", async () => {
    vendors = [vendor({ name: "Codex Test Vendor" })];
    const result = await getExploreData({});
    expect(result.vendors).toHaveLength(1);
    expect(dbMock.vendorProfile.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 30 });
    expect(dbMock.offering.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 36 });
    expect(dbMock.partyEvent.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 48 });
    expect(result.truncated).toEqual({ vendors: false, offerings: false, parties: false });
  });

  it("quarantines verified fixture IDs and their offerings without matching names", async () => {
    const fixture = vendor({ id: "cmv00417g000392dgmtxxlwjz", name: "Any fixture name" });
    const legitimate = vendor({ name: "Codex Test Vendor" });
    vendors = [fixture, legitimate];
    offerings = [
      offering({ id: "fixture-child", vendor: fixture }),
      offering({ id: "cmv0042cg000592dgxq7ftq67" }),
      offering({ title: "Codex test centerpieces", vendor: legitimate })
    ];
    const result = await getExploreData({});
    expect(result.vendors.map((row) => row.id)).toEqual(["vendor-1"]);
    expect(result.offerings.map((row) => row.id)).toEqual(["offering-1"]);
  });

  it("does not use quarantined tagged vendors to match party category searches", async () => {
    parties = [party({ taggedVendors: [vendor({
      id: "cmv00417g000392dgmtxxlwjz", categories: [{ categoryId: "vendor-florals" }]
    })] })];
    expect((await getExploreData({ categoryId: "vendor-florals" })).parties).toEqual([]);
  });

  it("does not use quarantined offerings to match vendor or party categories", async () => {
    const knownFixtureOffering = offering({ id: "cmv0042cg000592dgxq7ftq67" });
    vendors = [vendor({ offerings: [knownFixtureOffering] })];
    parties = [party({ taggedVendors: vendors })];
    const result = await getExploreData({ categoryId: "vendor-florals" });
    expect(result.vendors).toEqual([]);
    expect(result.parties).toEqual([]);
  });

  it("matches theme category and vendor context consistently across vendors and offerings", async () => {
    const themedOffering = offering({ category: { name: "Garden Party styling" } });
    vendors = [vendor({ offerings: [themedOffering] })];
    offerings = [themedOffering];
    let result = await getExploreData({ theme: "Garden Party" });
    expect(result.vendors).toHaveLength(1);
    expect(result.offerings).toHaveLength(1);
    vendors = [vendor({ bio: "Luxury event styling" })];
    offerings = [offering({ vendor: vendors[0] })];
    result = await getExploreData({ theme: "Luxury" });
    expect(result.vendors).toHaveLength(1);
    expect(result.offerings).toHaveLength(1);
  });

  it("applies top-rated sorting to offering queries", async () => {
    await getExploreData({ sort: "top-rated" });
    expect(dbMock.offering.findMany.mock.calls[0][0].orderBy[0]).toEqual({ vendor: { averageRating: "desc" } });
  });

  it("retains input bounds for opaque category IDs and coordinates", () => {
    expect(exploreSearchSchema.safeParse({ categoryId: "x".repeat(121) }).success).toBe(false);
    expect(exploreSearchSchema.safeParse({ lat: "91", lng: "0" }).success).toBe(false);
    expect(exploreSearchSchema.safeParse({ lat: "0", lng: "181" }).success).toBe(false);
    expect(exploreSearchSchema.safeParse({ categoryId: "vendor-catering-beverages" }).success).toBe(true);
  });
});


describe("Explore filter round trips", () => {
  it("keeps selected location details and themes in form submissions and discovery links", () => {
    const html = renderToStaticMarkup(createElement(ExploreSearch, {
      categories: [], eventCategories: [], filters: {
        city: "A venue, Fairfield, CA", locationLabel: "A venue, Fairfield, CA",
        locationCity: "Fairfield", locationState: "CA", zip: "94533", placeId: "selected-place",
        lat: 0, lng: 0, theme: ["Luxury"], minPrice: 0, maxPrice: 150,
        radius: 10, minRating: 4, availableWeekend: "false", verified: "true", sort: "distance",
        eventCategoryId: "birthday-id", categoryId: ["vendor-florals"]
      }
    }));
    for (const [name, value] of [["locationCity", "Fairfield"], ["locationState", "CA"], ["zip", "94533"], ["theme", "Luxury"]]) {
      expect(html).toContain(`name="${name}" value="${value}"`);
    }
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1].replace(/&amp;/g, "&"), "https://example.com"));
    const themeLink = links.find((url) => url.searchParams.getAll("theme").includes("Birthday Party"));
    expect(themeLink).toBeDefined();
    for (const [key, value] of Object.entries({
      locationCity: "Fairfield", locationState: "CA", zip: "94533", placeId: "selected-place",
      lat: "0", lng: "0", minPrice: "0", maxPrice: "150", radius: "10", minRating: "4",
      availableWeekend: "false", verified: "true", sort: "distance", eventCategoryId: "birthday-id"
    })) expect(themeLink!.searchParams.get(key)).toBe(value);
    const clearLink = links.at(-1)!;
    expect(clearLink.searchParams.get("locationCity")).toBe("Fairfield");
    expect(clearLink.searchParams.get("locationState")).toBe("CA");
    expect(clearLink.searchParams.get("zip")).toBe("94533");
    expect(clearLink.searchParams.get("radius")).toBeNull();
    expect(clearLink.searchParams.getAll("theme")).toEqual(["Luxury"]);
  });
});
