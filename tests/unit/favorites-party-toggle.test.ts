import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  favorite: {
    create: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn()
  },
  partyEvent: {
    findUnique: vi.fn()
  }
}));

const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

vi.mock("@/lib/auth/guards", () => ({
  requireSession: vi.fn().mockResolvedValue({ user: { id: "buyer_1" } })
}));

vi.mock("@/lib/security/request", () => ({
  checkServerActionRateLimit: vi.fn().mockResolvedValue({ ok: true })
}));

describe("party favorite toggling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.partyEvent.findUnique.mockResolvedValue({ id: "party_1", slug: "venus-aura-party" });
  });

  it("saves a party so it appears in Favorites and counters can increment", async () => {
    const { toggleFavoriteAction } = await import("@/app/actions/favorites");
    dbMock.favorite.findUnique.mockResolvedValue(null);
    dbMock.favorite.create.mockResolvedValue({ id: "favorite_1", partyEventId: "party_1" });

    await toggleFavoriteAction("party", "party_1");

    expect(dbMock.favorite.create).toHaveBeenCalledWith({
      data: { buyerId: "buyer_1", partyEventId: "party_1" }
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/favorites");
    expect(revalidatePathMock).toHaveBeenCalledWith("/explore");
  });

  it("unsaves a party so it is removed from Favorites and counters can decrement", async () => {
    const { toggleFavoriteAction } = await import("@/app/actions/favorites");
    dbMock.favorite.findUnique.mockResolvedValue({ id: "favorite_1", partyEventId: "party_1" });

    await toggleFavoriteAction("party", "party_1");

    expect(dbMock.favorite.delete).toHaveBeenCalledWith({ where: { id: "favorite_1" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/favorites");
    expect(revalidatePathMock).toHaveBeenCalledWith("/explore");
  });
});
