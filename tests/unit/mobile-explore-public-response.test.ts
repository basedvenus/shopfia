import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/mobile/explore/route";
import { publicUserProfile } from "@/lib/public-user-profile";

const exploreMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/explore", () => ({ getExploreData: exploreMock }));

const privateAccount = {
  id: "legitimate-user",
  image: "/public-avatar.jpg",
  name: "Real Shop Owner",
  username: "realshop",
  email: "never-public@example.test",
  role: "VENDOR",
  emailVerified: "2026-01-01",
  passwordHash: "mock-sensitive-data",
  createdAt: "2026-01-01"
};
const expectedProfile = {
  id: "legitimate-user",
  image: "/public-avatar.jpg",
  name: "Real Shop Owner",
  username: "realshop"
};

describe("public mobile Explore response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exploreMock.mockResolvedValue({
      categories: [{ id: "category_1", name: "Florals" }],
      eventCategories: [],
      filters: { q: "flowers" },
      vendors: [{ id: "real-vendor", name: "Real Florals", user: privateAccount }],
      offerings: [{ id: "real-offering", title: "Flowers", vendor: { id: "real-vendor", user: privateAccount } }],
      parties: [{ id: "real-party", title: "Real party", user: privateAccount }],
      truncated: { vendors: true, offerings: false, parties: false }
    });
  });

  it("keeps public profile display fields and drops account fields at every nested user location", async () => {
    const response = await GET(new Request("https://shopfia.test/api/mobile/explore?q=flowers"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.vendors[0].user).toEqual(expectedProfile);
    expect(body.offerings[0].vendor.user).toEqual(expectedProfile);
    expect(body.parties[0].user).toEqual(expectedProfile);
    expect(body.vendors[0].name).toBe("Real Florals");
    expect(body.offerings[0].title).toBe("Flowers");
    expect(body.parties[0].title).toBe("Real party");
    const serialized = JSON.stringify(body);
    for (const privateField of ["email", "role", "emailVerified", "passwordHash", "createdAt", "never-public@example.test", "mock-sensitive-data"]) {
      expect(serialized).not.toContain(privateField);
    }
    // Response shaping must not mutate objects used by server-rendered pages.
    expect(privateAccount.email).toBe("never-public@example.test");
  });

  it("preserves repeated search parameters and reports bounded-search truncation", async () => {
    const response = await GET(new Request("https://shopfia.test/api/mobile/explore?categoryId=a&categoryId=b&q=flowers"));
    expect(exploreMock).toHaveBeenCalledWith({ categoryId: ["a", "b"], q: "flowers" });
    expect((await response.json()).truncated).toEqual({ vendors: true, offerings: false, parties: false });
  });

  it("supports unclaimed businesses and partial public profiles without account fallback", () => {
    expect(publicUserProfile(null)).toBeNull();
    expect(publicUserProfile(undefined)).toBeNull();
    expect(JSON.parse(JSON.stringify(publicUserProfile({ username: "shop" })))).toEqual({ username: "shop" });
  });
});
