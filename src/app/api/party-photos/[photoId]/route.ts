import { NextResponse } from "next/server";
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

  return new Response(
    new Blob([new Uint8Array(photo.data)], { type: photo.contentType }),
    {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(photo.size),
        "Content-Type": photo.contentType,
        "Last-Modified": photo.updatedAt.toUTCString()
      }
    }
  );
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
