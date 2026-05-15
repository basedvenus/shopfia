import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseImageCrop } from "@/lib/image-crop";
import { serializeUserProfile, userProfileSelect } from "@/lib/user-profile";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload an avatar." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const crop = parseImageCrop(formData.get("crop"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP, or GIF image." },
      { status: 400 }
    );
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { error: "That image is too large. Choose a photo under 8MB." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await db.$transaction(async (tx) => {
    const avatar = await tx.userAvatar.upsert({
      where: { userId: session.user.id },
      update: {
        contentType: file.type,
        data: bytes,
        size: file.size
      },
      create: {
        userId: session.user.id,
        contentType: file.type,
        data: bytes,
        size: file.size
      },
      select: {
        id: true,
        updatedAt: true
      }
    });
    const url = `/api/users/${session.user.id}/avatar?v=${avatar.updatedAt.getTime()}`;
    const updatedUser = await tx.user.update({
      where: { id: session.user.id },
      data: { image: url, imageCrop: crop ?? Prisma.JsonNull },
      select: userProfileSelect
    });
    const savedUser = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { image: true }
    });

    return {
      avatarId: avatar.id,
      persisted: savedUser?.image === url,
      profile: serializeUserProfile(updatedUser),
      savedImage: savedUser?.image ?? null,
      url
    };
  });

  console.log("[profile] avatar upload succeeded", {
    avatarId: result.avatarId,
    size: file.size,
    type: file.type,
    storagePath: `UserAvatar:${result.avatarId}`,
    returnedPath: result.url,
    publicUrl: result.url,
    url: result.url
  });

  console.log("[profile] avatar persistence check", {
    currentAvatarUrl: result.savedImage,
    expectedAvatarUrl: result.url,
    persisted: result.persisted
  });

  revalidatePath("/", "layout");
  revalidatePath("/account");
  if (result.profile.username) {
    revalidatePath(`/profiles/${result.profile.username}`);
  }

  return NextResponse.json({
    path: result.url,
    profile: result.profile,
    publicUrl: result.url,
    url: result.url,
    persisted: result.persisted
  });
}
