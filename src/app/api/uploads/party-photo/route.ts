import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_PARTY_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload party photos." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP, or GIF image." },
      { status: 400 }
    );
  }

  if (file.size > MAX_PARTY_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "That image is too large. Choose a photo under 10MB." },
      { status: 400 }
    );
  }

  const photo = await db.partyPhoto.create({
    data: {
      userId: session.user.id,
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      size: file.size
    },
    select: {
      id: true,
      size: true,
      updatedAt: true
    }
  });
  const url = `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`;

  console.log("[party] photo upload succeeded", {
    photoId: photo.id,
    publicUrl: url,
    size: photo.size
  });

  return NextResponse.json({
    photo: {
      id: photo.id,
      url
    },
    publicUrl: url,
    url
  });
}
