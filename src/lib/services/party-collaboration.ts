import { PartyCollaborationStatus, PartyCollaboratorRole, type Prisma } from "@prisma/client";

// Called only after the create/edit action authenticates the event owner.
export async function persistPartyCollaborators({
  coHostIds,
  eventId,
  invitedById,
  mainHostId,
  ownerId,
  tx
}: {
  coHostIds: string[];
  eventId: string;
  invitedById: string;
  mainHostId: string;
  ownerId: string;
  tx: Prisma.TransactionClient;
}) {
  const requestedIds = Array.from(new Set([mainHostId, ...coHostIds, ownerId].filter(Boolean)));
  const users = await tx.user.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true }
  });
  const validUserIds = new Set(users.map((user) => user.id));
  const safeMainHostId = validUserIds.has(mainHostId) ? mainHostId : ownerId;
  const safeCoHostIds = Array.from(new Set(coHostIds.filter((id) => id !== safeMainHostId && validUserIds.has(id))));
  const activeUserIds = [safeMainHostId, ...safeCoHostIds];

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
    ...safeCoHostIds.map((userId) => ({ role: PartyCollaboratorRole.CO_HOST, userId }))
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
}
