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

  if (!media || !["image/jpeg","image/png","image/webp","model/gltf-binary"].includes(media.contentType)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const bytes=new Uint8Array(media.data);
  let offset=0;
  const body=media.contentType==="model/gltf-binary"?new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.subarray(offset,offset+64*1024));offset+=64*1024;}}):new Blob([bytes],{type:media.contentType});
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(media.contentType!=="model/gltf-binary"?{"Content-Length":String(media.size)}:{}),
      "Content-Type": media.contentType,
      "X-Content-Type-Options": "nosniff",
      "Last-Modified": media.updatedAt.toUTCString()
    }
  });
}
