import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    partyEvent: { findFirst: vi.fn(), findMany: vi.fn() },
    partyCollaborator: { findMany: vi.fn(), findFirst: vi.fn() },
    vendorProfile: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    notification: { findMany: vi.fn() },
    follow: { findUnique: vi.fn() }
  }
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/app/actions/auth", () => ({ toggleFollowAction: vi.fn() }));
vi.mock("@/components/parties/party-event-form", () => ({ PartyEventForm: () => null }));
vi.mock("@/components/parties/party-invitation-response", () => ({ PartyInvitationResponse: () => null }));
vi.mock("@/lib/profile-badges", () => ({ getOriginalMemberCutoffDate: async () => null, getProfileBadge: () => null }));

import EventPage from "@/app/events/[slug]/page";
vi.mock("@/app/actions/notifications", () => ({ markNotificationsReadAction: vi.fn(), updatePartyNotificationPreferenceAction: vi.fn() }));
vi.mock("@/lib/auth/provider-config", () => ({ authProviderConfig: { emailEnabled: false } }));
import NotificationsPage from "@/app/notifications/page";
import MyPartiesPage from "@/app/my-parties/page";
import { PartyEventForm } from "@/components/parties/party-event-form";
import { PartyInvitationResponse } from "@/components/parties/party-invitation-response";

function elements(node: ReactNode): Array<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

const host = { id: "owner", name: "Test Owner", username: "test-owner", image: null, email: null, createdAt: new Date("2026-01-01") };
const event = {
  id: "party", userId: "owner", user: host, slug: "test-party", title: "Test Party", theme: null,
  tags: [], description: null, eventDate: null, partyfulUrl: null, location: null,
  formattedAddress: null, city: null, state: null, zipCode: null, locationLat: null, locationLng: null,
  googlePlaceId: null, coverImageUrl: null, imageUrls: [], photos: [], taggedVendors: [], collaborators: [], vendorRatings: []
};
const invitations = [
  { id: "pending-main", userId: "recipient", role: "MAIN_HOST", status: "PENDING" },
  { id: "pending-cohost", userId: "cohost", role: "CO_HOST", status: "PENDING" },
  { id: "accepted-cohost", userId: "accepted", role: "CO_HOST", status: "ACCEPTED" },
  { id: "accepted-owner", userId: "owner", role: "MAIN_HOST", status: "ACCEPTED" },
  { id: "declined-cohost", userId: "recipient", role: "CO_HOST", status: "DECLINED" },
  { id: "removed-cohost", userId: "recipient", role: "CO_HOST", status: "REMOVED" }
].map((row) => ({ ...row, eventId: event.id, event: { title: event.title, slug: event.slug } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.db.partyEvent.findFirst.mockResolvedValue(event);
  mocks.db.partyEvent.findMany.mockImplementation(async ({ where }) => where.userId === event.userId ? [event] : []);
  mocks.db.vendorProfile.findMany.mockResolvedValue([]);
  mocks.db.user.findMany.mockResolvedValue([]);
  mocks.db.user.findUnique.mockResolvedValue({ partyEmailNotifications: false });
  mocks.db.notification.findMany.mockResolvedValue([]);
  mocks.db.follow.findUnique.mockResolvedValue(null);
  mocks.db.partyCollaborator.findFirst.mockResolvedValue(null);
  mocks.db.partyCollaborator.findMany.mockImplementation(async ({ where }) => {
    if (where.eventId) {
      if (where.eventId !== event.id || where.event.userId !== event.userId) return [];
      if (typeof where.status === "string") return invitations.filter((row) => row.status === where.status && row.role === where.role).map((row) => ({ id: row.id, user: { name: row.userId, username: row.userId } }));
      return invitations.filter((row) => where.status.in.includes(row.status)).map(({ userId, role }) => ({ userId, role }));
    }
    if (where.event?.userId?.not === event.userId) return [];
    return invitations.filter((row) => row.userId === where.userId && row.status === where.status)
      .map(({ id, role, event: invitationEvent }) => ({ id, role, event: invitationEvent }));
  });
});

describe("owner editor collaborator selection", () => {
  it("retains pending and accepted invitations in owner-only editor defaults", async () => {
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }), searchParams: Promise.resolve({ edit: "1" }) });
    expect(mocks.db.partyCollaborator.findMany).toHaveBeenCalledWith({
      where: { eventId: event.id, event: { userId: "owner" }, status: { in: ["PENDING", "ACCEPTED"] } },
      select: { userId: true, role: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });
    const form = elements(page).find((node) => node.type === PartyEventForm);
    expect(form?.props.currentUserId).toBe("owner");
    expect(form?.props.initialParty).toMatchObject({ mainHostId: "recipient", coHostIds: ["cohost", "accepted"] });
    expect(mocks.db.partyEvent.findFirst.mock.calls[0][0].include.collaborators.where).toEqual({ status: "ACCEPTED" });
  });

  it("uses the owner's host fallback when there are no active main-host invitations", async () => {
    mocks.db.partyCollaborator.findMany.mockResolvedValue([{ userId: "cohost", role: "CO_HOST" }]);
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }), searchParams: Promise.resolve({ edit: "1" }) });
    const form = elements(page).find((node) => node.type === PartyEventForm);
    expect(form?.props.initialParty).toMatchObject({ mainHostId: "owner", coHostIds: ["cohost"] });
  });

  it.each([null, "recipient", "accepted", "unrelated"])("never loads or renders private edit defaults for %s", async (userId) => {
    mocks.auth.mockResolvedValue(userId ? { user: { id: userId } } : null);
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }), searchParams: Promise.resolve({ edit: "1" }) });
    expect(mocks.db.partyCollaborator.findMany).not.toHaveBeenCalled();
    expect(elements(page).some((node) => node.type === PartyEventForm)).toBe(false);
    expect(mocks.db.partyEvent.findFirst.mock.calls[0][0].include.collaborators.where).toEqual({ status: "ACCEPTED" });
    const publicText = elements(page).flatMap((node) =>
      Object.values(node.props).filter((value) => typeof value === "string")
    ).join("\n");
    expect(publicText).not.toContain("pending-main");
    expect(publicText).not.toContain("pending-cohost");
  });

  it("organizes the mobile overview with one host row and collapsed pending invitations", async () => {
    mocks.db.partyEvent.findFirst.mockResolvedValue({ ...event, title: "The best three years of our life !!", location: "4710 Natomas Blvd Ste 190, Sacramento, CA 95835, USA", eventDate: new Date("2025-11-01"), tags: ["kidsbirthday"], coverImageUrl: "/demo/fairfield-lemon-tablescape.png" });
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }) });
    const overview = elements(page).find((node) => node.props["aria-label"] === "Party overview")!;
    const html = renderToStaticMarkup(overview);
    expect(html).toContain("Hosted by");
    expect(html).not.toContain("Posted by");
    expect(html).toContain("Kids’ Birthday");
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
    expect(html).not.toContain('aria-label="Edit party and photos"');
    expect(html.match(/>Edit party</g)).toHaveLength(1);
    if (process.env.PARTY_HEADER_PREVIEW_OUTPUT) {
      mkdirSync(path.dirname(process.env.PARTY_HEADER_PREVIEW_OUTPUT), { recursive: true });
      writeFileSync(process.env.PARTY_HEADER_PREVIEW_OUTPUT, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body style="font-family:Arial,sans-serif"><main class="container py-6">${html}</main></body></html>`);
    }
  });

  it("shows a pending co-host status only to the event owner viewing their header", async () => {
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }) });
    expect(mocks.db.partyCollaborator.findMany).toHaveBeenCalledWith({
      where: { eventId: event.id, event: { userId: "owner" }, role: "CO_HOST", status: "PENDING" },
      select: { id: true, user: { select: { name: true, username: true } } },
      orderBy: { createdAt: "asc" }
    });
    expect(elements(page).some((node) => node.props["aria-label"] === "Pending co-host invitations")).toBe(true);
  });
});

describe("invitation on its party page", () => {
  it.each(["GUEST", "CO_HOST"])("offers the invited %s a response on the party itself", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "recipient" } });
    mocks.db.partyCollaborator.findFirst.mockResolvedValue({ id: "my-invite", role });
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }) });
    expect(mocks.db.partyCollaborator.findFirst).toHaveBeenCalledWith({
      where: { eventId: "party", userId: "recipient", status: "PENDING", role: { in: ["GUEST", "CO_HOST"] } },
      select: { id: true, role: true }
    });
    expect(elements(page).find((node) => node.type === PartyInvitationResponse)?.props.collaborationId).toBe("my-invite");
    expect(elements(page).some((node) => node.props["aria-label"] === "Your party invitation")).toBe(true);
  });
  it.each(["accepted", "unrelated", "declined", "removed"])("has no invitation prompt for %s visitors", async (userId) => {
    mocks.auth.mockResolvedValue({ user: { id: userId } });
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }) });
    expect(elements(page).some((node) => node.type === PartyInvitationResponse)).toBe(false);
  });
  it.each([null, "owner"])("never loads a response for %s", async (userId) => {
    mocks.auth.mockResolvedValue(userId ? { user: { id: userId } } : null);
    const page = await EventPage({ params: Promise.resolve({ slug: event.slug }) });
    expect(mocks.db.partyCollaborator.findFirst).not.toHaveBeenCalled();
    expect(elements(page).some((node) => node.type === PartyInvitationResponse)).toBe(false);
  });
});

describe("private Notifications invitation inbox", () => {
  it("shows pending invitations only on Notifications, outside the upload form", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "recipient" } });
    const composer = await MyPartiesPage();
    expect(elements(composer).filter((node) => node.type === PartyInvitationResponse)).toHaveLength(0);
    expect(mocks.db.partyCollaborator.findMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "recipient", status: "PENDING" } }));
    const page = await NotificationsPage();
    expect(mocks.db.partyCollaborator.findMany).toHaveBeenCalledWith({
      where: { userId: "recipient", status: "PENDING" },
      select: { id: true, role: true, event: { select: { title: true, slug: true } } },
      orderBy: { createdAt: "desc" }
    });
    const responses = elements(page).filter((node) => node.type === PartyInvitationResponse);
    expect(responses.map((node) => node.props.collaborationId)).toEqual(["pending-main"]);
    expect(mocks.db.partyEvent.findMany.mock.calls[0][0].where).toEqual({ userId: "recipient" });
  });

  it("keeps the owner's parties and editor links without exposing others' invitation responses", async () => {
    const page = await MyPartiesPage();
    const nodes = elements(page);
    expect(mocks.db.partyEvent.findMany.mock.calls[0][0].where).toEqual({ userId: "owner" });
    expect(nodes.some((node) => node.props.href === "/events/test-party?edit=1")).toBe(true);
    expect(nodes.filter((node) => node.type === PartyInvitationResponse)).toHaveLength(0);
    expect(mocks.db.partyCollaborator.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "owner", status: "ACCEPTED", event: { userId: { not: "owner" } } }
    }));
  });

  it("gives an accepted recipient a Leave control only for their own non-owned collaboration", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "accepted" } });
    const page = await MyPartiesPage();
    const responses = elements(page).filter((node) => node.type === PartyInvitationResponse);
    expect(responses.map((node) => node.props)).toEqual([{ collaborationId: "accepted-cohost", mode: "accepted" }]);
    expect(mocks.db.partyCollaborator.findMany).toHaveBeenCalledWith({
      where: { userId: "accepted", status: "ACCEPTED", event: { userId: { not: "accepted" } } },
      select: { id: true, role: true, event: { select: { title: true, slug: true } } },
      orderBy: { createdAt: "desc" }
    });
    expect(elements(page).some((node) => node.props.href === "/events/test-party?edit=1")).toBe(false);
  });

  it("does not keep withdrawn or declined invitations in the accepted-host section", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "recipient" } });
    const page = await MyPartiesPage();
    const responses = elements(page).filter((node) => node.type === PartyInvitationResponse);
    expect(responses.some((node) => node.props.mode === "accepted")).toBe(false);
    expect(responses).toHaveLength(0);
  });

  it("does not read any invitation or owned-event data for anonymous visitors", async () => {
    mocks.auth.mockResolvedValue(null);
    const page = await MyPartiesPage();
    expect(mocks.db.partyCollaborator.findMany).not.toHaveBeenCalled();
    expect(mocks.db.partyEvent.findMany).not.toHaveBeenCalled();
    expect(elements(page).filter((node) => node.type === PartyInvitationResponse)).toHaveLength(0);
  });
});
