import { PartyCollaborationStatus, PartyCollaboratorRole, type Prisma } from "@prisma/client";

// Called only after the create/edit action authenticates the event owner.
export async function persistPartyCollaborators({
  eventTitle = "a party",
  coHostIds,
  guestIds = [],
  eventId,
  invitedById,
  mainHostId,
  ownerId,
  tx
}: {
  eventTitle?: string;
  coHostIds: string[];
  guestIds?: string[];
  eventId: string;
  invitedById: string;
  mainHostId: string;
  ownerId: string;
  tx: Prisma.TransactionClient;
}) {
  const existing = await tx.partyCollaborator.findMany({ where: { eventId }, select: { userId: true, status: true } });
  const existingStatuses = new Map(existing.map((item) => [item.userId, item.status]));
  const requestedIds = Array.from(new Set([mainHostId, ...coHostIds, ...guestIds, ownerId].filter(Boolean)));
  const users = await tx.user.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true }
  });
  const validUserIds = new Set(users.map((user) => user.id));
  const safeMainHostId = validUserIds.has(mainHostId) ? mainHostId : ownerId;
  const safeCoHostIds = Array.from(new Set(coHostIds.filter((id) => id !== safeMainHostId && validUserIds.has(id))));
  const safeGuestIds = Array.from(new Set(guestIds.filter((id) => id !== safeMainHostId && !safeCoHostIds.includes(id) && validUserIds.has(id))));
  const activeUserIds = [safeMainHostId, ...safeCoHostIds, ...safeGuestIds];

  await tx.partyCollaborator.updateMany({
    where: {
      eventId,
      userId: { notIn: activeUserIds },
      status: { in: [PartyCollaborationStatus.PENDING, PartyCollaborationStatus.ACCEPTED] }
    },
    data: { status: PartyCollaborationStatus.REMOVED }
  });

  const collaborators = [
    { role: PartyCollaboratorRole.MAIN_HOST, userId: safeMainHostId },
    ...safeCoHostIds.map((userId) => ({ role: PartyCollaboratorRole.CO_HOST, userId })),
    ...safeGuestIds.map((userId) => ({ role: "GUEST" as const, userId }))
  ];

  await Promise.all(
    collaborators.map((collaborator) => {
      const isSelf = collaborator.userId === ownerId && collaborator.userId === invitedById;
      return tx.partyCollaborator.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId: collaborator.userId
          }
        },
        update: {
          role: collaborator.role,
          // Editing an event is not consent on another person's behalf.
          // Omit status entirely to preserve concurrent responses and revocations.
          ...(isSelf ? { status: PartyCollaborationStatus.ACCEPTED } : {})
        },
        create: {
          eventId,
          invitedById,
          role: collaborator.role,
          status: isSelf ? PartyCollaborationStatus.ACCEPTED : PartyCollaborationStatus.PENDING,
          userId: collaborator.userId
        }
      });
    })
  );
  const invitations = collaborators.filter((person) => person.userId !== invitedById &&
    (!existingStatuses.has(person.userId) || existingStatuses.get(person.userId) === "PENDING"));
  if (invitations.length) await tx.notification.createMany({
    data: invitations.map((person) => ({
      userId: person.userId, eventId, kind: "PARTY_INVITATION",
      title: `You were invited to ${eventTitle} as ${person.role === "GUEST" ? "a guest" : person.role === "MAIN_HOST" ? "the host" : "a co-host"}`,
      href: "/notifications#party-invitations", dedupeKey: `party-invite:${eventId}:${person.userId}`
    })), skipDuplicates: true
  });

}
