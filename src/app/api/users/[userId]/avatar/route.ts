import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const limited = enforceRequestRateLimit(request, [
    { key: "avatar-read:ip:{ip}", limit: 240, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const avatar = await db.userAvatar.findUnique({
    where: { userId },
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
