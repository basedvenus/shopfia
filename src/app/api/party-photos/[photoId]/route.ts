import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";

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
      contentType: true,
      data: true,
      size: true,
      updatedAt: true
    }
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
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
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(optimized.byteLength),
        "Content-Type": "image/webp",
        "Last-Modified": photo.updatedAt.toUTCString()
      }
    });
  }

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(photo.size),
      "Content-Type": photo.contentType,
      "Last-Modified": photo.updatedAt.toUTCString()
    }
  });
}

function parseImageWidth(value: string | null) {
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
