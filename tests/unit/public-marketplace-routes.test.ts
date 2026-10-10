import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getVendorProfileBySlug } from "@/lib/data/vendor";
import { GET as getMobileVendor } from "@/app/api/mobile/vendors/[slug]/route";
import { GET as getMobileOffering } from "@/app/api/mobile/offerings/[id]/route";
import { GET as getMobileParty } from "@/app/api/mobile/parties/[slug]/route";
import { publicOfferingWhere, publicVendorWhere, QUARANTINED_OFFERING_IDS, QUARANTINED_VENDOR_IDS } from "@/lib/public-marketplace";

const dbMock = vi.hoisted(() => ({
  vendorProfile: { findFirst: vi.fn() },
  offering: { findFirst: vi.fn() },
  partyEvent: { findFirst: vi.fn() }
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

// A tiny, fail-closed stand-in for the scalar Prisma filters in these direct
// lookups. Unit tests never construct PrismaClient or use a database.
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (value as Record<string, unknown>[]).every((part) => matches(row, part));
    if (key === "OR") return (value as Record<string, unknown>[]).some((part) => matches(row, part));
    if (typeof value === "object" && value !== null && "notIn" in value) {
      return !(value.notIn as unknown[]).includes(row[key]);
    }
    if (value === null || typeof value !== "object") return row[key] === value;
    throw new Error(`Unsupported lookup filter: ${key}`);
  });
}

const vendors = [
  ...QUARANTINED_VENDOR_IDS.map((id, index) => ({ id, slug: `verified-fixture-${index}`, username: `fixture-alias-${index}` })),
  { id: "legitimate-vendor", name: "Codex Test Vendor", slug: "codex-test-vendor-legitimate", username: "codexlegitimate" }
];
const offerings = [
  ...QUARANTINED_OFFERING_IDS.map((id, index) => ({ id, vendorId: QUARANTINED_VENDOR_IDS[index], active: true })),
  { id: "another-fixture-offering", vendorId: QUARANTINED_VENDOR_IDS[0], active: true },
  { id: "legitimate-offering", vendorId: "legitimate-vendor", title: "Codex Test Offering", active: true, vendor: {
    id: "legitimate-vendor", user: { id: "real-user", username: "codexlegitimate", email: "private@example.test", role: "VENDOR" }
  } },
  { id: "inactive-offering", vendorId: "legitimate-vendor", active: false }
];

describe("public storefront and mobile fixture exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.vendorProfile.findFirst.mockImplementation(({ where }) => Promise.resolve(vendors.find((row) => matches(row, where)) ?? null));
    dbMock.offering.findFirst.mockImplementation(({ where }) => Promise.resolve(offerings.find((row) => matches(row, where)) ?? null));
    dbMock.partyEvent.findFirst.mockResolvedValue(null);
  });

  it.each(vendors.slice(0, 3))("hides fixture $id by ID, slug and username on the website and mobile", async (vendor) => {
    for (const alias of [vendor.id, vendor.slug, vendor.username]) {
      expect(await getVendorProfileBySlug(alias)).toBeNull();
      const response = await getMobileVendor(new Request("https://shopfia.test/"), { params: Promise.resolve({ slug: alias }) });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Vendor not found." });
    }
  });

  it("keeps legitimate lookalike businesses discoverable and filters their selected offering relations", async () => {
    const vendor = vendors[3];
    expect(await getVendorProfileBySlug(` ${vendor.slug} `)).toEqual(vendor);
    const websiteQuery = dbMock.vendorProfile.findFirst.mock.calls.at(-1)?.[0];
    expect(websiteQuery.where).toEqual(publicVendorWhere({ OR: [
      { slug: vendor.slug }, { username: vendor.slug }, { id: vendor.slug }
    ] }));
    expect(websiteQuery.select.offerings.where).toEqual(publicOfferingWhere({ active: true }));
    const response = await getMobileVendor(new Request("https://shopfia.test/"), { params: Promise.resolve({ slug: vendor.username }) });
    expect(response.status).toBe(200);
    expect((await response.json()).vendor).toEqual(vendor);
    expect(dbMock.vendorProfile.findFirst.mock.calls.at(-1)?.[0].select.offerings.where).toEqual(publicOfferingWhere({ active: true }));
  });

  it.each(offerings.filter((offering) => offering.id !== "legitimate-offering"))("returns 404 for hidden offering $id", async (offering) => {
    const response = await getMobileOffering(new Request("https://shopfia.test/"), { params: Promise.resolve({ id: offering.id }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Offering not found." });
  });

  it("serves an active legitimate offering even when its title resembles a fixture", async () => {
    const response = await getMobileOffering(new Request("https://shopfia.test/"), { params: Promise.resolve({ id: "legitimate-offering" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.offering.title).toBe("Codex Test Offering");
    expect(body.offering.vendor.user).toEqual({ id: "real-user", username: "codexlegitimate" });
    expect(JSON.stringify(body)).not.toContain("private@example.test");
    const select = dbMock.offering.findFirst.mock.calls.at(-1)?.[0].include.vendor.select.user.select;
    expect(select).toEqual({ id: true, username: true });
  });

  it("applies the offering query guard to the website detail page too", () => {
    const source = readFileSync("src/app/offering/[id]/page.tsx", "utf8");
    expect(source).toContain("where: publicOfferingWhere({ id, active: true })");
  });

  it("excludes fixture vendor tags and contribution notes from public mobile parties", async () => {
    await getMobileParty(new Request("https://shopfia.test/"), { params: Promise.resolve({ slug: "real-party" }) });
    const relations = dbMock.partyEvent.findFirst.mock.calls[0][0].include;
    expect(relations.taggedVendors.where).toEqual(publicVendorWhere());
    expect(relations.photos.include.taggedVendors.where).toEqual(publicVendorWhere());
    expect(relations.photos.include.vendorRatings.where).toEqual({ vendor: publicVendorWhere() });
  });

  it("never fabricates seed-vendor event credits in the public storefront", () => {
    const source = readFileSync("src/app/vendor/profile/[slug]/page.tsx", "utf8");
    expect(source).not.toContain("demoTaggedEvents");
    expect(source).not.toContain("@jordan.parties");
  });
});
