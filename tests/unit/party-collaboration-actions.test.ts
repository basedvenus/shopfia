import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyCollaborationStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  db: {
    $transaction: vi.fn(),
    partyCollaborator: { updateMany: vi.fn() },
    partyEvent: { findFirst: vi.fn() },
    partyPhoto: { findMany: vi.fn() },
    vendorProfile: { findMany: vi.fn() }
  },
  tx: {
    partyEvent: { create: vi.fn(), update: vi.fn() },
    partyPhoto: { deleteMany: vi.fn(), update: vi.fn() },
    partyPhotoVendorRating: { deleteMany: vi.fn(), upsert: vi.fn() },
    partyCollaborator: { updateMany: vi.fn(), upsert: vi.fn() },
    user: { findMany: vi.fn() }
  }
}));
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
  mocks.db.partyPhoto.findMany.mockResolvedValue([]);
  mocks.db.vendorProfile.findMany.mockResolvedValue([]);
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
