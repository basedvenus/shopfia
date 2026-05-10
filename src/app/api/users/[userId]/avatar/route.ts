import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const avatar = await db.userAvatar.findUnique({
    where: { userId: params.userId },
    select: {
      contentType: true,
      data: true,
      size: true,
      updatedAt: true
    }
  });

  if (!avatar) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  const body = new Blob([new Uint8Array(avatar.data)], {
    type: avatar.contentType
  });

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(avatar.size),
      "Content-Type": avatar.contentType,
      "Last-Modified": avatar.updatedAt.toUTCString()
    }
  });
}
