"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const signUpSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export async function createPasswordAccountAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check your account details."
    };
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true }
  });

  if (existingUser?.passwordHash) {
    return { ok: false, error: "An account already exists for that email." };
  }

  if (existingUser && !existingUser.passwordHash) {
    return {
      ok: false,
      error: "That email already uses Google sign-in. Add a password from account settings later."
    };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  await db.user.create({
    data: {
      email,
      name: parsed.data.name || null,
      passwordHash
    }
  });

  return { ok: true, email };
}

const profileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "Use 3-30 letters, numbers, dots, dashes, or underscores.")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(280).optional(),
  image: z.string().trim().url().optional().or(z.literal("")),
  instagramUrl: z.string().trim().url().optional().or(z.literal("")),
  tiktokUrl: z.string().trim().url().optional().or(z.literal("")),
  partyfulUrl: z.string().trim().url().optional().or(z.literal(""))
});

export async function updateAccountProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to update your profile." };
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    username: formData.get("username") || undefined,
    bio: formData.get("bio") || undefined,
    image: formData.get("image") || undefined,
    instagramUrl: formData.get("instagramUrl") || undefined,
    tiktokUrl: formData.get("tiktokUrl") || undefined,
    partyfulUrl: formData.get("partyfulUrl") || undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check your profile details."
    };
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.data.name || null,
        username: parsed.data.username || null,
        bio: parsed.data.bio || null,
        image: parsed.data.image || null,
        instagramUrl: parsed.data.instagramUrl || null,
        tiktokUrl: parsed.data.tiktokUrl || null,
        partyfulUrl: parsed.data.partyfulUrl || null
      }
    });
  } catch {
    return { ok: false, error: "That handle is already taken." };
  }

  revalidatePath("/account");
  return { ok: true };
}

const partyPhotoSchema = z.object({
  imageUrl: z.string().trim().url("Add a valid image URL.")
});

export async function addPartyPhotoAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to add party photos." };
  }

  const parsed = partyPhotoSchema.safeParse({
    imageUrl: formData.get("imageUrl")
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Add a valid image URL." };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { partyPhotoUrls: true }
  });

  const nextPhotos = [parsed.data.imageUrl, ...(user?.partyPhotoUrls ?? [])].slice(0, 24);

  await db.user.update({
    where: { id: session.user.id },
    data: { partyPhotoUrls: nextPhotos }
  });

  revalidatePath("/account");
  return { ok: true };
}
