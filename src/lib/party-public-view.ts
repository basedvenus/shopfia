type PartyCollaboratorForVisibility = {
  id: string;
  role: string;
  status: string;
  user: { id: string; image: string | null; name: string | null; username: string | null };
};

type PartyHostForVisibility = {
  id: string;
  image: string | null;
  name: string | null;
  username: string | null;
};

export function getPartyDescriptionForViewer({
  eventDescription,
  fallbackDescription,
  isOwner
}: {
  eventDescription?: string | null;
  fallbackDescription?: string | null;
  isOwner: boolean;
}) {
  return eventDescription ?? fallbackDescription ?? (isOwner ? "This party is still being filled in." : null);
}

export function canShowPartyManagementLinks(isOwner: boolean, hasEvent: boolean) {
  return isOwner && hasEvent;
}

export function getVisiblePartyCollaborators(
  collaborators: PartyCollaboratorForVisibility[],
  host: PartyHostForVisibility | null
) {
  const accepted = collaborators.filter((collaborator) => collaborator.status === "ACCEPTED");

  if (accepted.length > 0) {
    return [...accepted].sort((left, right) => {
      if (left.role === "MAIN_HOST" && right.role !== "MAIN_HOST") return -1;
      if (right.role === "MAIN_HOST" && left.role !== "MAIN_HOST") return 1;
      return 0;
    });
  }

  return host
    ? [
        {
          id: "host",
          role: "MAIN_HOST",
          status: "ACCEPTED",
          user: {
            id: host.id,
            image: host.image,
            name: host.name,
            username: host.username
          }
        }
      ]
    : [];
}
