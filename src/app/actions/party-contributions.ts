"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAppleMusicPlaylist, getSpotifyPlaylist } from "@/lib/party-media";
import { resolvePartyTikTokUrl } from "@/lib/services/party-media";
import { deliverPartyNotificationEmails } from "@/lib/services/party-notifications";
import { checkServerActionRateLimit } from "@/lib/security/request";

const schema = z.object({
  eventId: z.string().cuid(),
  kind: z.enum(["PHOTO", "TIKTOK", "PLAYLIST"]),
  photoId: z.string().cuid().optional(),
  url: z.string().trim().max(2048).optional()
});

export async function submitPartyContributionAction(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to contribute." };
  const userId = session.user.id;
  const limited = await checkServerActionRateLimit([{ key: `party-contribution:${userId}`, limit: 12, intervalMs: 60_000 }]);
  if (!limited.ok) return { ok: false, error: "Please wait a minute before submitting again." };
  const parsed = schema.safeParse({ eventId: form.get("eventId"), kind: form.get("kind"), photoId: form.get("photoId") || undefined, url: form.get("url") || undefined });
  if (!parsed.success) return { ok: false, error: "Choose a photo, TikTok video, or public Apple Music playlist." };
  const input = parsed.data;
  let tiktokUrl: string | null = null;
  let appleMusicUrl: string | null = null;
  let spotifyUrl: string | null = null;
  // Check membership before resolving a third-party share link.
  const membership = await db.partyCollaborator.findFirst({ where: { eventId: input.eventId, userId, status: "ACCEPTED" }, select: { id: true } });
  if (!membership) return { ok: false, error: "Accept your party invitation before contributing." };
  if (input.kind === "TIKTOK") {
    try { tiktokUrl = await resolvePartyTikTokUrl(input.url); } catch { return { ok: false, error: "Paste a public TikTok video link." }; }
    if (!tiktokUrl) return { ok: false, error: "Paste a public TikTok video link." };
  }
  if (input.kind === "PLAYLIST") {
    appleMusicUrl = getAppleMusicPlaylist(input.url)?.url ?? null;
    spotifyUrl = getSpotifyPlaylist(input.url)?.url ?? null;
    if (!appleMusicUrl && !spotifyUrl) return { ok: false, error: "Paste a public Apple Music or Spotify playlist link." };
  }
  if (input.kind === "PHOTO" && !input.photoId) return { ok: false, error: "Upload a photo first." };
  try {
    await db.$transaction(async (tx) => {
      // Lock the invitation against concurrent removal during submission.
      const member = await tx.partyCollaborator.updateMany({ where: { eventId: input.eventId, userId, status: "ACCEPTED" }, data: { updatedAt: new Date() } });
      if (!member.count) throw new Error("Your party invitation is no longer active.");
      const event = await tx.partyEvent.findUnique({ where: { id: input.eventId }, select: { userId: true, slug: true, title: true } });
      if (!event) throw new Error("This party is no longer available.");
      const pendingCount = await tx.partyContribution.count({ where: { eventId: input.eventId, userId, status: "PENDING" } });
      if (pendingCount >= 16) throw new Error("You already have 16 submissions awaiting review.");
      if (input.kind === "PHOTO") {
        const photo = await tx.partyPhoto.findFirst({ where: { id: input.photoId, userId, eventId: null, contribution: null }, select: { id: true } });
        if (!photo) throw new Error("Choose one of your own newly uploaded photos.");
      }
      const contribution = await tx.partyContribution.create({ data: { eventId: input.eventId, userId, kind: input.kind, photoId: input.kind === "PHOTO" ? input.photoId : null, tiktokUrl, appleMusicUrl, spotifyUrl } });
      await tx.notification.create({ data: { userId: event.userId, eventId: input.eventId, kind: "PARTY_REVIEW", title: `A guest submitted ${input.kind === "PHOTO" ? "a photo" : input.kind === "TIKTOK" ? "a TikTok" : "a playlist"} to ${event.title}`, href: `/events/${event.slug}#party-contributions`, dedupeKey: `party-review:${contribution.id}` } });
    });
  } catch (error) {
    // Duplicate photo submissions are rejected by the unique photoId constraint.
    return { ok: false, error: error instanceof Error && !error.message.includes("\n") ? error.message : "Could not submit this item. It may already be awaiting review." };
  }
  await deliverPartyNotificationEmails(input.eventId).catch(() => undefined);
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/notifications");
  return { ok: true };
}

export async function reviewPartyContributionAction(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to review submissions." };
  const userId = session.user.id;
  const parsed = z.object({ id: z.string().cuid(), decision: z.enum(["APPROVED", "REJECTED"]) }).safeParse({ id: form.get("contributionId"), decision: form.get("decision") });
  if (!parsed.success) return { ok: false, error: "Choose approve or decline." };
  const limited = await checkServerActionRateLimit([{ key: `party-review:${userId}`, limit: 30, intervalMs: 60_000 }]);
  if (!limited.ok) return { ok: false, error: "Please wait before reviewing more submissions." };
  try {
    const eventId = await db.$transaction(async (tx) => {
      const item = await tx.partyContribution.findFirst({ where: { id: parsed.data.id, status: "PENDING", event: { userId } }, include: { event: { select: { id: true, slug: true, title: true } } } });
      if (!item) throw new Error("This submission is no longer available for review.");
      const claimed = await tx.partyContribution.updateMany({ where: { id: item.id, status: "PENDING", event: { userId } }, data: { status: parsed.data.decision, reviewedAt: new Date() } });
      if (!claimed.count) throw new Error("This submission has already been reviewed.");
      if (parsed.data.decision === "APPROVED") {
        const member = await tx.partyCollaborator.updateMany({ where: { eventId: item.eventId, userId: item.userId, status: "ACCEPTED" }, data: { updatedAt: new Date() } });
        if (!member.count) throw new Error("This guest is no longer part of the party.");
        if (item.kind === "PHOTO") {
          // Serializes competing approvals and host edits on the party row.
          await tx.partyEvent.update({ where: { id: item.eventId }, data: { updatedAt: new Date() } });
          const count = await tx.partyPhoto.count({ where: { eventId: item.eventId } });
          if (count >= 16) throw new Error("This party has 16 photos. Remove a photo before approving another.");
          const last = await tx.partyPhoto.aggregate({ where: { eventId: item.eventId }, _max: { sortOrder: true } });
          const photo = await tx.partyPhoto.updateMany({ where: { id: item.photoId ?? "", userId: item.userId, eventId: null }, data: { eventId: item.eventId, userId, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
          if (!photo.count) throw new Error("The submitted photo is no longer available.");
        }
      }
      await tx.notification.create({ data: { userId: item.userId, eventId: item.eventId, kind: "PARTY_REVIEW_RESULT", title: `Your ${item.kind === "PHOTO" ? "photo" : item.kind === "TIKTOK" ? "TikTok" : "playlist"} for ${item.event.title} was ${parsed.data.decision === "APPROVED" ? "approved" : "declined"}`, href: `/events/${item.event.slug}#party-contributions`, dedupeKey: `party-result:${item.id}` } });
      await tx.notification.updateMany({ where: { dedupeKey: `party-review:${item.id}`, userId }, data: { readAt: new Date() } });
      return item.eventId;
    });
    await deliverPartyNotificationEmails(eventId).catch(() => undefined);
  } catch (error) {
    return { ok: false, error: error instanceof Error && !error.message.includes("\n") ? error.message : "Could not review this submission. Please try again." };
  }
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/notifications");
  return { ok: true };
}
