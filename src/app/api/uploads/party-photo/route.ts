import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";
import { readVerifiedImageFile } from "@/lib/security/uploads";

export const runtime = "nodejs";

const MAX_PARTY_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload party photos." }, { status: 401 });
  }
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const limited = enforceRequestRateLimit(request, [
    { key: "upload-party-photo:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `upload-party-photo:user:${session.user.id}`, limit: 18, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file");
  const crop = parseImageCrop(formData.get("crop"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await readVerifiedImageFile(file, {
      allowedTypes: ALLOWED_IMAGE_TYPES,
      maxBytes: MAX_PARTY_PHOTO_BYTES
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "That image could not be uploaded." },
      { status: 400 }
    );
  }

  const photo = await db.partyPhoto.create({
    data: {
      userId: session.user.id,
      contentType: file.type,
      data: bytes,
      size: file.size,
      crop: crop ?? Prisma.JsonNull
    },
    select: {
      id: true,
      size: true,
      updatedAt: true
    }
  });
  const url = partyPhotoUrl(photo.id, photo.updatedAt, { width: 1400 });

  return NextResponse.json({
    photo: {
      id: photo.id,
      url
    },
    publicUrl: url,
    url
  });
}
