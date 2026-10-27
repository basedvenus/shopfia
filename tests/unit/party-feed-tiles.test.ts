import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ parties: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({ db: { partyEvent: { findMany: mocks.parties } } }));
vi.mock("@/app/actions/auth", () => ({ toggleFollowAction: vi.fn() }));
vi.mock("@/lib/profile-badges", () => ({ getOriginalMemberCutoffDate: async () => null, getProfileBadge: () => null }));
vi.mock("@/components/favorites/favorite-toggle", () => ({ FavoriteToggle: () => null }));
vi.mock("@/components/parties/friend-search-form", () => ({ FriendSearchForm: () => null }));
import PartiesPage from "@/app/parties/page";
const party = {
  id: "party", slug: "autumn-wonderland", title: "Autumn Wonderland", tags: ["kidsbirthday"],
  location: "Private residence", city: "Private city", state: "CA", theme: null,
  createdAt: new Date("2026-10-01"), photos: [{ id: "photo", updatedAt: new Date("2026-10-01"), crop: { x: 50, y: 50, zoom: 1, aspectRatio: 1.33 }, taggedVendors: [] }],
  imageUrls: [], coverImageUrl: null, taggedVendors: [], collaborators: [],
  user: { id: "host", name: "Host", username: "host", image: null }
};
beforeEach(() => mocks.parties.mockResolvedValue([party]));
describe("party feed tile metadata", () => {
  it("shows the saved event category without revealing private-residence locations", async () => {
    const html = renderToStaticMarkup(await PartiesPage({}));
    expect(html).toContain("Autumn Wonderland");
    expect(html).toContain("Kids’ Birthday");
    expect(html).not.toContain("Private city");
    expect(html).not.toContain("Private residence");
  });
  it("shows public locations alongside the category", async () => {
    mocks.parties.mockResolvedValue([{ ...party, location: "Garden venue", city: "Fairfield" }]);
    const html = renderToStaticMarkup(await PartiesPage({}));
    expect(html).toContain("Fairfield");
    expect(html).toContain("Kids’ Birthday");
  });
});
