import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { photoId: string } }
) {
  const photo = await db.partyPhoto.findUnique({
    where: { id: params.photoId },
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
  _request: Request,
  { params }: { params: { photoId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to remove party photos." }, { status: 401 });
  }

  const result = await db.partyPhoto.deleteMany({
    where: {
      id: params.photoId,
      userId: session.user.id,
      eventId: null
    }
  });

  return NextResponse.json({ ok: result.count > 0 });
}
