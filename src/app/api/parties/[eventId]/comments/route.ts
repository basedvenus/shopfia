import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const userSelect = { id: true, name: true, username: true } as const;
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
  return NextResponse.json({ comments: comments.reverse() }, { headers: { "Cache-Control": "private, no-store" } });
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
  const event = await db.partyEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Party not found." }, { status: 404 });
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await db.partyComment.findFirst({ where: { id: parsed.data.parentId, eventId }, select: { id: true, parentId: true } });
    if (!parent) return NextResponse.json({ error: "That comment is no longer available." }, { status: 400 });
    parentId = parent.parentId ?? parent.id;
  }
  const comment = await db.partyComment.create({ data: { eventId, userId: session.user.id, body: parsed.data.body, parentId }, include: { user: { select: userSelect } } });
  return NextResponse.json({ comment }, { status: 201 });
}
