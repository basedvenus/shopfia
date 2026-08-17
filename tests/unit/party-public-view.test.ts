import { describe, expect, it } from "vitest";
import {
  canShowPartyManagementLinks,
  getPartyDescriptionForViewer,
  getVisiblePartyCollaborators
} from "@/lib/party-public-view";

describe("party public view privacy", () => {
  it("hides owner-only empty-state copy and management links from public visitors", () => {
    expect(
      getPartyDescriptionForViewer({
        eventDescription: null,
        fallbackDescription: null,
        isOwner: false
      })
    ).toBeNull();
    expect(canShowPartyManagementLinks(false, true)).toBe(false);
  });

  it("shows owner-only empty-state copy and management links to the party owner", () => {
    expect(
      getPartyDescriptionForViewer({
        eventDescription: null,
        fallbackDescription: null,
        isOwner: true
      })
    ).toBe("This party is still being filled in.");
    expect(canShowPartyManagementLinks(true, true)).toBe(true);
  });

  it("only exposes accepted collaborators publicly", () => {
    const collaborators = getVisiblePartyCollaborators(
      [
        makeCollaborator("cohost_pending", "CO_HOST", "PENDING"),
        makeCollaborator("cohost_accepted", "CO_HOST", "ACCEPTED"),
        makeCollaborator("cohost_declined", "CO_HOST", "DECLINED")
      ],
      makeHost()
    );

    expect(collaborators).toHaveLength(1);
    expect(collaborators[0]?.user.id).toBe("cohost_accepted");
  });
});

function makeCollaborator(userId: string, role: string, status: string) {
  return {
    id: `${userId}_collaboration`,
    role,
    status,
    user: {
      id: userId,
      image: null,
      name: userId,
      username: userId
    }
  };
}

function makeHost() {
  return {
    id: "host_1",
    image: null,
    name: "Host",
    username: "host"
  };
}
