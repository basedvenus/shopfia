import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), find: vi.fn(), remove: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { deletePartyEventAction } from "@/app/actions/party-events";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.rate.mockResolvedValue({ ok: true });
  mocks.find.mockResolvedValue({ slug: "my-party", user: { username: "host" } });
  mocks.remove.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((callback) => callback({ partyEvent: { findFirst: mocks.find, deleteMany: mocks.remove } }));
});
describe("owner-only party deletion", () => {
  it("checks ownership on the read and atomic delete, then refreshes public and personal pages", async () => {
    expect(await deletePartyEventAction("party")).toEqual({ ok: true });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "party", userId: "owner" } }));
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "party", userId: "owner" } });
    for (const path of ["/parties", "/my-parties", "/favorites", "/notifications", "/events/my-party", "/profiles/host"]) expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });
  it.each(["guest", "cohost", "unrelated"])("does not let a %s delete someone else's party", async (id) => {
    mocks.auth.mockResolvedValue({ user: { id } });
    mocks.find.mockResolvedValue(null);
    expect(await deletePartyEventAction("party")).toMatchObject({ ok: false });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "party", userId: id } }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects signed-out requests before touching party data", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await deletePartyEventAction("party")).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("handles a changed or already-deleted party without claiming success", async () => {
    mocks.remove.mockResolvedValue({ count: 0 });
    expect(await deletePartyEventAction("party")).toMatchObject({ ok: false });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("honors rate limits and rejects empty party IDs", async () => {
    expect(await deletePartyEventAction("")).toMatchObject({ ok: false });
    mocks.rate.mockResolvedValue({ ok: false });
    expect(await deletePartyEventAction("party")).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("reports a database failure without a success result", async () => {
    mocks.transaction.mockRejectedValue(new Error("offline"));
    expect(await deletePartyEventAction("party")).toMatchObject({ ok: false });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
