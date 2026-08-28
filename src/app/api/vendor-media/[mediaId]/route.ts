import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const limited = enforceRequestRateLimit(request, [
    { key: "vendor-media-read:ip:{ip}", limit: 360, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const { mediaId } = await params;
  const media = await db.vendorStorefrontMedia.findUnique({
    where: { id: mediaId },
    select: {
      contentType: true,
      data: true,
      size: true,
      updatedAt: true
    }
  });

  if (!media) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  return new Response(new Blob([new Uint8Array(media.data)], { type: media.contentType }), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(media.size),
      "Content-Type": media.contentType,
      "Last-Modified": media.updatedAt.toUTCString()
    }
  });
}
