import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseImageCrop } from "@/lib/image-crop";
import { assertSameOrigin, enforceRequestRateLimit } from "@/lib/security/request";
import { readVerifiedImageFile } from "@/lib/security/uploads";
import { serializeUserProfile, userProfileSelect } from "@/lib/user-profile";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload an avatar." }, { status: 401 });
  }
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const limited = enforceRequestRateLimit(request, [
    { key: "upload-avatar:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `upload-avatar:user:${session.user.id}`, limit: 8, intervalMs: 60_000 }
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
      allowedTypes: ALLOWED_AVATAR_TYPES,
      maxBytes: MAX_AVATAR_BYTES
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "That image could not be uploaded." },
      { status: 400 }
    );
  }

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
