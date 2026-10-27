import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), rate: vi.fn(), event: vi.fn(), list: vi.fn(), parent: vi.fn(), create: vi.fn(), notify: vi.fn(), email: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { partyEvent: { findUnique: mocks.event }, partyComment: { findMany: mocks.list, findFirst: mocks.parent, create: mocks.create }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ partyComment: { create: mocks.create }, notification: { create: mocks.notify } }) } }));
vi.mock("@/lib/services/party-notifications", () => ({ deliverPartyNotificationEmails: mocks.email }));
vi.mock("@/lib/security/request", () => ({ assertSameOrigin: mocks.origin, enforceRequestRateLimit: mocks.rate }));
import { GET, POST } from "@/app/api/parties/[eventId]/comments/route";
const context = { params: Promise.resolve({ eventId: "party" }) };
const commentId = "c0000000000000000000000001";
const post = (payload: unknown) => POST(new Request("https://shopfia.app/api/parties/party/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), context);
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "viewer" } }); mocks.origin.mockReturnValue(true); mocks.rate.mockReturnValue(null);
  mocks.event.mockResolvedValue({ id: "party", userId: "host", slug: "test-party", title: "Test Party" }); mocks.list.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ id: "new-comment", user: { id: "viewer", name: "Guest", username: "guest", image: null, imageCrop: null, avatar: null } }); mocks.parent.mockResolvedValue({ id: commentId, parentId: null });
  mocks.email.mockResolvedValue(undefined);
});
describe("party comments and replies", () => {
  it("creates a host notification with each guest comment", async () => {
    expect((await post({ body: "Hello" })).status).toBe(201);
    expect(mocks.notify).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "host", kind: "PARTY_COMMENT", href: "/events/test-party#party-comments", dedupeKey: "party-comment:new-comment:host" }) });
    expect(mocks.email).toHaveBeenCalledWith("party", "host");
  });
  it("does not notify hosts about their own comments", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "host" } });
    expect((await post({ body: "Hello" })).status).toBe(201);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("returns saved profile photos for comments and replies without exposing avatar metadata", async () => {
    const user = { id: "viewer", name: "Guest", username: "guest", image: "https://lh3.googleusercontent.com/old", imageCrop: null, avatar: { updatedAt: new Date("2026-10-27T00:00:00Z") } };
    mocks.list.mockResolvedValue([{ id: "comment", user, replies: [{ id: "reply", user }] }]);
    const result = await GET(new Request("https://shopfia.app/api/parties/party/comments"), context);
    const { comments } = await result.json();
    expect(comments[0].user.image).toMatch(/^\/api\/users\/viewer\/avatar\?v=/);
    expect(comments[0].replies[0].user.image).toBe(comments[0].user.image);
    expect(comments[0].user.avatar).toBeUndefined();
  });
  it("loads public comments without caching them", async () => {
    const result = await GET(new Request("https://shopfia.app/api/parties/party/comments"), context);
    expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toContain("no-store");
    expect(await result.json()).toEqual({ comments: [] });
  });
  it("requires sign-in to post", async () => {
    mocks.auth.mockResolvedValue(null); expect((await post({ body: "Who made the cookies?" })).status).toBe(401); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects cross-origin posts", async () => {
    mocks.origin.mockReturnValue(false); expect((await post({ body: "Hello" })).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["", " ", "a".repeat(1001)])("rejects invalid comment bodies", async (body) => {
    expect((await post({ body })).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses the signed-in author rather than an author from the request", async () => {
    expect((await post({ body: "  Who made the cookies?  ", userId: "somebody-else" })).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: { eventId: "party", userId: "viewer", body: "Who made the cookies?", parentId: null } }));
  });
  it("rejects replies to comments outside this party", async () => {
    mocks.parent.mockResolvedValue(null);
    expect((await post({ body: "Thanks!", parentId: commentId })).status).toBe(400);
    expect(mocks.parent).toHaveBeenCalledWith(expect.objectContaining({ where: { id: commentId, eventId: "party" } }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps replies to replies in the same thread", async () => {
    mocks.parent.mockResolvedValue({ id: commentId, parentId: "root-comment" });
    expect((await post({ body: "Thanks!", parentId: commentId })).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ parentId: "root-comment" }) }));
  });
  it("rejects posts to a missing party", async () => {
    mocks.event.mockResolvedValue(null); expect((await post({ body: "Hello" })).status).toBe(404); expect(mocks.create).not.toHaveBeenCalled();
  });
});
