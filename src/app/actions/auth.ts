"use server";
import { collectPartyVendorRatings, persistPartyVendorRatings } from "@/lib/party-vendor-ratings";

import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { PartyCollaborationStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { parseImageCrop, type ImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { securityLog } from "@/lib/security/audit-log";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { serializeUserProfile, userProfileSelect } from "@/lib/user-profile";
import { friendlyValidationMessage } from "@/lib/validators/messages";
import { getAccountSetupDestination } from "@/lib/account-setup";
import { getTikTokVideo, isTikTokShareUrl, getAppleMusicPlaylist, getSpotifyPlaylist, getPinterestBoard, isPinterestShareUrl } from "@/lib/party-media";
import { getCounty, privatePartyLocation } from "@/lib/party-location";
import { resolvePartyTikTokUrl, resolvePartyPinterestUrl } from "@/lib/services/party-media";
import { deliverPartyNotificationEmails } from "@/lib/services/party-notifications";
import { persistPartyCollaborators } from "@/lib/services/party-collaboration";

const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255, "Email is a little too long."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export async function createPasswordAccountAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: friendlyValidationMessage(parsed.error.issues, {
        email: "Email",
        password: "Password"
      }, "Check your account details.")
    };
  }

  const email = parsed.data.email.toLowerCase();
  const signupRate = await checkServerActionRateLimit([
    { key: "signup:ip:{ip}", limit: 5, intervalMs: 60_000 },
    { key: `signup:email:${email}`, limit: 3, intervalMs: 60_000 }
  ]);
  if (!signupRate.ok) {
    securityLog("signup_rate_limited", { email });
    return { ok: false, error: "Please wait a minute before creating another account." };
  }

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
      passwordHash
    }
  });

  await sendWelcomeEmail(email);

  return { ok: true, email };
}

const requiredOnboardingProfileSchema = z.object({
  name: z.string().trim().min(1, "Display name is required.").max(80, "Display name is a little too long."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value.replace(/^@+/, ""))
    .pipe(
      z
        .string()
        .min(3, "Username must be at least 3 characters.")
        .max(30, "Username is a little too long.")
        .regex(/^[a-z0-9._-]+$/, "Use letters, numbers, dots, dashes, or underscores.")
    )
});

export async function completeRequiredProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to create your ShopFia username." };
  }
  if (formData.get("profileId") !== session.user.id) {
    return { ok: false, error: "Your signed-in account changed. Reload the page before continuing." };
  }

  const rate = await checkServerActionRateLimit([
    { key: "required-profile:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `required-profile:user:${session.user.id}`, limit: 12, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before updating your profile again." };
  }

  try {
    const existingUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: userProfileSelect
    });
    if (!existingUser) {
      return { ok: false, error: "Your profile could not be loaded. Sign in again with your existing login." };
    }

    // A stale onboarding tab must never rename an existing profile. Profile edits
    // belong in account settings; this action only fills missing identity fields.
    if (existingUser.username && existingUser.name) {
      return { ok: true, profile: serializeUserProfile(existingUser), nextPath: "/account" };
    }

    const destination = getAccountSetupDestination(formData);
    if (!destination.ok) return destination;

    const parsed = requiredOnboardingProfileSchema.partial().safeParse({
      ...(existingUser.name ? {} : { name: formData.get("name") }),
      ...(existingUser.username ? {} : { username: formData.get("username") })
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: friendlyValidationMessage(parsed.error.issues, {
          name: "Display name",
          username: "Username"
        }, "Check your profile details.")
      };
    }

    // Match the observed identity as well as the authenticated ID. If another tab
    // completes setup first, its saved identity wins instead of being overwritten.
    await db.user.updateMany({
      where: {
        id: session.user.id,
        name: existingUser.name,
        username: existingUser.username
      },
      data: {
        ...(existingUser.name ? {} : { name: parsed.data.name }),
        ...(existingUser.username ? {} : { username: parsed.data.username })
      }
    });
    const updatedUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: userProfileSelect
    });
    if (!updatedUser?.username || !updatedUser.name) {
      return { ok: false, error: "Your profile changed while saving. Reload the page and try again." };
    }

    const profile = serializeUserProfile(updatedUser);
    revalidatePath("/", "layout");
    revalidatePath("/account");
    revalidatePath(`/profiles/${profile.username}`);
    return { ok: true, profile, nextPath: destination.nextPath };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { ok: false, error: "That username is already taken. Try another one." };
    }
    console.error("ShopFia required profile save failed", error);
    return { ok: false, error: "Your profile could not be saved right now. Please try again." };
  }
}

const passwordResetSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  token: z.string().min(24, "Reset link is invalid."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = passwordResetSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    token: formData.get("token")
  });

  if (!parsed.success) {
    return { ok: false, error: "That reset link or password is invalid." };
  }

  const email = parsed.data.email.toLowerCase();
  const identifier = `password-reset:${email}`;
  const token = hashToken(parsed.data.token);
  const resetRecord = await db.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier,
        token
      }
    }
  });

  if (!resetRecord || resetRecord.expires < new Date()) {
    if (resetRecord) {
      await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } });
    }
    return { ok: false, error: "This reset link has expired. Request a fresh one." };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  await db.$transaction([
    db.user.update({
      where: { email },
      data: { passwordHash }
    }),
    db.verificationToken.delete({
      where: { identifier_token: { identifier, token } }
    })
  ]);

  securityLog("password_reset_completed", { email });
  return { ok: true, message: "Password updated. You can sign in with your new password." };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Display name is required.").max(80, "Name is a little too long."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value.replace(/^@+/, ""))
    .pipe(
      z
        .string()
        .min(3, "Username must be at least 3 characters.")
        .max(30, "Username is a little too long.")
        .regex(/^[a-z0-9._-]+$/, "Use letters, numbers, dots, dashes, or underscores.")
    ),
  bio: z.string().trim().max(280, "Bio is a little too long. Keep it under 280 characters.").optional(),
  instagramUrl: z.string().trim().url("Enter a valid Instagram link.").optional().or(z.literal("")),
  tiktokUrl: z.string().trim().url("Enter a valid TikTok link.").optional().or(z.literal("")),
  partyfulUrl: z.string().trim().url("Enter a valid Partiful link.").optional().or(z.literal(""))
});

export async function updateAccountProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to update your profile." };
  }

  const rate = await checkServerActionRateLimit([
    { key: "profile-update:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `profile-update:user:${session.user.id}`, limit: 12, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before updating your profile again." };
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    username: formData.get("username"),
    bio: formData.get("bio") || undefined,
    instagramUrl: formData.get("instagramUrl") || undefined,
    tiktokUrl: formData.get("tiktokUrl") || undefined,
    partyfulUrl: formData.get("partyfulUrl") || undefined
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: friendlyValidationMessage(parsed.error.issues, {
        bio: "Bio",
        instagramUrl: "Instagram link",
        name: "Name",
        partyfulUrl: "Partiful link",
        tiktokUrl: "TikTok link",
        username: "Username"
      }, "Check your profile details.")
    };
  }

  try {
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.data.name || null,
        username: parsed.data.username,
        bio: parsed.data.bio || null,
        instagramUrl: parsed.data.instagramUrl || null,
        tiktokUrl: parsed.data.tiktokUrl || null,
        partyfulUrl: parsed.data.partyfulUrl || null,
        imageCrop: parseImageCrop(formData.get("imageCrop")) ?? undefined
      },
      select: userProfileSelect
    });

    const profile = serializeUserProfile(updatedUser);

    revalidatePath("/account");
    revalidatePath("/my-parties");
    revalidatePath("/parties");
    revalidatePath("/");
    return { ok: true, profile };
  } catch {
    return { ok: false, error: "That handle is already taken." };
  }
}

const partyPhotoPayloadSchema = z.object({
  id: z.string().cuid(),
  crop: z
    .object({
      x: z.coerce.number().min(0).max(100),
      y: z.coerce.number().min(0).max(100),
      zoom: z.coerce.number().min(0.25).max(3),
      brightness: z.coerce.number().min(0.5).max(1.5).default(1),
      saturation: z.coerce.number().min(0).max(2).default(1),
      aspectRatio: z.coerce.number().min(0.1).max(10).optional()
    })
    .default({ x: 50, y: 50, zoom: 1, brightness: 1, saturation: 1 }),
  vendorIds: z.array(z.string().cuid()).max(8).default([]),
  vendorContributions: z.record(z.string().cuid(), z.string().trim().max(220)).default({}),
  vendorRatings: z.record(z.string().cuid(), z.coerce.number().int().min(1).max(5)).default({})
});

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(min).max(max).optional()
  );

export async function updatePartyCoverCropAction(eventId: string, crop: ImageCrop) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to adjust the cover." };
  const parsed = partyPhotoPayloadSchema.shape.crop.safeParse(crop);
  if (!parsed.success) return { ok: false, error: "Check the crop settings." };
  const rate = await checkServerActionRateLimit([{ key: `party-cover:${session.user.id}`, limit: 30, intervalMs: 60_000 }]);
  if (!rate.ok) return { ok: false, error: "Please wait a minute and try again." };
  const result = await db.partyEvent.updateMany({ where: { id: eventId, userId: session.user.id }, data: { coverImageCrop: parsed.data } });
  if (!result.count) return { ok: false, error: "You can only edit your own party." };
  revalidatePath("/events/[slug]", "page");
  return { ok: true };
}

function validatePrivatePartyCounty(value: { location?: string; countyFips?: string; countyState?: string }, context: z.RefinementCtx) {
  if (value.location === "Private residence" && (!getCounty(value.countyFips) || getCounty(value.countyFips)?.state !== value.countyState)) context.addIssue({ code: "custom", path: ["countyFips"], message: "Choose your state and county for a private residence." });
}
const partyEventFieldsSchema = z.object({
  countyFips: z.string().trim().max(5).optional(),
  countyState: z.string().trim().max(2).optional(),
  tiktokUrls: z.array(z.string().trim().max(2048).refine((value) => Boolean(getTikTokVideo(value)) || isTikTokShareUrl(value), "Enter a TikTok video link.")).max(8, "Add up to 8 party videos.").default([]),
  spotifyUrl: z.string().trim().max(2048).refine((value) => !value || Boolean(getSpotifyPlaylist(value)), "Enter a Spotify playlist link.").optional(),
  pinterestUrl: z.string().trim().max(2048).refine((value) => !value || Boolean(getPinterestBoard(value)) || isPinterestShareUrl(value), "Enter a Pinterest mood board link.").optional(),
  tiktokUrl: z.string().trim().max(2048).refine((value) => !value || Boolean(getTikTokVideo(value)) || isTikTokShareUrl(value), "Enter a TikTok video link.").optional(),
  appleMusicUrl: z.string().trim().max(2048).refine((value) => !value || Boolean(getAppleMusicPlaylist(value)), "Enter a public Apple Music playlist link.").optional(),
  title: z.string().trim().min(2, "Add an event title.").max(100, "Party name is a little too long."),
  theme: z.string().trim().max(100, "Theme is a little too long.").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30, "Keep tags short and sweet.")).max(12, "Use up to 12 tags.").default([]),
  description: z.string().trim().max(500, "Party notes are a little too long.").optional().or(z.literal("")),
  eventDate: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/, "Choose a valid event date.").refine((value) => {
    const day = value.length === 7 ? `${value}-01` : value;
    const date = new Date(`${day}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
  }, "Choose a valid event date.").optional().or(z.literal("")),
  partyfulUrl: z.string().trim().url("Enter a valid Partiful invite link.").optional().or(z.literal("")),
  location: z.string().trim().max(240, "Location is a little too long.").optional().or(z.literal("")),
  formattedAddress: z.string().trim().max(240, "Location is a little too long.").optional().or(z.literal("")),
  city: z.string().trim().max(80, "City is a little too long.").optional().or(z.literal("")),
  state: z.string().trim().max(40, "State is a little too long.").optional().or(z.literal("")),
  zipCode: z.string().trim().max(12, "Zip code is a little too long.").optional().or(z.literal("")),
  locationLat: optionalCoordinate(-90, 90),
  locationLng: optionalCoordinate(-180, 180),
  googlePlaceId: z.string().trim().max(180, "Location details are a little too long.").optional().or(z.literal("")),
  mainHostId: z.string().cuid().optional().or(z.literal("")),
  coHostIds: z.array(z.string().cuid()).max(12).default([]),
  guestIds: z.array(z.string().cuid()).max(100).default([])
});

const createPartyEventSchema = partyEventFieldsSchema.extend({
  photos: z
    .array(partyPhotoPayloadSchema)
    .min(1, "Upload at least one party photo.")
    .max(16, "Keep parties to 16 photos or fewer.")
}).superRefine(validatePrivatePartyCounty);

const updatePartyEventSchema = partyEventFieldsSchema.extend({
  eventId: z.string().cuid(),
  photos: z.array(partyPhotoPayloadSchema).max(16, "Keep parties to 16 photos or fewer.")
}).superRefine(validatePrivatePartyCounty);

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

  const rate = await checkServerActionRateLimit([
    { key: "party-create:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `party-create:user:${session.user.id}`, limit: 8, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before creating another party." };
  }

  const parsed = createPartyEventSchema.safeParse(parsePartyEventFormData(formData));

  if (!parsed.success) {
    return { ok: false, error: getPartyValidationMessage(parsed.error.issues) };
  }

  const prepared = await preparePartyPhotoPersistence({
    userId: session.user.id,
    photos: parsed.data.photos
  });

  if (prepared.orderedPhotos.some((photo) => photo.vendorIds.some((id) => prepared.validVendorIds.has(id) && !photo.vendorRatings[id]))) {
    return { ok: false, error: "Rate each tagged vendor before saving your party." };
  }

  if (prepared.orderedPhotos.length === 0) {
    return { ok: false, error: "Upload at least one party photo before saving." };
  }

  let tiktokUrls: string[];
  try {
    const inputs = parsed.data.tiktokUrls.length ? parsed.data.tiktokUrls : parsed.data.tiktokUrl ? [parsed.data.tiktokUrl] : [];
    tiktokUrls = [...new Set((await Promise.all(inputs.map(resolvePartyTikTokUrl))).filter((url): url is string => Boolean(url)))];
  } catch {
    return { ok: false, error: "Could not open that TikTok link. Paste the full video link from your browser." };
  }
  const tiktokUrl = tiktokUrls[0] ?? null;
  const spotifyUrl = getSpotifyPlaylist(parsed.data.spotifyUrl)?.url ?? null;
  let pinterestUrl: string | null;
  try { pinterestUrl = await resolvePartyPinterestUrl(parsed.data.pinterestUrl); }
  catch { return { ok: false, error: "Could not open that Pinterest share link. Try the full board link from Pinterest." }; }
  const privateLocation = parsed.data.location === "Private residence" ? privatePartyLocation(parsed.data.countyFips) : null;
  const appleMusicUrl = getAppleMusicPlaylist(parsed.data.appleMusicUrl)?.url ?? null;

  const event = await db.$transaction(async (tx) => {
    const partyEvent = await tx.partyEvent.create({
      data: {
        userId: session.user.id,
        slug: `${slugify(parsed.data.title) || "party"}-${Date.now().toString(36)}`,
        title: parsed.data.title,
        theme: parsed.data.theme || null,
        tags: parsed.data.tags,
        description: parsed.data.description || null,
        tiktokUrl,
        tiktokUrls,
        spotifyUrl,
        pinterestUrl,
        appleMusicUrl,
        eventDate: parsed.data.eventDate ? new Date(`${parsed.data.eventDate.length === 7 ? parsed.data.eventDate + "-01" : parsed.data.eventDate}T00:00:00.000Z`) : null,
        partyfulUrl: parsed.data.partyfulUrl || null,
        location: parsed.data.formattedAddress || parsed.data.location || null,
        formattedAddress: parsed.data.formattedAddress || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        zipCode: parsed.data.zipCode || null,
        locationLat: parsed.data.locationLat ?? null,
        locationLng: parsed.data.locationLng ?? null,
        googlePlaceId: parsed.data.googlePlaceId || null,
        county: null,
        countyFips: null,
        ...(privateLocation ?? {}),
        coverImageUrl: prepared.imageUrls[0] ?? null,
        imageUrls: prepared.imageUrls,
        taggedVendors: {
          connect: prepared.eventVendorIds.map((id) => ({ id }))
        }
      }
    });

    await persistPartyCollaborators({
      eventTitle: parsed.data.title,
      eventId: partyEvent.id,
      invitedById: session.user.id,
      mainHostId: parsed.data.mainHostId || session.user.id,
      coHostIds: parsed.data.coHostIds,
      guestIds: parsed.data.guestIds,
      ownerId: session.user.id,
      tx
    });

    await Promise.all(
      prepared.orderedPhotos.map(async (photo, index) => {
        const creditedVendorIds = getCreditedVendorIds(photo, prepared.validVendorIds);
        await tx.partyPhoto.update({
          where: { id: photo.id },
          data: {
            eventId: partyEvent.id,
            crop: photo.crop,
            sortOrder: index,
            taggedVendors: {
              set: photo.vendorIds
                .filter((vendorId) => prepared.validVendorIds.has(vendorId))
                .map((id) => ({ id }))
            }
          }
        });
        await persistPartyPhotoVendorCredits({
          photo,
          creditedVendorIds,
          tx,
          userId: session.user.id
        });
      })
    );

    await persistPartyVendorRatings(tx, partyEvent.id, session.user.id, prepared.eventVendorIds, prepared.vendorRatings);
    return partyEvent;
  }, { maxWait: 10_000, timeout: 30_000 });

  await deliverPartyNotificationEmails(event.id).catch(() => undefined);
  revalidatePath("/notifications");
  revalidatePath("/parties");
  revalidatePath("/my-parties");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/");
  return { ok: true, eventSlug: event.slug };
}

export async function updatePartyEventAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to edit parties." };
  }

  const rate = await checkServerActionRateLimit([
    { key: "party-update:ip:{ip}", limit: 30, intervalMs: 60_000 },
    { key: `party-update:user:${session.user.id}`, limit: 12, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before updating this party again." };
  }

  const parsed = updatePartyEventSchema.safeParse({
    ...parsePartyEventFormData(formData),
    eventId: formData.get("eventId")
  });

  if (!parsed.success) {
    return { ok: false, error: getPartyValidationMessage(parsed.error.issues) };
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
        orderBy: { sortOrder: "asc" },
        select: {
          id: true
        }
      }
    }
  });

  if (!existingEvent) {
    return { ok: false, error: "That party could not be found." };
  }

  const prepared = await preparePartyPhotoPersistence({
    userId: session.user.id,
    photos: parsed.data.photos,
    eventId: existingEvent.id
  });
  const keptPhotoIds = prepared.orderedPhotos.map((photo) => photo.id);
  if (prepared.orderedPhotos.some((photo) => photo.vendorIds.some((id) => prepared.validVendorIds.has(id) && !photo.vendorRatings[id]))) {
    return { ok: false, error: "Rate each tagged vendor before saving your party." };
  }

  let tiktokUrls: string[];
  try {
    const inputs = parsed.data.tiktokUrls.length ? parsed.data.tiktokUrls : parsed.data.tiktokUrl ? [parsed.data.tiktokUrl] : [];
    tiktokUrls = [...new Set((await Promise.all(inputs.map(resolvePartyTikTokUrl))).filter((url): url is string => Boolean(url)))];
  } catch {
    return { ok: false, error: "Could not open that TikTok link. Paste the full video link from your browser." };
  }
  const tiktokUrl = tiktokUrls[0] ?? null;
  const spotifyUrl = getSpotifyPlaylist(parsed.data.spotifyUrl)?.url ?? null;
  let pinterestUrl: string | null;
  try { pinterestUrl = await resolvePartyPinterestUrl(parsed.data.pinterestUrl); }
  catch { return { ok: false, error: "Could not open that Pinterest share link. Try the full board link from Pinterest." }; }
  const privateLocation = parsed.data.location === "Private residence" ? privatePartyLocation(parsed.data.countyFips) : null;
  const appleMusicUrl = getAppleMusicPlaylist(parsed.data.appleMusicUrl)?.url ?? null;

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
        tiktokUrl,
        tiktokUrls,
        spotifyUrl,
        pinterestUrl,
        appleMusicUrl,
        eventDate: parsed.data.eventDate ? new Date(`${parsed.data.eventDate.length === 7 ? parsed.data.eventDate + "-01" : parsed.data.eventDate}T00:00:00.000Z`) : null,

        location: parsed.data.formattedAddress || parsed.data.location || null,
        formattedAddress: parsed.data.formattedAddress || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        zipCode: parsed.data.zipCode || null,
        locationLat: parsed.data.locationLat ?? null,
        locationLng: parsed.data.locationLng ?? null,
        googlePlaceId: parsed.data.googlePlaceId || null,
        county: null,
        countyFips: null,
        ...(privateLocation ?? {}),
        coverImageUrl: prepared.imageUrls[0] ?? null,
        coverImageCrop: prepared.orderedPhotos[0]?.crop ?? { x: 50, y: 50, zoom: 1 },
        imageUrls: prepared.imageUrls,
        taggedVendors: {
          set: prepared.eventVendorIds.map((id) => ({ id }))
        }
      },
      select: {
        slug: true
      }
    });

    await persistPartyCollaborators({
      eventTitle: parsed.data.title,
      eventId: existingEvent.id,
      invitedById: session.user.id,
      mainHostId: parsed.data.mainHostId || session.user.id,
      coHostIds: parsed.data.coHostIds,
      guestIds: parsed.data.guestIds,
      ownerId: session.user.id,
      tx
    });

    await Promise.all(
      prepared.orderedPhotos.map(async (photo, index) => {
        const creditedVendorIds = getCreditedVendorIds(photo, prepared.validVendorIds);
        await tx.partyPhoto.update({
          where: { id: photo.id },
          data: {
            eventId: existingEvent.id,
            crop: photo.crop,
            sortOrder: index,
            taggedVendors: {
              set: photo.vendorIds
                .filter((vendorId) => prepared.validVendorIds.has(vendorId))
                .map((id) => ({ id }))
            }
          }
        });
        await persistPartyPhotoVendorCredits({
          photo,
          creditedVendorIds,
          tx,
          userId: session.user.id
        });
      })
    );

    await persistPartyVendorRatings(tx, existingEvent.id, session.user.id, prepared.eventVendorIds, prepared.vendorRatings);
    return updatedEvent;
  }, { maxWait: 10_000, timeout: 30_000 });

  await deliverPartyNotificationEmails(existingEvent.id).catch(() => undefined);
  revalidatePath("/notifications");
  revalidatePath("/parties");
  revalidatePath("/my-parties");
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/");
  return { ok: true, eventSlug: event.slug };
}

export async function updatePartyCollaborationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to update this collaboration." };
  }

  const rate = await checkServerActionRateLimit([
    { key: "party-collab:ip:{ip}", limit: 60, intervalMs: 60_000 },
    { key: `party-collab:user:${session.user.id}`, limit: 30, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before updating collaborations again." };
  }

  const collaborationId = String(formData.get("collaborationId") ?? "");
  const action = String(formData.get("action") ?? "");
  const nextStatus =
    action === "accept"
      ? PartyCollaborationStatus.ACCEPTED
      : action === "decline"
      ? PartyCollaborationStatus.DECLINED
      : action === "remove"
      ? PartyCollaborationStatus.REMOVED
      : null;

  if (!collaborationId || !nextStatus) {
    return { ok: false, error: "Choose a valid collaboration action." };
  }

  let notificationEventId: string | undefined;
  const collaboration = await db.$transaction(async (tx) => {
    const updated = await tx.partyCollaborator.updateMany({
    where: {
      id: collaborationId,
      userId: session.user.id,
      // Check consent and current state atomically: a stale accept must never
      // restore an invitation that the owner revoked or the invitee declined.
      status: action === "remove"
        ? { in: [PartyCollaborationStatus.PENDING, PartyCollaborationStatus.ACCEPTED] }
        : PartyCollaborationStatus.PENDING
    },
    data: { status: nextStatus }
    });
    if (updated.count && action === "accept") {
      const invitation = await tx.partyCollaborator.findFirst({
        where: { id: collaborationId, userId: session.user.id },
        select: { eventId: true, role: true, event: { select: { userId: true, slug: true, title: true } }, user: { select: { name: true, username: true } } }
      });
      if (invitation && invitation.event.userId !== session.user.id) {
        notificationEventId = invitation.eventId;
        await tx.notification.createMany({ data: [{
          userId: invitation.event.userId, eventId: invitation.eventId, kind: "PARTY_INVITATION_ACCEPTED",
          title: `${invitation.user.name ?? invitation.user.username ?? "A guest"} accepted your invitation to ${invitation.event.title}`,
          href: `/events/${invitation.event.slug}`, dedupeKey: `party-accepted:${collaborationId}`
        }], skipDuplicates: true });
      }
    }
    return updated;
  });

  if (collaboration.count === 0) {
    return { ok: false, error: "That collaboration could not be found." };
  }

  await db.notification.updateMany({
    where: { userId: session.user.id, kind: "PARTY_INVITATION", readAt: null, event: { collaborators: { some: { id: collaborationId, userId: session.user.id } } } },
    data: { readAt: new Date() }
  });
  if (notificationEventId) await deliverPartyNotificationEmails(notificationEventId).catch(() => undefined);
  revalidatePath("/notifications");
  revalidatePath("/my-parties");
  revalidatePath("/parties");
  revalidatePath("/");
  return { ok: true };
}

function getPartyValidationMessage(issues: z.ZodIssue[]) {
  return friendlyValidationMessage(issues, {
    city: "City",
    countyFips: "County",
    pinterestUrl: "Pinterest mood board",
    spotifyUrl: "Spotify playlist",
    tiktokUrls: "Party videos",
    tiktokUrl: "TikTok video",
    appleMusicUrl: "Apple Music playlist",
    guestIds: "Guests",
    coHostIds: "Co-hosts",
    description: "Party notes",
    formattedAddress: "Location",
    location: "Location",
    mainHostId: "Main host",
    photos: "Party photos",
    state: "State",
    tags: "Tags",
    theme: "Theme",
    title: "Party name",
    zipCode: "Zip code"
  }, "Check your party details.");
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
    eventDate: formData.get("eventDate") || undefined,
    partyfulUrl: formData.get("partyfulUrl") || undefined,
    location: formData.get("location") || undefined,
    formattedAddress: formData.get("locationFormattedAddress") || undefined,
    city: formData.get("locationCity") || undefined,
    state: formData.get("locationState") || undefined,
    zipCode: formData.get("locationZipCode") || undefined,
    locationLat: formData.get("locationLat") || undefined,
    locationLng: formData.get("locationLng") || undefined,
    googlePlaceId: formData.get("locationPlaceId") || undefined,
    countyFips: String(formData.get("countyFips") ?? ""),
    countyState: String(formData.get("countyState") ?? ""),
    spotifyUrl: String(formData.get("spotifyUrl") ?? ""),
    pinterestUrl: String(formData.get("pinterestUrl") ?? ""),
    tiktokUrls: formData.getAll("tiktokUrls").map(String).map((value) => value.trim()).filter(Boolean),
    tiktokUrl: String(formData.get("tiktokUrl") ?? ""),
    appleMusicUrl: String(formData.get("appleMusicUrl") ?? ""),
    guestIds: formData.getAll("guestIds").map(String).filter(Boolean),
    mainHostId: formData.get("mainHostId") || undefined,
    coHostIds: formData
      .getAll("coHostIds")
      .map(String)
      .filter(Boolean),
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
  const ownedPhotos = photos.filter((photo) => uploadedPhotoIds.has(photo.id));
  const savedRatings = eventId ? await db.partyVendorRating.findMany({ where: { eventId, userId }, select: { vendorId: true, rating: true } }) : [];
  const vendorRatings = collectPartyVendorRatings(ownedPhotos, Object.fromEntries(savedRatings.map((item) => [item.vendorId, item.rating])));
  const orderedPhotos = ownedPhotos.map((photo) => ({ ...photo, vendorRatings: Object.fromEntries(photo.vendorIds.filter((id) => vendorRatings[id]).map((id) => [id, vendorRatings[id]])) }));

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
      partyPhotoUrl(photo.id, photo.updatedAt, { width: 1400 })
    ])
  );
  const imageUrls = orderedPhotos
    .map((photo) => photoUrlById.get(photo.id))
    .filter((url): url is string => Boolean(url));

  return {
    eventVendorIds,
    imageUrls,
    orderedPhotos,
    vendorRatings,
    validVendorIds
  };
}

function getCreditedVendorIds(
  photo: z.infer<typeof partyPhotoPayloadSchema>,
  validVendorIds: Set<string>
) {
  return photo.vendorIds.filter(
    (vendorId) =>
      validVendorIds.has(vendorId) &&
      (hasContributionNote(photo.vendorContributions[vendorId]) ||
        (typeof photo.vendorRatings[vendorId] === "number" &&
          photo.vendorRatings[vendorId] >= 1 &&
          photo.vendorRatings[vendorId] <= 5))
  );
}

async function persistPartyPhotoVendorCredits({
  creditedVendorIds,
  photo,
  tx,
  userId
}: {
  creditedVendorIds: string[];
  photo: z.infer<typeof partyPhotoPayloadSchema>;
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  await tx.partyPhotoVendorRating.deleteMany({
    where: {
      photoId: photo.id,
      userId,
      ...(creditedVendorIds.length ? { vendorId: { notIn: creditedVendorIds } } : {})
    }
  });

  await Promise.all(
    creditedVendorIds.map((vendorId) =>
      tx.partyPhotoVendorRating.upsert({
        where: {
          photoId_vendorId: {
            photoId: photo.id,
            vendorId
          }
        },
        update: {
          contributionNote: normalizeContributionNote(photo.vendorContributions[vendorId]),
          rating: null
        },
        create: {
          contributionNote: normalizeContributionNote(photo.vendorContributions[vendorId]),
          photoId: photo.id,
          rating: null,
          userId,
          vendorId
        }
      })
    )
  );
}

function hasContributionNote(value: string | undefined) {
  return Boolean(normalizeContributionNote(value));
}

function normalizeContributionNote(value: string | undefined) {
  const note = value?.trim();
  return note ? note.slice(0, 220) : null;
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
      const record = photo as {
        crop?: unknown;
        id?: unknown;
        vendorContributions?: unknown;
        vendorIds?: unknown;
        vendorRatings?: unknown;
      };
      const vendorContributions =
        record.vendorContributions && typeof record.vendorContributions === "object" && !Array.isArray(record.vendorContributions)
          ? Object.fromEntries(
              Object.entries(record.vendorContributions as Record<string, unknown>)
                .filter(([vendorId, contribution]) => typeof vendorId === "string" && typeof contribution === "string")
                .map(([vendorId, contribution]) => [vendorId, String(contribution).trim().slice(0, 220)])
                .filter(([, contribution]) => Boolean(contribution))
            )
          : {};
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
        crop: parsePhotoCrop(record.crop),
        id: typeof record.id === "string" ? record.id : "",
        vendorIds: Array.isArray(record.vendorIds)
          ? record.vendorIds.filter((vendorId): vendorId is string => typeof vendorId === "string")
          : [],
        vendorContributions,
        vendorRatings
      };
    });
  } catch {
    return [];
  }
}

function parsePhotoCrop(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { x: 50, y: 50, zoom: 1 };
  }
  const record = value as Record<string, unknown>;
  return {
    x: clampCropNumber(record.x, 0, 100, 50),
    y: clampCropNumber(record.y, 0, 100, 50),
    zoom: clampCropNumber(record.zoom, 0.25, 3, 1),
    brightness: clampCropNumber(record.brightness ?? 1, 0.5, 1.5, 1),
    saturation: clampCropNumber(record.saturation ?? 1, 0, 2, 1),
    aspectRatio: clampCropNumber(record.aspectRatio ?? 4 / 3, 0.1, 10, 4 / 3)
  };
}

function clampCropNumber(value: unknown, min: number, max: number, fallback: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
}

export async function toggleFollowAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to follow creators." };
  }

  const rate = await checkServerActionRateLimit([
    { key: "follow-toggle:ip:{ip}", limit: 60, intervalMs: 60_000 },
    { key: `follow-toggle:user:${session.user.id}`, limit: 30, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before following more profiles." };
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
  revalidatePath("/my-parties");
  revalidatePath("/parties");
  revalidatePath("/explore");
  revalidatePath("/");
  const vendorProfiles = await db.vendorProfile.findMany({
    where: { userId: followingId },
    select: { slug: true }
  });
  vendorProfiles.forEach((vendorProfile) => {
    revalidatePath(`/vendor/profile/${vendorProfile.slug}`);
    revalidatePath(`/${vendorProfile.slug}`);
  });
  return { ok: true };
}

export async function followPartyVendorAction(vendorId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to follow vendors." };
  const rate = await checkServerActionRateLimit([
    { key: `party-vendor-follow:user:${session.user.id}`, limit: 30, intervalMs: 60_000 }
  ]);
  if (!rate.ok) return { ok: false, error: "Please wait a minute before following more vendors." };
  const vendor = await db.vendorProfile.findUnique({ where: { id: vendorId }, select: { userId: true, status: true, slug: true } });
  if (!vendor?.userId || vendor.status === "UNCLAIMED") return { ok: false, error: "This vendor hasn’t claimed their profile yet." };
  if (vendor.userId === session.user.id) return { ok: false, error: "This is your own vendor profile." };
  await db.follow.upsert({
    where: { followerId_followingId: { followerId: session.user.id, followingId: vendor.userId } },
    create: { followerId: session.user.id, followingId: vendor.userId }, update: {}
  });
  revalidatePath("/parties");
  revalidatePath("/account");
  revalidatePath("/explore");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  revalidatePath(`/${vendor.slug}`);
  return { ok: true };
}
