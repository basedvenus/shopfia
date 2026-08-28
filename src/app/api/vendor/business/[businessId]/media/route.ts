import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { businessManagerWhere } from "@/lib/businesses";
import { db } from "@/lib/db";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";
import { readVerifiedImageFile } from "@/lib/security/uploads";

export const runtime = "nodejs";

const MAX_STOREFRONT_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload storefront images." }, { status: 401 });
  }
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const limited = enforceRequestRateLimit(request, [
    { key: "upload-storefront-media:ip:{ip}", limit: 36, intervalMs: 60_000 },
    { key: `upload-storefront-media:user:${session.user.id}`, limit: 24, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const { businessId } = await params;
  const business = await db.vendorProfile.findFirst({
    where: {
      id: businessId,
      ...businessManagerWhere(session.user.id, session.user.role)
    },
    select: { id: true }
  });
  if (!business) {
    return NextResponse.json({ error: "That business could not be found." }, { status: 404 });
  }

  const formData = await request.formData() as unknown as globalThis.FormData;
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await readVerifiedImageFile(file, {
      allowedTypes: ALLOWED_IMAGE_TYPES,
      maxBytes: MAX_STOREFRONT_IMAGE_BYTES
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "That image could not be uploaded." },
      { status: 400 }
    );
  }

  const media = await db.vendorStorefrontMedia.create({
    data: {
      vendorProfileId: business.id,
      uploadedById: session.user.id,
      contentType: file.type,
      data: bytes,
      size: bytes.length
    },
    select: { id: true, updatedAt: true }
  });
  const url = `/api/vendor-media/${media.id}?v=${media.updatedAt.getTime()}`;

  return NextResponse.json({
    media: { id: media.id, url },
    path: url,
    persisted: true,
    publicUrl: url,
    url
  });
}
