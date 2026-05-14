"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { serializeUserProfile, userProfileSelect } from "@/lib/user-profile";

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
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.data.name || null,
        username: parsed.data.username || null,
        bio: parsed.data.bio || null,
        instagramUrl: parsed.data.instagramUrl || null,
        tiktokUrl: parsed.data.tiktokUrl || null,
        partyfulUrl: parsed.data.partyfulUrl || null
      },
      select: userProfileSelect
    });

    const profile = serializeUserProfile(updatedUser);

    console.log("[profile] saved profile fields to database", {
      profile
    });

    revalidatePath("/account");
    revalidatePath("/parties");
    revalidatePath("/");
    return { ok: true, profile };
  } catch {
    return { ok: false, error: "That handle is already taken." };
  }
}

const partyPhotoPayloadSchema = z.object({
  id: z.string().cuid(),
  vendorIds: z.array(z.string().cuid()).max(8).default([]),
  vendorRatings: z.record(z.string().cuid(), z.coerce.number().int().min(1).max(5)).default({})
});

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(min).max(max).optional()
  );

const partyEventFieldsSchema = z.object({
  title: z.string().trim().min(2, "Add an event title.").max(100),
  theme: z.string().trim().max(100).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  location: z.string().trim().max(240).optional().or(z.literal("")),
  formattedAddress: z.string().trim().max(240).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(40).optional().or(z.literal("")),
  zipCode: z.string().trim().max(12).optional().or(z.literal("")),
  locationLat: optionalCoordinate(-90, 90),
  locationLng: optionalCoordinate(-180, 180),
  googlePlaceId: z.string().trim().max(180).optional().or(z.literal(""))
});

const createPartyEventSchema = partyEventFieldsSchema.extend({
  photos: z
    .array(partyPhotoPayloadSchema)
    .min(1, "Upload at least one party photo.")
    .max(16, "Keep party stories to 16 photos or fewer.")
});

const updatePartyEventSchema = partyEventFieldsSchema.extend({
  eventId: z.string().cuid(),
  photos: z.array(partyPhotoPayloadSchema).max(16, "Keep party stories to 16 photos or fewer.")
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createPartyEventAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to create a party gallery." };
  }

  const parsed = createPartyEventSchema.safeParse(parsePartyEventFormData(formData));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your event details." };
  }

  const prepared = await preparePartyPhotoPersistence({
    userId: session.user.id,
    photos: parsed.data.photos
  });

  if (prepared.orderedPhotos.length === 0) {
    return { ok: false, error: "Upload at least one party photo before saving." };
  }

  const event = await db.$transaction(async (tx) => {
    const partyEvent = await tx.partyEvent.create({
      data: {
        userId: session.user.id,
        slug: `${slugify(parsed.data.title) || "party"}-${Date.now().toString(36)}`,
        title: parsed.data.title,
        theme: parsed.data.theme || null,
        tags: parsed.data.tags,
        description: parsed.data.description || null,
        location: parsed.data.formattedAddress || parsed.data.location || null,
        formattedAddress: parsed.data.formattedAddress || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        zipCode: parsed.data.zipCode || null,
        locationLat: parsed.data.locationLat ?? null,
        locationLng: parsed.data.locationLng ?? null,
        googlePlaceId: parsed.data.googlePlaceId || null,
        coverImageUrl: prepared.imageUrls[0] ?? null,
        imageUrls: prepared.imageUrls,
        taggedVendors: {
          connect: prepared.eventVendorIds.map((id) => ({ id }))
        }
      }
    });

    await Promise.all(
      prepared.orderedPhotos.map(async (photo, index) => {
        const ratedVendorIds = getRatedVendorIds(photo, prepared.validVendorIds);
        await tx.partyPhoto.update({
          where: { id: photo.id },
          data: {
            eventId: partyEvent.id,
            sortOrder: index,
            taggedVendors: {
              set: photo.vendorIds
                .filter((vendorId) => prepared.validVendorIds.has(vendorId))
                .map((id) => ({ id }))
            }
          }
        });
        await persistPartyPhotoVendorRatings({
          photo,
          ratedVendorIds,
          tx,
          userId: session.user.id
        });
      })
    );

    return partyEvent;
  });

  revalidatePath("/parties");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/");
  return { ok: true, eventSlug: event.slug };
}

export async function updatePartyEventAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to edit party stories." };
  }

  const parsed = updatePartyEventSchema.safeParse({
    ...parsePartyEventFormData(formData),
    eventId: formData.get("eventId")
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your event details." };
  }

  const existingEvent = await db.partyEvent.findFirst({
    where: {
      id: parsed.data.eventId,
      userId: session.user.id
    },
    select: {
      id: true,
      slug: true,
      photos: {
        select: {
          id: true
        }
      }
    }
  });

  if (!existingEvent) {
    return { ok: false, error: "That party story could not be found." };
  }

  const prepared = await preparePartyPhotoPersistence({
    userId: session.user.id,
    photos: parsed.data.photos,
    eventId: existingEvent.id
  });
  const keptPhotoIds = prepared.orderedPhotos.map((photo) => photo.id);

  const event = await db.$transaction(async (tx) => {
    await tx.partyPhoto.deleteMany({
      where: {
        eventId: existingEvent.id,
        userId: session.user.id,
        ...(keptPhotoIds.length ? { id: { notIn: keptPhotoIds } } : {})
      }
    });

    const updatedEvent = await tx.partyEvent.update({
      where: { id: existingEvent.id },
      data: {
        title: parsed.data.title,
        theme: parsed.data.theme || null,
        tags: parsed.data.tags,
        description: parsed.data.description || null,
        location: parsed.data.formattedAddress || parsed.data.location || null,
        formattedAddress: parsed.data.formattedAddress || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        zipCode: parsed.data.zipCode || null,
        locationLat: parsed.data.locationLat ?? null,
        locationLng: parsed.data.locationLng ?? null,
        googlePlaceId: parsed.data.googlePlaceId || null,
        coverImageUrl: prepared.imageUrls[0] ?? null,
        imageUrls: prepared.imageUrls,
        taggedVendors: {
          set: prepared.eventVendorIds.map((id) => ({ id }))
        }
      },
      select: {
        slug: true
      }
    });

    await Promise.all(
      prepared.orderedPhotos.map(async (photo, index) => {
        const ratedVendorIds = getRatedVendorIds(photo, prepared.validVendorIds);
        await tx.partyPhoto.update({
          where: { id: photo.id },
          data: {
            eventId: existingEvent.id,
            sortOrder: index,
            taggedVendors: {
              set: photo.vendorIds
                .filter((vendorId) => prepared.validVendorIds.has(vendorId))
                .map((id) => ({ id }))
            }
          }
        });
        await persistPartyPhotoVendorRatings({
          photo,
          ratedVendorIds,
          tx,
          userId: session.user.id
        });
      })
    );

    return updatedEvent;
  });

  revalidatePath("/parties");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/");
  return { ok: true, eventSlug: event.slug };
}

function parsePartyEventFormData(formData: FormData) {
  const tags = formData
    .getAll("tags")
    .flatMap((value) => String(value).split(","))
    .map(normalizeTag)
    .filter(Boolean);
  const photos = parsePartyPhotoPayload(formData.get("photos"));

  return {
    title: formData.get("title"),
    theme: formData.get("theme") || undefined,
    tags,
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    formattedAddress: formData.get("locationFormattedAddress") || undefined,
    city: formData.get("locationCity") || undefined,
    state: formData.get("locationState") || undefined,
    zipCode: formData.get("locationZipCode") || undefined,
    locationLat: formData.get("locationLat") || undefined,
    locationLng: formData.get("locationLng") || undefined,
    googlePlaceId: formData.get("locationPlaceId") || undefined,
    photos
  };
}

async function preparePartyPhotoPersistence({
  eventId,
  photos,
  userId
}: {
  eventId?: string;
  photos: Array<z.infer<typeof partyPhotoPayloadSchema>>;
  userId: string;
}) {
  const uploadedPhotos = await db.partyPhoto.findMany({
    where: {
      id: { in: photos.map((photo) => photo.id) },
      userId,
      OR: eventId ? [{ eventId }, { eventId: null }] : [{ eventId: null }]
    },
    select: {
      id: true,
      updatedAt: true
    }
  });
  const uploadedPhotoIds = new Set(uploadedPhotos.map((photo) => photo.id));
  const orderedPhotos = photos.filter((photo) => uploadedPhotoIds.has(photo.id));

  const validVendors = await db.vendorProfile.findMany({
    where: {
      id: {
        in: Array.from(new Set(orderedPhotos.flatMap((photo) => photo.vendorIds)))
      }
    },
    select: { id: true }
  });
  const validVendorIds = new Set(validVendors.map((vendor) => vendor.id));
  const eventVendorIds = Array.from(
    new Set(
      orderedPhotos.flatMap((photo) =>
        photo.vendorIds.filter((vendorId) => validVendorIds.has(vendorId))
      )
    )
  );
  const photoUrlById = new Map(
    uploadedPhotos.map((photo) => [
      photo.id,
      `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`
    ])
  );
  const imageUrls = orderedPhotos
    .map((photo) => photoUrlById.get(photo.id))
    .filter((url): url is string => Boolean(url));

  return {
    eventVendorIds,
    imageUrls,
    orderedPhotos,
    validVendorIds
  };
}

function getRatedVendorIds(
  photo: z.infer<typeof partyPhotoPayloadSchema>,
  validVendorIds: Set<string>
) {
  return photo.vendorIds.filter(
    (vendorId) =>
      validVendorIds.has(vendorId) &&
      typeof photo.vendorRatings[vendorId] === "number" &&
      photo.vendorRatings[vendorId] >= 1 &&
      photo.vendorRatings[vendorId] <= 5
  );
}

async function persistPartyPhotoVendorRatings({
  photo,
  ratedVendorIds,
  tx,
  userId
}: {
  photo: z.infer<typeof partyPhotoPayloadSchema>;
  ratedVendorIds: string[];
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  await tx.partyPhotoVendorRating.deleteMany({
    where: {
      photoId: photo.id,
      userId,
      ...(ratedVendorIds.length ? { vendorId: { notIn: ratedVendorIds } } : {})
    }
  });

  await Promise.all(
    ratedVendorIds.map((vendorId) =>
      tx.partyPhotoVendorRating.upsert({
        where: {
          photoId_vendorId: {
            photoId: photo.id,
            vendorId
          }
        },
        update: {
          rating: photo.vendorRatings[vendorId]
        },
        create: {
          photoId: photo.id,
          rating: photo.vendorRatings[vendorId],
          userId,
          vendorId
        }
      })
    )
  );
}

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

function parsePartyPhotoPayload(value: FormDataEntryValue | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((photo) => {
      if (!photo || typeof photo !== "object") {
        return { id: "", vendorIds: [] };
      }
      const record = photo as { id?: unknown; vendorIds?: unknown; vendorRatings?: unknown };
      const vendorRatings =
        record.vendorRatings && typeof record.vendorRatings === "object" && !Array.isArray(record.vendorRatings)
          ? Object.fromEntries(
              Object.entries(record.vendorRatings as Record<string, unknown>).filter(
                ([vendorId, rating]) =>
                  typeof vendorId === "string" &&
                  typeof rating === "number" &&
                  Number.isInteger(rating) &&
                  rating >= 1 &&
                  rating <= 5
              )
            )
          : {};
      return {
        id: typeof record.id === "string" ? record.id : "",
        vendorIds: Array.isArray(record.vendorIds)
          ? record.vendorIds.filter((vendorId): vendorId is string => typeof vendorId === "string")
          : [],
        vendorRatings
      };
    });
  } catch {
    return [];
  }
}

export async function toggleFollowAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to follow creators." };
  }

  const followingId = String(formData.get("followingId") ?? "");
  if (!followingId || followingId === session.user.id) {
    return { ok: false, error: "Choose a valid creator to follow." };
  }

  const existing = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.user.id,
        followingId
      }
    }
  });

  if (existing) {
    await db.follow.delete({ where: { id: existing.id } });
  } else {
    await db.follow.create({
      data: {
        followerId: session.user.id,
        followingId
      }
    });
  }

  revalidatePath("/account");
  revalidatePath("/parties");
  revalidatePath("/explore");
  revalidatePath("/");
  return { ok: true };
}
