import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { getPartyInspirationExample, getUniquePartyVendors } from "@/lib/party-inspiration";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  explore: vi.fn(),
  db: {
    partyEvent: { findFirst: vi.fn(), findMany: vi.fn() },
    partyCollaborator: { findMany: vi.fn() },
    vendorProfile: { findMany: vi.fn() },
    follow: { findMany: vi.fn(), findUnique: vi.fn() },
    favorite: { findMany: vi.fn() },
    user: { findMany: vi.fn() }
  }
}));
vi.mock("@/lib/data/explore", () => ({ getExploreData: mocks.explore }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/app/actions/auth", () => ({ toggleFollowAction: vi.fn() }));
vi.mock("@/components/parties/party-event-form", () => ({ PartyEventForm: () => null }));
vi.mock("@/components/favorites/favorite-toggle", () => ({ FavoriteToggle: () => null }));
vi.mock("@/lib/profile-badges", () => ({
  getOriginalMemberCutoffDate: vi.fn(async () => null),
  getProfileBadge: vi.fn(() => null)
}));

import EventPage from "@/app/events/[slug]/page";
import PartiesPage from "@/app/parties/page";
import HomePage from "@/app/page";
import ExplorePage from "@/app/explore/page";
import { VendorCard } from "@/components/explore/vendor-card";

function nodes(node: ReactNode): Array<Record<string, unknown>> {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node.props, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return isValidElement<{ children?: ReactNode }>(node) ? text(node.props.children) : "";
}
const vendor = { id: "vendor-real", name: "Real Florist", slug: "real-florist", userId: null, logoUrl: null, coverPhoto: null, categories: [] };
function publishedParty() {
  return {
    id: "party-real", slug: "citrus-garden-brunch", userId: "host-real",
    title: "Actual Party", description: null, theme: null, tags: [],
    coverImageUrl: null, imageUrls: [], location: null, city: null, state: null,
    eventDate: null, partyfulUrl: null, createdAt: new Date("2026-01-01"),
    user: { id: "host-real", name: "Real Host", username: "real-host", image: null },
    collaborators: [], taggedVendors: [vendor],
    photos: [{ id: "photo-real", updatedAt: new Date("2026-01-01"), crop: null, taggedVendors: [vendor], vendorRatings: [] }]
  };
}

describe("truthful party inspiration and credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.db.partyEvent.findFirst.mockResolvedValue(null);
    mocks.db.partyEvent.findMany.mockResolvedValue([]);
    mocks.db.partyCollaborator.findMany.mockResolvedValue([]);
    mocks.db.vendorProfile.findMany.mockResolvedValue([]);
    mocks.db.follow.findMany.mockResolvedValue([]);
    mocks.db.follow.findUnique.mockResolvedValue(null);
    mocks.db.favorite.findMany.mockResolvedValue([]);
    mocks.db.user.findMany.mockResolvedValue([]);
    mocks.explore.mockResolvedValue({ categories: [], eventCategories: [], filters: {}, vendors: [], offerings: [], parties: [], truncated: { vendors: false, offerings: false, parties: false } });
  });

  it("retains the requested homepage sentence and labels decorative images without fake counts", () => {
    const page = HomePage();
    expect(text(page)).toContain("Your one-stop shop for party planning.");
    expect(text(page)).toContain("Inspiration example");
    expect(text(page)).not.toContain("8 vendors tagged");
    expect(text(page)).not.toContain("Lemon Grove Baby Brunch");
    expect(text(page)).not.toContain("Pinterest gives you ideas");
  });

  it("never overlays example metadata on a published event with the same slug", () => {
    expect(getPartyInspirationExample("citrus-garden-brunch", false)?.title).toBe("Citrus Garden Brunch");
    expect(getPartyInspirationExample("citrus-garden-brunch", true)).toBeUndefined();
  });

  it("deduplicates event and photo credits by vendor ID, preserving distinct vendors with the same name", () => {
    expect(getUniquePartyVendors({
      taggedVendors: [vendor],
      photos: [{ taggedVendors: [vendor, { ...vendor, id: "other-vendor" }] }, { taggedVendors: [vendor] }]
    }).map((credit) => credit.id)).toEqual(["vendor-real", "other-vendor"]);
  });

  it("omits only quarantined fixture IDs from party credit counts", () => {
    expect(getUniquePartyVendors({
      taggedVendors: [{ ...vendor, id: "cmv00417g000392dgmtxxlwjz" }, { ...vendor, name: "Codex Test Vendor" }],
      photos: [{ taggedVendors: [{ ...vendor, id: "cmu2v8qua0003i9d2b80nax04" }] }]
    })).toEqual([{ ...vendor, name: "Codex Test Vendor" }]);
  });

  it("labels a fallback as an example and does not fabricate vendor credits or storefront links", async () => {
    const page = await EventPage({ params: Promise.resolve({ slug: "citrus-garden-brunch" }) });
    expect(text(page)).toContain("Inspiration example");
    expect(text(page)).toContain("No verified vendor credits");
    expect(text(page)).not.toContain("View storefront");
    expect(mocks.db.vendorProfile.findMany).not.toHaveBeenCalled();
  });

  it("renders real party metadata and one working storefront link for duplicate credits", async () => {
    mocks.db.partyEvent.findFirst.mockResolvedValue(publishedParty());
    const page = await EventPage({ params: Promise.resolve({ slug: "citrus-garden-brunch" }) });
    expect(text(page)).toContain("Actual Party");
    expect(text(page)).not.toContain("Inspiration example");
    expect(text(page)).not.toContain("A soft citrus tablescape");
    expect(nodes(page).filter((node) => node.href === "/real-florist")).toHaveLength(1);
    expect(mocks.db.vendorProfile.findMany).not.toHaveBeenCalled();
  });

  it("preserves quarantined credits in the owner’s edit model without displaying them publicly", async () => {
    const party = publishedParty();
    party.photos[0].taggedVendors = [{ ...vendor, id: "cmv00417g000392dgmtxxlwjz" }];
    party.taggedVendors = [];
    mocks.auth.mockResolvedValue({ user: { id: party.userId } });
    mocks.db.partyEvent.findFirst.mockResolvedValue(party);
    const page = await EventPage({ params: Promise.resolve({ slug: party.slug }), searchParams: Promise.resolve({ edit: "1" }) });
    const form = nodes(page).find((node) => node.initialParty);
    expect(form?.initialParty).toMatchObject({ photos: [{ vendorIds: ["cmv00417g000392dgmtxxlwjz"] }] });
    expect(text(page)).not.toContain("View storefront");
    expect(mocks.db.partyEvent.findFirst.mock.calls[0][0].include.photos.include.taggedVendors.where).toBeUndefined();
  });

  it("never replaces a real party’s missing photos with decorative example imagery", async () => {
    const party = { ...publishedParty(), photos: [] };
    mocks.db.partyEvent.findFirst.mockResolvedValue(party);
    const page = await EventPage({ params: Promise.resolve({ slug: party.slug }) });
    expect(text(page)).toContain("No party photos have been added yet");
    expect(nodes(page).some((node) => node.src === "/demo/fairfield-lemon-tablescape.png")).toBe(false);
    mocks.db.partyEvent.findFirst.mockResolvedValue({ ...party, coverImageUrl: "/real-cover.png" });
    const coverPage = await EventPage({ params: Promise.resolve({ slug: party.slug }) });
    expect(nodes(coverPage).filter((node) => node.src === "/real-cover.png")).toHaveLength(2);
  });

  it("shows zero published parties separately from the decorative examples", async () => {
    const page = await PartiesPage({});
    expect(text(page)).toContain("0 published parties");
    expect(text(page)).toContain("Inspiration examples");
    expect(text(page)).not.toContain("1 tagged vendor");
    expect(nodes(page).filter((node) => node.href === "/events/citrus-garden-brunch")).toHaveLength(1);
  });

  it("does not turn a database outage into a zero-party claim or fallback event", async () => {
    mocks.db.partyEvent.findMany.mockRejectedValueOnce(new Error("database unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const page = await PartiesPage({});
    expect(text(page)).toContain("Party feed unavailable");
    expect(text(page)).not.toContain("0 published parties");
    errorLog.mockRestore();
    mocks.db.partyEvent.findFirst.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(EventPage({ params: Promise.resolve({ slug: "citrus-garden-brunch" }) })).rejects.toThrow("database unavailable");
  });

  it("does not substitute unrelated examples for an empty search", async () => {
    const page = await PartiesPage({ searchParams: { q: "nonexistent theme" } });
    expect(text(page)).toContain("No published parties match your search");
    expect(text(page)).not.toContain("Citrus Garden Brunch");
  });

  it("counts duplicate published credits once and links to the actual storefront", async () => {
    mocks.db.partyEvent.findMany.mockResolvedValue([publishedParty()]);
    const page = await PartiesPage({});
    expect(text(page)).toContain("1 published party");
    expect(text(page)).toContain("1 tagged vendor");
    expect(text(page)).not.toContain("Inspiration examples");
    expect(nodes(page).filter((node) => node.href === "/real-florist")).toHaveLength(1);
  });

  it("applies the Following predicate before the database result limit", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "viewer" } });
    mocks.db.follow.findMany.mockResolvedValue([{ followingId: "host-real" }]);
    mocks.db.partyEvent.findMany.mockResolvedValue([publishedParty()]);
    const page = await PartiesPage({ searchParams: { feed: "following" } });
    expect(text(page)).toContain("Actual Party");
    expect(mocks.db.partyEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 60,
      where: { AND: [expect.objectContaining({ OR: expect.arrayContaining([{ userId: { in: ["host-real"] } }]) })] }
    }));
  });

  it("discloses a bounded location search instead of asserting no matches", async () => {
    mocks.explore.mockResolvedValue({ categories: [], eventCategories: [], filters: {}, vendors: [], offerings: [], parties: [], truncated: { vendors: true, offerings: true, parties: true } });
    const page = await ExplorePage({ searchParams: Promise.resolve({}) });
    expect(text(page)).toContain("This location search reached its result limit");
    expect(text(page)).toContain("0 vendors shown (partial results)");
    expect(text(page)).not.toContain("No vendors match");
    expect(text(page)).not.toContain("No offerings match");
    expect(text(page)).not.toContain("No published parties match");
  });

  it("displays an advertised zero price as zero instead of custom pricing", () => {
    const page = VendorCard({ vendor: {
      ...vendor, city: "Fairfield", state: "CA", photos: [], status: "CLAIMED", verified: false,
      averageRating: 0, reviewCount: 0, rankingScore: null, startingPriceCents: 0, user: null, offerings: []
    } });
    expect(text(page)).toContain("From $0.00");
    expect(text(page)).not.toContain("Custom pricing");
  });

  it("keeps an empty Following feed empty instead of returning everyone’s posts", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "viewer" } });
    mocks.db.partyEvent.findMany.mockResolvedValue([publishedParty()]);
    const page = await PartiesPage({ searchParams: { feed: "following" } });
    expect(text(page)).toContain("0 published parties");
    expect(text(page)).toContain("No parties from the people you follow yet");
    expect(text(page)).not.toContain("Actual Party");
  });
});
