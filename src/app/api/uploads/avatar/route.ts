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
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

  const formData = await request.formData() as unknown as globalThis.FormData;
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

  let result: {
    avatarId: string;
    persisted: boolean;
    profile: ReturnType<typeof serializeUserProfile>;
    savedImage: string | null;
    url: string;
  };
  try {
    result = await db.$transaction(async (tx) => {
      const avatar = await tx.userAvatar.upsert({
        where: { userId: session.user.id },
        update: {
          contentType: file.type,
          data: bytes,
          size: bytes.length
        },
        create: {
          userId: session.user.id,
          contentType: file.type,
          data: bytes,
          size: bytes.length
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
  } catch (error) {
    console.error("ShopFia avatar upload persistence failed", error);
    return NextResponse.json(
      { error: "That image could not be saved. Please retry the upload." },
      { status: 500 }
    );
  }

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

// Cropping an existing photo must persist immediately, just like a new upload.
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({error:"Sign in to change your photo."}, {status:401});
  if (!assertSameOrigin(request)) return NextResponse.json({error:"Invalid origin."}, {status:403});
  const limited = enforceRequestRateLimit(request, [{key:`crop-avatar:user:${session.user.id}`,limit:20,intervalMs:60_000}]);
  if (limited) return limited;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.image !== "string" || !body.crop ||
      ![body.crop.x,body.crop.y,body.crop.zoom].every(value => typeof value === "number" && Number.isFinite(value)) ||
      body.crop.x < 0 || body.crop.x > 100 || body.crop.y < 0 || body.crop.y > 100 || body.crop.zoom < 1 || body.crop.zoom > 3) {
    return NextResponse.json({error:"Choose a valid profile crop."},{status:400});
  }
  const crop = {x:body.crop.x,y:body.crop.y,zoom:body.crop.zoom,brightness:1,saturation:1,aspectRatio:1};
  try {
    const saved = await db.$transaction(async tx => {
      const existing = await tx.user.findUnique({where:{id:session.user.id},select:userProfileSelect});
      if (!existing || serializeUserProfile(existing).image !== body.image) return null;
      const result = await tx.user.updateMany({where:{id:session.user.id,image:existing.image},data:{imageCrop:crop}});
      if (!result.count) return null;
      return tx.user.findUniqueOrThrow({where:{id:session.user.id},select:userProfileSelect});
    });
    if (!saved) return NextResponse.json({error:"Your photo changed in another window. Reload and try again."},{status:409});
    const profile = serializeUserProfile(saved);
    revalidatePath("/", "layout");
    revalidatePath("/account");
    if (profile.username) revalidatePath(`/profiles/${profile.username}`);
    return NextResponse.json({url:profile.image,profile,persisted:true});
  } catch {
    return NextResponse.json({error:"The crop could not be saved. Please try again."},{status:500});
  }
}
