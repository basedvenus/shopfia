import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  partyEvent: { findFirst: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/party-photo-url", () => ({
  partyPhotoUrl: vi.fn((id: string) => `/api/party-photos/${id}?w=1400`)
}));

describe("mobile party detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the website party gallery, hosts, and deduplicated vendor credits", async () => {
    const florist = {
      categories: [{ category: { id: "category_1", name: "Florist" } }],
      city: "Fairfield",
      coverPhoto: "/florist-cover.jpg",
      id: "vendor_1",
      logoUrl: "/florist-logo.jpg",
      name: "Solano Flora",
      slug: "solano-flora",
      state: "CA"
    };
    dbMock.partyEvent.findFirst.mockResolvedValue({
      city: "Fairfield",
      collaborators: [],
      coverImageUrl: null,
      description: "A soft citrus tablescape.",
      eventDate: new Date("2026-05-16T00:00:00.000Z"),
      id: "party_1",
      imageUrls: [],
      location: "Fairfield, CA",
      partyfulUrl: "https://partyful.com/e/example",
      photos: [
        {
          crop: { x: 40, y: 60, zoom: 1.2 },
          id: "photo_1",
          taggedVendors: [florist],
          updatedAt: new Date("2026-05-17T00:00:00.000Z"),
          vendorRatings: [{ contributionNote: "Florals and tablescape", vendorId: "vendor_1" }]
        },
        {
          crop: null,
          id: "photo_2",
          taggedVendors: [florist],
          updatedAt: new Date("2026-05-18T00:00:00.000Z"),
          vendorRatings: []
        }
      ],
      slug: "citrus-garden-brunch",
      state: "CA",
      taggedVendors: [florist],
      tags: ["brunch", "lemons"],
      theme: "Lemon garden party",
      title: "Citrus Garden Brunch",
      user: { id: "host_1", image: "https://example.com/host.jpg", name: "Venus", username: "venus" }
    });

    const { GET } = await import("@/app/api/mobile/parties/[slug]/route");
    const response = await GET(new Request("http://shopfia.test/api/mobile/parties/citrus-garden-brunch"), {
      params: Promise.resolve({ slug: "citrus-garden-brunch" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dbMock.partyEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ slug: "citrus-garden-brunch" }, { id: "citrus-garden-brunch" }] }
    }));
    expect(body.party.photos).toEqual([
      expect.objectContaining({
        crop: { x: 40, y: 60, zoom: 1.2 },
        taggedVendorIds: ["vendor_1"],
        url: "/api/party-photos/photo_1?w=1400",
        vendorContributions: { vendor_1: "Florals and tablescape" }
      }),
      expect.objectContaining({
        crop: { x: 50, y: 50, zoom: 1 },
        taggedVendorIds: ["vendor_1"]
      })
    ]);
    expect(body.party.collaborators).toEqual([
      expect.objectContaining({ role: "MAIN_HOST", user: expect.objectContaining({ id: "host_1" }) })
    ]);
    expect(body.party.vendors).toEqual([
      expect.objectContaining({ categories: ["Florist"], id: "vendor_1", taggedPhotoCount: 2 })
    ]);
  });

  it("returns 404 when the shared party record does not exist", async () => {
    dbMock.partyEvent.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/mobile/parties/[slug]/route");

    const response = await GET(new Request("http://shopfia.test/api/mobile/parties/missing"), {
      params: Promise.resolve({ slug: "missing" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Party not found." });
  });
});
