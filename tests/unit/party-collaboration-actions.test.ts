import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyCollaborationStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  db: {
    $transaction: vi.fn(),
    notification: { updateMany: vi.fn() },
    partyCollaborator: { updateMany: vi.fn() },
    partyEvent: { findFirst: vi.fn() },
    partyPhoto: { findMany: vi.fn() },
    partyVendorRating: { findMany: vi.fn() },
    vendorProfile: { findMany: vi.fn() }
  },
  tx: {
    partyEvent: { create: vi.fn(), update: vi.fn() },
    partyPhoto: { deleteMany: vi.fn(), update: vi.fn() },
    partyVendorRating: { upsert: vi.fn() },
    partyPhotoVendorRating: { deleteMany: vi.fn(), upsert: vi.fn() },
    notification: { createMany: vi.fn() },
    partyCollaborator: { updateMany: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn() }
  }
}));
vi.mock("@/lib/services/party-notifications", () => ({ deliverPartyNotificationEmails: vi.fn(async () => undefined) }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rateLimit }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));

import { createPartyEventAction, updatePartyCollaborationAction, updatePartyEventAction } from "@/app/actions/auth";

const ownerId = "c0000000000000000000000001";
const inviteeId = "c0000000000000000000000002";
const eventId = "c0000000000000000000000003";
const photoId = "c0000000000000000000000004";
const rows: Array<{ id: string; userId: string; status: PartyCollaborationStatus }> = [];

function response(action: string, collaborationId = "invitation") {
  const data = new FormData();
  data.set("collaborationId", collaborationId);
  data.set("action", action);
  // These attacker-controlled fields must never substitute for the session.
  data.set("userId", inviteeId);
  data.set("ownerId", ownerId);
  return data;
}

function editForm() {
  const data = new FormData();
  data.set("eventId", eventId);
  data.set("title", "Synthetic Test Party");
  data.set("mainHostId", ownerId);
  data.append("coHostIds", inviteeId);
  data.set("photos", "[]");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  rows.splice(0, rows.length, { id: "invitation", userId: inviteeId, status: "PENDING" });
  mocks.auth.mockResolvedValue({ user: { id: inviteeId } });
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.db.partyCollaborator.updateMany.mockImplementation(async ({ where, data }) => {
    const affected = rows.filter((row) =>
      row.id === where.id && row.userId === where.userId &&
      (typeof where.status === "string" ? row.status === where.status : where.status.in.includes(row.status))
    );
    affected.forEach((row) => { row.status = data.status; });
    return { count: affected.length };
  });
  mocks.db.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.db.partyEvent.findFirst.mockImplementation(async ({ where }) =>
    where.id === eventId && where.userId === ownerId ? { id: eventId, slug: "test-party", photos: [] } : null
  );
  mocks.db.partyVendorRating.findMany.mockResolvedValue([]);
  mocks.tx.partyVendorRating.upsert.mockResolvedValue({});
  mocks.db.partyPhoto.findMany.mockResolvedValue([]);
  mocks.db.vendorProfile.findMany.mockResolvedValue([]);
  mocks.tx.partyCollaborator.findMany.mockResolvedValue([]);
  mocks.tx.user.findMany.mockResolvedValue([{ id: ownerId }, { id: inviteeId }]);
  mocks.tx.partyEvent.create.mockResolvedValue({ id: eventId, slug: "test-party" });
  mocks.tx.partyEvent.update.mockResolvedValue({ slug: "test-party" });
});

describe("invited-user-only collaboration responses", () => {
  it.each(["accept", "decline"])("lets the signed-in recipient %s a pending invitation", async (action) => {
    expect(await updatePartyCollaborationAction(response(action))).toEqual({ ok: true });
    expect(rows[0].status).toBe(action === "accept" ? "ACCEPTED" : "DECLINED");
    expect(mocks.db.partyCollaborator.updateMany).toHaveBeenCalledWith({
      where: { id: "invitation", userId: inviteeId, status: "PENDING" },
      data: { status: action === "accept" ? "ACCEPTED" : "DECLINED" }
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/my-parties");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/parties");
  });

  it.each([ownerId, "unrelated-user"])("does not let %s respond for the invitee", async (userId) => {
    mocks.auth.mockResolvedValue({ user: { id: userId, role: "ADMIN" } });
    for (const action of ["accept", "decline", "remove"]) {
      expect(await updatePartyCollaborationAction(response(action))).toMatchObject({ ok: false });
      expect(rows[0].status).toBe("PENDING");
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["ACCEPTED", "DECLINED", "REMOVED"] as const)("never accepts or declines an invitation already %s", async (status) => {
    rows[0].status = status;
    for (const action of ["accept", "decline"]) {
      expect(await updatePartyCollaborationAction(response(action))).toMatchObject({ ok: false });
      expect(rows[0].status).toBe(status);
    }
  });

  it("does not let a stale or repeated accept restore a revoked invitation", async () => {
    expect(await updatePartyCollaborationAction(response("accept"))).toEqual({ ok: true });
    expect(await updatePartyCollaborationAction(response("accept"))).toMatchObject({ ok: false });
    expect(await updatePartyCollaborationAction(response("remove"))).toEqual({ ok: true });
    expect(await updatePartyCollaborationAction(response("accept"))).toMatchObject({ ok: false });
    expect(rows[0].status).toBe("REMOVED");
  });

  it.each(["PENDING", "ACCEPTED"] as const)("lets the recipient remove a %s attribution", async (status) => {
    rows[0].status = status;
    expect(await updatePartyCollaborationAction(response("remove"))).toEqual({ ok: true });
    expect(rows[0].status).toBe("REMOVED");
  });

  it.each(["DECLINED", "REMOVED"] as const)("does not overwrite %s with a repeated remove", async (status) => {
    rows[0].status = status;
    expect(await updatePartyCollaborationAction(response("remove"))).toMatchObject({ ok: false });
    expect(rows[0].status).toBe(status);
  });

  it("requires a signed-in user before querying invitations", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await updatePartyCollaborationAction(response("accept"))).toMatchObject({ ok: false });
    expect(mocks.db.partyCollaborator.updateMany).not.toHaveBeenCalled();
  });

  it("honors rate limits before mutation", async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false });
    expect(await updatePartyCollaborationAction(response("accept"))).toMatchObject({ ok: false });
    expect(mocks.db.partyCollaborator.updateMany).not.toHaveBeenCalled();
  });

  it.each(["", "approve", "ACCEPTED"])("rejects invalid action %s", async (action) => {
    expect(await updatePartyCollaborationAction(response(action))).toMatchObject({ ok: false });
    expect(mocks.db.partyCollaborator.updateMany).not.toHaveBeenCalled();
  });

  it("rejects unknown invitation IDs without revealing their owner", async () => {
    expect(await updatePartyCollaborationAction(response("accept", "unknown"))).toMatchObject({ ok: false });
    expect(rows[0].status).toBe("PENDING");
  });
});

describe("party owner rights and persistence wiring", () => {
  it.each(["create", "update"])("persists one user rating when a vendor is tagged in multiple photos during %s", async (mode) => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const vendorId = "c0000000000000000000000005";
    const secondPhotoId = "c0000000000000000000000006";
    mocks.db.partyPhoto.findMany.mockResolvedValue([photoId, secondPhotoId].map((id) => ({ id, updatedAt: new Date("2026-01-01") })));
    mocks.db.vendorProfile.findMany.mockResolvedValue([{ id: vendorId }]);
    const form = editForm();
    form.set("photos", JSON.stringify([{ id: photoId, vendorIds: [vendorId], vendorRatings: { [vendorId]: 5 } }, { id: secondPhotoId, vendorIds: [vendorId], vendorRatings: {} }]));
    expect(await (mode === "create" ? createPartyEventAction(form) : updatePartyEventAction(form))).toMatchObject({ ok: true });
    expect(mocks.tx.partyVendorRating.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.tx.partyVendorRating.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId_userId_vendorId: { eventId, userId: ownerId, vendorId } }, create: { eventId, userId: ownerId, vendorId, rating: 5 } }));
    for (const [write] of mocks.tx.partyPhotoVendorRating.upsert.mock.calls) expect(write.create.rating).toBeNull();
  });
  it("reuses only the signed-in user's saved party rating when another photo is tagged", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const vendorId = "c0000000000000000000000005";
    mocks.db.partyVendorRating.findMany.mockResolvedValue([{ vendorId, rating: 4 }]);
    mocks.db.partyPhoto.findMany.mockResolvedValue([{ id: photoId, updatedAt: new Date("2026-01-01") }]);
    mocks.db.vendorProfile.findMany.mockResolvedValue([{ id: vendorId }]);
    const form = editForm();form.set("photos", JSON.stringify([{ id: photoId, vendorIds: [vendorId] }]));
    expect(await updatePartyEventAction(form)).toMatchObject({ ok: true });
    expect(mocks.db.partyVendorRating.findMany).toHaveBeenCalledWith({ where: { eventId, userId: ownerId }, select: { vendorId: true, rating: true } });
    expect(mocks.tx.partyVendorRating.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { rating: 4 } }));
  });

  it.each(["create", "update"])("requires a rating for each tagged vendor during %s", async (mode) => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const vendorId = "c0000000000000000000000005";
    mocks.db.partyPhoto.findMany.mockResolvedValue([{ id: photoId, updatedAt: new Date("2026-01-01") }]);
    mocks.db.vendorProfile.findMany.mockResolvedValue([{ id: vendorId }]);
    const form = editForm();
    form.set("photos", JSON.stringify([{ id: photoId, vendorIds: [vendorId], vendorRatings: {} }]));
    expect(await (mode === "create" ? createPartyEventAction(form) : updatePartyEventAction(form))).toEqual({ ok: false, error: "Rate each tagged vendor before saving your party." });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("keeps owner edits authorized and stores other users as pending", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    expect(await updatePartyEventAction(editForm())).toEqual({ ok: true, eventSlug: "test-party" });
    expect(mocks.tx.partyEvent.update).toHaveBeenCalled();
    expect(mocks.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 30_000 });
    const collaboratorWrites = mocks.tx.partyCollaborator.upsert.mock.calls.map(([call]) => call);
    expect(collaboratorWrites.find((call) => call.create.userId === ownerId).create.status).toBe("ACCEPTED");
    const invitedWrite = collaboratorWrites.find((call) => call.create.userId === inviteeId);
    expect(invitedWrite.create.status).toBe("PENDING");
    expect(invitedWrite.update).not.toHaveProperty("status");
  });

  it.each(["PENDING", "ACCEPTED"] as const)("does not give a %s invitee event edit rights", async (status) => {
    rows[0].status = status;
    expect(await updatePartyEventAction(editForm())).toMatchObject({ ok: false });
    expect(mocks.db.partyEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: eventId, userId: inviteeId } }));
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("creates a party with self-consent but no consent on invited users' behalf", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    mocks.db.partyPhoto.findMany.mockResolvedValue([{ id: photoId, updatedAt: new Date("2026-01-01") }]);
    const form = editForm();
    form.set("photos", JSON.stringify([{ id: photoId, vendorIds: [] }]));
    expect(await createPartyEventAction(form)).toEqual({ ok: true, eventSlug: "test-party" });
    const collaboratorWrites = mocks.tx.partyCollaborator.upsert.mock.calls.map(([call]) => call);
    expect(collaboratorWrites.map((call) => [call.create.userId, call.create.status])).toEqual([
      [ownerId, "ACCEPTED"], [inviteeId, "PENDING"]
    ]);
  });
});


describe("party guest form persistence", () => {
  it("passes guest selections through the authorized edit action", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const form = editForm();
    form.delete("coHostIds");
    form.append("guestIds", inviteeId);
    expect(await updatePartyEventAction(form)).toEqual({ ok: true, eventSlug: "test-party" });
    expect(mocks.tx.partyCollaborator.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: inviteeId, role: "GUEST", status: "PENDING" })
    }));
  });
});


describe("party media persistence", () => {
  it.each(["create", "update"])("persists normalized video and playlist links during %s", async (mode) => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    mocks.db.partyPhoto.findMany.mockResolvedValue([{ id: photoId, updatedAt: new Date("2026-01-01") }]);
    const form = editForm();
    form.set("photos", JSON.stringify([{ id: photoId, vendorIds: [] }]));
    form.set("tiktokUrl", "https://www.tiktok.com/@scout2015/video/6718335390845095173?share=1");
    form.set("appleMusicUrl", "https://music.apple.com/us/playlist/party/pl.u-123abc?ls=1");
    expect(await (mode === "create" ? createPartyEventAction(form) : updatePartyEventAction(form))).toMatchObject({ ok: true });
    expect(mode === "create" ? mocks.tx.partyEvent.create : mocks.tx.partyEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tiktokUrl: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
        appleMusicUrl: "https://music.apple.com/us/playlist/party/pl.u-123abc"
      })
    }));
  });
  it("clears removed links", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const form = editForm();
    form.set("tiktokUrl", ""); form.set("appleMusicUrl", "");
    expect(await updatePartyEventAction(form)).toMatchObject({ ok: true });
    expect(mocks.tx.partyEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tiktokUrl: null, appleMusicUrl: null }) }));
  });
  it.each(["tiktokUrl", "appleMusicUrl"])("rejects an unrelated provider in %s before writes", async (field) => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const form = editForm(); form.set(field, "https://example.com/not-a-player");
    expect(await updatePartyEventAction(form)).toMatchObject({ ok: false });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});

describe("county privacy and expanded party links", () => {
  it("requires a county for a private residence", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const form = editForm(); form.set("location", "Private residence");
    expect(await updatePartyEventAction(form)).toMatchObject({ ok: false });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it("discards precise private location fields in favor of the canonical county", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const form = editForm(); form.set("location", "Private residence"); form.set("countyState", "CA"); form.set("countyFips", "06095");
    form.set("locationFormattedAddress", "123 Private Street"); form.set("locationCity", "Private city"); form.set("locationZipCode", "99999"); form.set("locationLat", "37.12345"); form.set("locationLng", "-122.12345"); form.set("locationPlaceId", "private-place-id");
    expect(await updatePartyEventAction(form)).toMatchObject({ ok: true });
    expect(mocks.tx.partyEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ county: "Solano County", countyFips: "06095", state: "CA", formattedAddress: null, city: null, zipCode: null, googlePlaceId: null }) }));
    expect(mocks.tx.partyEvent.update.mock.calls[0][0].data.locationLat).not.toBe(37.12345);
  });
  it("stores multiple videos, Spotify, and Pinterest with tracking removed", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ownerId } });
    const form = editForm();
    form.append("tiktokUrls", "https://www.tiktok.com/@scout2015/video/6718335390845095173");
    form.append("tiktokUrls", "https://www.tiktok.com/@scout2015/video/6718335390845095174");
    form.set("spotifyUrl", "https://open.spotify.com/playlist/37i9dQZF1DZ06evO3eIivx?si=test");
    form.set("pinterestUrl", "https://www.pinterest.com/testprofile/party-board/?tracking=1");
    expect(await updatePartyEventAction(form)).toMatchObject({ ok: true });
    expect(mocks.tx.partyEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tiktokUrls: expect.arrayContaining([expect.stringContaining("6718335390845095173"), expect.stringContaining("6718335390845095174")]), spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DZ06evO3eIivx", pinterestUrl: "https://www.pinterest.com/testprofile/party-board/" }) }));
  });
});
