import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartyCollaborationStatus, PartyCollaboratorRole, type Prisma } from "@prisma/client";
import { persistPartyCollaborators } from "@/lib/services/party-collaboration";
import { getVisiblePartyCollaborators } from "@/lib/party-public-view";

type Collaboration = {
  eventId: string;
  userId: string;
  role: PartyCollaboratorRole;
  status: PartyCollaborationStatus;
  invitedById?: string | null;
};

// Intentionally supports only the scalar filters this service writes. All DB
// calls are local fakes; the unit setup also disables real PrismaClient access.
function matches(row: Collaboration, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    const actual = row[key as keyof Collaboration];
    if (value && typeof value === "object") {
      if ("in" in value) return (value.in as unknown[]).includes(actual);
      if ("notIn" in value) return !(value.notIn as unknown[]).includes(actual);
      throw new Error(`Unsupported filter: ${key}`);
    }
    return actual === value;
  });
}

const rows: Collaboration[] = [];
const userIds = ["owner", "new-main", "new-cohost", "accepted", "pending", "declined", "removed"];
const tx = {
  user: {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      userIds.filter((id) => where.id.in.includes(id)).map((id) => ({ id })))
  },
  partyCollaborator: {
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Collaboration> }) => {
      const affected = rows.filter((row) => matches(row, where));
      affected.forEach((row) => Object.assign(row, data));
      return { count: affected.length };
    }),
    upsert: vi.fn(async ({ where, update, create }: {
      where: { eventId_userId: { eventId: string; userId: string } };
      update: Partial<Collaboration>;
      create: Collaboration;
    }) => {
      const existing = rows.find((row) => matches(row, where.eventId_userId));
      if (existing) return Object.assign(existing, update);
      rows.push({ ...create });
      return create;
    })
  }
};

const persist = (mainHostId = "owner", coHostIds: string[] = []) => persistPartyCollaborators({
  eventId: "party", ownerId: "owner", invitedById: "owner", mainHostId, coHostIds,
  tx: tx as unknown as Prisma.TransactionClient
});
const status = (userId: string) => rows.find((row) => row.eventId === "party" && row.userId === userId)?.status;
const seed = (userId: string, collaborationStatus: PartyCollaborationStatus, eventId = "party") => rows.push({
  eventId, userId, status: collaborationStatus, role: PartyCollaboratorRole.CO_HOST, invitedById: "original-inviter"
});

beforeEach(() => {
  vi.clearAllMocks();
  rows.length = 0;
});

describe("party collaborator consent persistence", () => {
  it("accepts an owner choosing themself and leaves a newly invited co-host pending", async () => {
    await persist("owner", ["new-cohost"]);
    expect(status("owner")).toBe("ACCEPTED");
    expect(status("new-cohost")).toBe("PENDING");
    expect(rows.find((row) => row.userId === "owner")?.role).toBe("MAIN_HOST");
  });

  it("leaves an invited main host pending and accepts the owner choosing themself as co-host", async () => {
    await persist("new-main", ["owner", "new-cohost"]);
    expect(status("new-main")).toBe("PENDING");
    expect(status("new-cohost")).toBe("PENDING");
    expect(status("owner")).toBe("ACCEPTED");
    expect(rows.find((row) => row.userId === "owner")?.role).toBe("CO_HOST");
  });

  it("preserves all other users' consent states across repeated edits and role changes", async () => {
    seed("accepted", "ACCEPTED");
    seed("pending", "PENDING");
    seed("declined", "DECLINED");
    seed("removed", "REMOVED");
    for (const mainHost of ["owner", "declined", "removed", "pending", "accepted"]) {
      await persist(mainHost, ["owner", "accepted", "pending", "declined", "removed"]);
      expect(status("accepted")).toBe("ACCEPTED");
      expect(status("pending")).toBe("PENDING");
      expect(status("declined")).toBe("DECLINED");
      expect(status("removed")).toBe("REMOVED");
    }
    for (const [call] of tx.partyCollaborator.upsert.mock.calls) {
      if (call.where.eventId_userId.userId !== "owner") expect(call.update).not.toHaveProperty("status");
    }
    expect(rows.find((row) => row.userId === "accepted")?.invitedById).toBe("original-inviter");
  });

  it("removes deselected pending and accepted invites without overwriting a decline", async () => {
    seed("accepted", "ACCEPTED");
    seed("pending", "PENDING");
    seed("declined", "DECLINED");
    seed("removed", "REMOVED");
    await persist();
    expect(status("accepted")).toBe("REMOVED");
    expect(status("pending")).toBe("REMOVED");
    expect(status("declined")).toBe("DECLINED");
    expect(status("removed")).toBe("REMOVED");
    await persist("owner", ["accepted", "pending", "declined", "removed"]);
    expect(status("accepted")).toBe("REMOVED");
    expect(status("pending")).toBe("REMOVED");
    expect(status("declined")).toBe("DECLINED");
    expect(status("removed")).toBe("REMOVED");
  });

  it("preserves a response made while an ordinary edit is in flight", async () => {
    seed("pending", "PENDING");
    tx.user.findMany.mockImplementationOnce(async () => {
      rows[0].status = "DECLINED";
      return [{ id: "owner" }, { id: "pending" }];
    });
    await persist("owner", ["pending"]);
    expect(status("pending")).toBe("DECLINED");
  });

  it("allows the authenticated owner to consent to their own attribution again", async () => {
    seed("owner", "REMOVED");
    await persist();
    expect(status("owner")).toBe("ACCEPTED");
  });

  it("does not infer self-consent from owner ID when the inviter is another user", async () => {
    await persistPartyCollaborators({
      eventId: "party", ownerId: "owner", invitedById: "new-main", mainHostId: "owner", coHostIds: [],
      tx: tx as unknown as Prisma.TransactionClient
    });
    expect(status("owner")).toBe("PENDING");
  });

  it("falls back to the owner for an invalid main host and ignores invalid or duplicate co-hosts", async () => {
    await persist("missing-user", ["new-cohost", "new-cohost", "missing-user", "owner"]);
    expect(rows).toHaveLength(2);
    expect(status("owner")).toBe("ACCEPTED");
    expect(status("new-cohost")).toBe("PENDING");
    expect(tx.partyCollaborator.upsert).toHaveBeenCalledTimes(2);
  });

  it("never changes collaborators in a different party", async () => {
    seed("accepted", "ACCEPTED", "another-party");
    await persist();
    expect(rows.find((row) => row.eventId === "another-party")?.status).toBe("ACCEPTED");
  });

  it("keeps new invitations non-public while preserving the public owner's fallback", async () => {
    await persist("new-main", ["new-cohost"]);
    const host = { id: "owner", image: null, name: "Test Owner", username: "test-owner" };
    const visible = getVisiblePartyCollaborators(rows.map((row) => ({
      ...row, id: `${row.eventId}-${row.userId}`,
      user: { id: row.userId, image: null, name: row.userId, username: row.userId }
    })), host);
    expect(visible.map((row) => row.user.id)).toEqual(["owner"]);
    expect(visible[0].role).toBe("MAIN_HOST");
  });
});


describe("party guests", () => {
  it("saves valid guests as pending without duplicate host roles", async () => {
    await persistPartyCollaborators({
      eventId: "party", ownerId: "owner", invitedById: "owner", mainHostId: "owner",
      coHostIds: ["new-cohost"], guestIds: ["new-main", "new-main", "owner", "new-cohost", "unknown"],
      tx: tx as unknown as Prisma.TransactionClient
    });
    expect(rows.filter((row) => row.role === "GUEST")).toEqual([
      expect.objectContaining({ userId: "new-main", status: "PENDING" })
    ]);
    await persistPartyCollaborators({
      eventId: "party", ownerId: "owner", invitedById: "owner", mainHostId: "owner",
      coHostIds: ["new-cohost"], guestIds: [], tx: tx as unknown as Prisma.TransactionClient
    });
    expect(status("new-main")).toBe("REMOVED");
  });
});
