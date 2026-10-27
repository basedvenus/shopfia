import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), rate: vi.fn(), revalidate: vi.fn(), email: vi.fn(async () => undefined),
  member: vi.fn(),
  tx: {
    partyCollaborator: { updateMany: vi.fn() },
    partyEvent: { findUnique: vi.fn(), update: vi.fn() },
    partyContribution: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    partyPhoto: { findFirst: vi.fn(), count: vi.fn(), aggregate: vi.fn(), updateMany: vi.fn() },
    notification: { create: vi.fn(), updateMany: vi.fn() }
  }
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { partyCollaborator: { findFirst: mocks.member }, $transaction: async (fn: (tx: unknown) => unknown) => fn(mocks.tx) } }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/services/party-notifications", () => ({ deliverPartyNotificationEmails: mocks.email }));
import { submitPartyContributionAction, reviewPartyContributionAction } from "@/app/actions/party-contributions";
const eventId = "c0000000000000000000000001";
const guestId = "c0000000000000000000000002";
const hostId = "c0000000000000000000000003";
const photoId = "c0000000000000000000000004";
const contributionId = "c0000000000000000000000005";
const event = { id: eventId, userId: hostId, slug: "test-party", title: "Test party" };
function submit(kind = "PHOTO", url?: string) {
  const form = new FormData(); form.set("eventId", eventId); form.set("kind", kind); form.set("photoId", photoId); if (url) form.set("url", url); return submitPartyContributionAction(form);
}
function review(decision = "APPROVED") { const form = new FormData(); form.set("contributionId", contributionId); form.set("decision", decision); return reviewPartyContributionAction(form); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: guestId } }); mocks.rate.mockResolvedValue({ ok: true });
  mocks.member.mockResolvedValue({ id: "membership" });
  mocks.tx.partyCollaborator.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.partyEvent.findUnique.mockResolvedValue(event);
  mocks.tx.partyContribution.count.mockResolvedValue(0);
  mocks.tx.partyContribution.create.mockResolvedValue({ id: contributionId });
  mocks.tx.partyContribution.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.partyContribution.findFirst.mockResolvedValue({ id: contributionId, eventId, userId: guestId, kind: "PHOTO", photoId, event });
  mocks.tx.partyPhoto.findFirst.mockResolvedValue({ id: photoId });
  mocks.tx.partyPhoto.count.mockResolvedValue(3);
  mocks.tx.partyPhoto.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  mocks.tx.partyPhoto.updateMany.mockResolvedValue({ count: 1 });
});
describe("private guest contributions", () => {
  it("keeps a submitted photo unattached and notifies only its host", async () => {
    expect(await submit()).toEqual({ ok: true });
    expect(mocks.tx.partyContribution.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: guestId, eventId, kind: "PHOTO", photoId }) });
    expect(mocks.tx.partyPhoto.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: hostId, kind: "PARTY_REVIEW" }) });
  });
  it("requires an accepted invitation", async () => {
    mocks.member.mockResolvedValue(null);
    expect(await submit()).toMatchObject({ ok: false });
    expect(mocks.tx.partyContribution.create).not.toHaveBeenCalled();
  });
  it("rechecks membership inside the transaction", async () => {
    mocks.tx.partyCollaborator.updateMany.mockResolvedValue({ count: 0 });
    expect(await submit()).toMatchObject({ ok: false });
    expect(mocks.tx.partyContribution.create).not.toHaveBeenCalled();
  });
  it("rejects another user's photo or an already attached draft", async () => {
    mocks.tx.partyPhoto.findFirst.mockResolvedValue(null);
    expect(await submit()).toMatchObject({ ok: false });
    expect(mocks.tx.partyPhoto.findFirst).toHaveBeenCalledWith({ where: { id: photoId, userId: guestId, eventId: null, contribution: null }, select: { id: true } });
    expect(mocks.tx.partyContribution.create).not.toHaveBeenCalled();
  });
  it.each([
    ["TIKTOK", "https://www.tiktok.com/@scout2015/video/6718335390845095173", "tiktokUrl"],
    ["PLAYLIST", "https://music.apple.com/us/playlist/test/pl.u-123abc", "appleMusicUrl"],
    ["PLAYLIST", "https://open.spotify.com/playlist/37i9dQZF1DZ06evO3eIivx", "spotifyUrl"]
  ])("accepts a valid %s link only as a pending contribution", async (kind, url, field) => {
    expect(await submit(kind, url)).toEqual({ ok: true });
    expect(mocks.tx.partyContribution.create).toHaveBeenCalledWith({ data: expect.objectContaining({ [field]: url, photoId: null }) });
    expect(mocks.tx.partyEvent.update).not.toHaveBeenCalled();
  });
  it("rejects invalid external URLs without creating anything", async () => {
    expect(await submit("PLAYLIST", "https://evil.test/playlist")).toMatchObject({ ok: false });
    expect(mocks.tx.partyContribution.create).not.toHaveBeenCalled();
  });
  it("caps pending submissions per guest", async () => {
    mocks.tx.partyContribution.count.mockResolvedValue(16);
    expect(await submit()).toMatchObject({ ok: false });
    expect(mocks.tx.partyContribution.create).not.toHaveBeenCalled();
  });
  it("requires authentication and honors rate limits", async () => {
    mocks.auth.mockResolvedValue(null); expect(await submit()).toMatchObject({ ok: false });
    mocks.auth.mockResolvedValue({ user: { id: guestId } }); mocks.rate.mockResolvedValue({ ok: false });
    expect(await submit()).toMatchObject({ ok: false }); expect(mocks.member).not.toHaveBeenCalled();
  });
});
describe("host moderation", () => {
  beforeEach(() => mocks.auth.mockResolvedValue({ user: { id: hostId } }));
  it("publishes a photo only after a host approves and preserves its guest attribution", async () => {
    expect(await review()).toEqual({ ok: true });
    expect(mocks.tx.partyContribution.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: contributionId, status: "PENDING", event: { userId: hostId } } }));
    expect(mocks.tx.partyPhoto.updateMany).toHaveBeenCalledWith({ where: { id: photoId, userId: guestId, eventId: null }, data: { eventId, userId: hostId, sortOrder: 3 } });
    expect(mocks.tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: guestId, kind: "PARTY_REVIEW_RESULT" }) });
  });
  it("denies guests and unrelated users approval rights", async () => {
    mocks.auth.mockResolvedValue({ user: { id: guestId } }); mocks.tx.partyContribution.findFirst.mockResolvedValue(null);
    expect(await review()).toMatchObject({ ok: false });
    expect(mocks.tx.partyContribution.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ event: { userId: guestId } }) }));
    expect(mocks.tx.partyPhoto.updateMany).not.toHaveBeenCalled();
  });
  it("declines a submission without publishing it", async () => {
    expect(await review("REJECTED")).toEqual({ ok: true });
    expect(mocks.tx.partyPhoto.updateMany).not.toHaveBeenCalled();
  });
  it("does not publish a revoked guest's submission", async () => {
    mocks.tx.partyCollaborator.updateMany.mockResolvedValue({ count: 0 });
    expect(await review()).toMatchObject({ ok: false }); expect(mocks.tx.partyPhoto.updateMany).not.toHaveBeenCalled();
  });
  it("does not publish the same submission twice", async () => {
    mocks.tx.partyContribution.updateMany.mockResolvedValue({ count: 0 });
    expect(await review()).toMatchObject({ ok: false }); expect(mocks.tx.partyPhoto.updateMany).not.toHaveBeenCalled();
  });
  it("enforces the party photo limit", async () => {
    mocks.tx.partyPhoto.count.mockResolvedValue(16);
    expect(await review()).toMatchObject({ ok: false }); expect(mocks.tx.partyPhoto.updateMany).not.toHaveBeenCalled();
  });
});
