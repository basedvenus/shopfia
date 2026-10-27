import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { deliverPartyNotificationEmails } from "@/lib/services/party-notifications";
import { getUserProfileImage } from "@/lib/profile-image";
import { normalizeImageCrop } from "@/lib/image-crop";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const userSelect = { id: true, name: true, username: true, image: true, imageCrop: true, avatar: { select: { updatedAt: true } } } as const;
function publicUser(user: { id: string; name: string | null; username: string | null; image: string | null; imageCrop: unknown; avatar: { updatedAt: Date } | null }) {
  return { id: user.id, name: user.name, username: user.username, image: getUserProfileImage(user), imageCrop: normalizeImageCrop(user.imageCrop) };
}
const payloadSchema = z.object({ body: z.string().trim().min(1).max(1000), parentId: z.string().cuid().nullable().optional() });
type Context = { params: Promise<{ eventId: string }> };

export async function GET(request: Request, context: Context) {
  const { eventId } = await context.params;
  const limited = enforceRequestRateLimit(request, [{ key: "party-comments-read:ip:{ip}", limit: 120, intervalMs: 60_000 }]);
  if (limited) return limited;
  const event = await db.partyEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Party not found." }, { status: 404 });
  const comments = await db.partyComment.findMany({
    where: { eventId, parentId: null }, orderBy: { createdAt: "desc" }, take: 50,
    include: { user: { select: userSelect }, replies: { orderBy: { createdAt: "asc" }, take: 100, include: { user: { select: userSelect } } } }
  });
  return NextResponse.json({ comments: comments.reverse().map((comment) => ({ ...comment, user: publicUser(comment.user), replies: comment.replies.map((reply) => ({ ...reply, user: publicUser(reply.user) })) })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to join the conversation." }, { status: 401 });
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const limited = enforceRequestRateLimit(request, [
    { key: "party-comments-write:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `party-comments-write:user:${session.user.id}`, limit: 10, intervalMs: 60_000 }
  ]);
  if (limited) return limited;
  const { eventId } = await context.params;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a comment of up to 1,000 characters." }, { status: 400 });
  const event = await db.partyEvent.findUnique({ where: { id: eventId }, select: { id: true, userId: true, slug: true, title: true } });
  if (!event) return NextResponse.json({ error: "Party not found." }, { status: 404 });
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await db.partyComment.findFirst({ where: { id: parsed.data.parentId, eventId }, select: { id: true, parentId: true } });
    if (!parent) return NextResponse.json({ error: "That comment is no longer available." }, { status: 400 });
    parentId = parent.parentId ?? parent.id;
  }
  const authorId = session.user.id;
  const comment = await db.$transaction(async (tx) => {
    const saved = await tx.partyComment.create({ data: { eventId, userId: authorId, body: parsed.data.body, parentId }, include: { user: { select: userSelect } } });
    if (event.userId !== authorId) {
      await tx.notification.create({ data: {
        userId: event.userId, eventId, kind: "PARTY_COMMENT",
        title: `${saved.user.name ?? saved.user.username ?? "Someone"} commented on ${event.title}`,
        href: `/events/${event.slug}#party-comments`, dedupeKey: `party-comment:${saved.id}:host`
      } });
    }
    return saved;
  });
  await deliverPartyNotificationEmails(eventId, event.userId).catch(() => undefined);
  return NextResponse.json({ comment: { ...comment, user: publicUser(comment.user) } }, { status: 201 });
}
