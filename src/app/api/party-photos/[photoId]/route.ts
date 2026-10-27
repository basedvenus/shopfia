import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";
import { renderPartyPhoto } from "@/lib/render-party-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;
  const limited = enforceRequestRateLimit(request, [
    { key: "party-photo-read:ip:{ip}", limit: 240, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const photo = await db.partyPhoto.findUnique({
    where: { id: photoId },
    select: {
      contribution: { select: { status: true, event: { select: { userId: true } } } },
      contentType: true,
      crop: true,
      data: true,
      eventId: true,
      size: true,
      updatedAt: true,
      userId: true
    }
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  // Uploaded drafts are private until their owner attaches them to a public party.
  const isDraft = photo.eventId === null;
  const editing = new URL(request.url).searchParams.get("edit") === "1";
  if (isDraft || editing) {
    const session = await auth();
    if (!session?.user?.id || (session.user.id !== photo.userId && (editing || !(photo.contribution?.status === "PENDING" && photo.contribution.event.userId === session.user.id)))) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
  }
  const cacheControl = "private, no-store";

  if (!editing) {
    const rendered = await renderPartyPhoto(Buffer.from(photo.data), photo.crop, parseImageWidth(new URL(request.url).searchParams.get("w")) ?? 2400);
    return new Response(new Uint8Array(rendered), { headers: {
      "Cache-Control": cacheControl, "Content-Type": "image/webp", "Content-Length": String(rendered.byteLength),
      "Last-Modified": photo.updatedAt.toUTCString()
    } });
  }

  const width = parseImageWidth(new URL(request.url).searchParams.get("w"));
  if (width && photo.contentType !== "image/gif") {
    const optimized = await sharp(Buffer.from(photo.data))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    return new Response(new Uint8Array(optimized), {
      headers: {
        "Cache-Control": cacheControl,
        "Content-Length": String(optimized.byteLength),
        "Content-Type": "image/webp",
        "Last-Modified": photo.updatedAt.toUTCString()
      }
    });
  }

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Cache-Control": cacheControl,
      "Content-Length": String(photo.size),
      "Content-Type": photo.contentType,
      "Last-Modified": photo.updatedAt.toUTCString()
    }
  });
}

function parseImageWidth(value: string | null) {
  if (!value?.trim()) return null;
  const width = Number(value);
  if (!Number.isFinite(width)) return null;
  return Math.min(Math.max(Math.round(width), 96), 2400);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to remove party photos." }, { status: 401 });
  }
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const limited = enforceRequestRateLimit(request, [
    { key: "party-photo-delete:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `party-photo-delete:user:${session.user.id}`, limit: 20, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const result = await db.partyPhoto.deleteMany({
    where: {
      id: photoId,
      userId: session.user.id,
      eventId: null
    }
  });

  return NextResponse.json({ ok: result.count > 0 });
}
