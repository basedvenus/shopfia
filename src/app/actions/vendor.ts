"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CategoryAudience, OffsiteAdsTier, Prisma, UserRole, VendorProfileStatus } from "@prisma/client";
import { z } from "zod";
import { requireRole, requireSession, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { parseImageCrop, parseImageCropArray } from "@/lib/image-crop";
import { securityLog } from "@/lib/security/audit-log";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { createListing, ensureSellerAccountForVendorProfile } from "@/lib/services/marketplace-fees";
import { vendorOnboardingSchema, offeringSchema } from "@/lib/validators/vendor";
import { friendlyValidationMessage } from "@/lib/validators/messages";

function formDataToArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function firstFormValue(formData: FormData, ...keys: string[]) {
  for (const key of keys) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) return value;
  }
  return undefined;
}

function slugify(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const UNCLAIMED_VENDOR_CATEGORIES = [
  "Backdrops",
  "Balloons",
  "Cakes & Desserts",
  "Catering",
  "Children's Entertainment",
  "Entertainment",
  "Florals",
  "Party Rentals",
  "Styling & Decor"
] as const;

const unclaimedVendorSchema = z.object({
  name: z.string().trim().min(2, "Business Name is required.").max(120, "Business Name is too long."),
  instagramHandle: z.string().trim().max(80).optional(),
  website: z.string().trim().max(255).optional(),
  categories: z.array(z.enum(UNCLAIMED_VENDOR_CATEGORIES)).min(1, "Choose at least one category.").max(9, "Choose up to 9 categories.")
});

export async function createUnclaimedVendorAction(input: {
  categories?: string[];
  category?: string;
  instagramHandle?: string;
  name: string;
  website?: string;
}) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const rate = await checkServerActionRateLimit([
    { key: "unclaimed-vendor:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `unclaimed-vendor:user:${session.user.id}`, limit: 10, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Please wait a minute before adding another vendor." };
  }

  const parsed = unclaimedVendorSchema.safeParse({
    ...input,
    categories: input.categories?.length ? input.categories : input.category ? [input.category] : []
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: firstValidationMessage(parsed.error, {
        name: "Business Name",
        instagramHandle: "Instagram Handle",
        website: "Website",
        categories: "Categories"
      })
    };
  }

  const categoryRecords = await Promise.all(
    parsed.data.categories.map((name) =>
      db.category.upsert({
        where: { name },
        update: { audience: CategoryAudience.VENDOR },
        create: {
          name,
          iconName: "Sparkles",
          audience: CategoryAudience.VENDOR
        }
      })
    )
  );
  const baseSlug = slugify(parsed.data.name) || "vendor";
  const slug = await getAvailableVendorSlug(baseSlug);
  const website = normalizeOptionalUrl(parsed.data.website);
  const instagramUrl = normalizeInstagramUrl(parsed.data.instagramHandle);

  const vendor = await db.vendorProfile.create({
    data: {
      name: parsed.data.name,
      slug,
      status: VendorProfileStatus.UNCLAIMED,
      website,
      instagramUrl,
      bio: "This business was tagged by the ShopFia community and has not claimed their profile yet.",
      city: "",
      verified: false,
      categories: {
        create: categoryRecords.map((category) => ({ categoryId: category.id }))
      }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      username: true,
      city: true,
      state: true,
      logoUrl: true,
      status: true
    }
  });

  revalidatePath("/my-parties");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  return { ok: true, vendor };
}

export async function claimUnclaimedVendorAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const vendorId = String(formData.get("vendorId") ?? "");
  if (!vendorId) redirect("/onboarding");

  const unclaimedVendor = await db.vendorProfile.findFirst({
    where: { id: vendorId, status: VendorProfileStatus.UNCLAIMED },
    include: {
      categories: true,
      taggedPartyEvents: { select: { id: true } },
      taggedPartyPhotos: { select: { id: true } },
      partyPhotoRatings: { select: { id: true, photoId: true, rating: true, userId: true } }
    }
  });
  if (!unclaimedVendor) redirect("/onboarding");

  const destination = await db.$transaction(async (tx) => {
    const existingVendor = await tx.vendorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, slug: true }
    });

    if (!existingVendor) {
      return tx.vendorProfile.update({
        where: { id: unclaimedVendor.id },
        data: {
          userId: session.user.id,
          status: VendorProfileStatus.CLAIMED,
          claimedAt: new Date()
        },
        select: { id: true, slug: true }
      });
    }

    for (const category of unclaimedVendor.categories) {
      await tx.vendorCategory.upsert({
        where: {
          vendorId_categoryId: {
            vendorId: existingVendor.id,
            categoryId: category.categoryId
          }
        },
        update: {},
        create: {
          vendorId: existingVendor.id,
          categoryId: category.categoryId
        }
      });
    }

    for (const event of unclaimedVendor.taggedPartyEvents) {
      await tx.partyEvent.update({
        where: { id: event.id },
        data: {
          taggedVendors: {
            connect: { id: existingVendor.id },
            disconnect: { id: unclaimedVendor.id }
          }
        }
      });
    }

    for (const photo of unclaimedVendor.taggedPartyPhotos) {
      await tx.partyPhoto.update({
        where: { id: photo.id },
        data: {
          taggedVendors: {
            connect: { id: existingVendor.id },
            disconnect: { id: unclaimedVendor.id }
          }
        }
      });
    }

    for (const rating of unclaimedVendor.partyPhotoRatings) {
      const existingRating = await tx.partyPhotoVendorRating.findUnique({
        where: {
          photoId_vendorId: {
            photoId: rating.photoId,
            vendorId: existingVendor.id
          }
        },
        select: { id: true }
      });
      if (existingRating) {
        await tx.partyPhotoVendorRating.delete({ where: { id: rating.id } });
      } else {
        await tx.partyPhotoVendorRating.update({
          where: { id: rating.id },
          data: { vendorId: existingVendor.id }
        });
      }
    }

    await tx.vendorProfile.delete({ where: { id: unclaimedVendor.id } });
    return existingVendor;
  });

  revalidatePath(`/vendor/profile/${unclaimedVendor.slug}`);
  revalidatePath(`/vendor/profile/${destination.slug}`);
  revalidatePath("/my-parties");
  redirect(`/vendor/profile/${destination.slug}`);
}

async function getAvailableVendorSlug(baseSlug: string) {
  const { db } = await import("@/lib/db");
  const candidates = [
    baseSlug,
    `${baseSlug}-${Date.now().toString(36).slice(-4)}`,
    `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
  ];
  for (const candidate of candidates) {
    const existing = await db.vendorProfile.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

function normalizeOptionalUrl(value?: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeInstagramUrl(value?: string) {
  const trimmed = String(value ?? "").trim().replace(/^@/, "");
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://instagram.com/${trimmed}`;
}

function dollarsToCents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/[$,]/g, "").trim();
  if (!normalized) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function parseJsonStringArray(value: FormDataEntryValue | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : [];
  } catch {
    return [];
  }
}

function formDataToPricedOptions(formData: FormData, prefix: "package" | "addon") {
  const names = formData.getAll(`${prefix}Names`).map((value) => String(value).trim());
  const descriptions = formData.getAll(`${prefix}Descriptions`).map((value) => String(value).trim());
  const prices = formData.getAll(`${prefix}Prices`);
  const componentIdGroups = formData.getAll(`${prefix}ComponentIds`);
  const addonComponentIdGroups = formData.getAll(`${prefix}AddonComponentIds`);

  return names
    .map((name, index) => ({
      name,
      description: descriptions[index] ?? "",
      priceCents: dollarsToCents(prices[index] ?? null),
      componentIds: parseJsonStringArray(componentIdGroups[index] ?? null),
      addonComponentIds: parseJsonStringArray(addonComponentIdGroups[index] ?? null)
    }))
    .filter((option) => option.name);
}

function formDataToServiceComponents(formData: FormData) {
  const titles = formData.getAll("componentTitles").map((value) => String(value).trim());
  const ids = formData.getAll("componentIds").map((value) => String(value).trim());
  const descriptions = formData.getAll("componentDescriptions").map((value) => String(value).trim());
  const prices = formData.getAll("componentPrices");
  const categories = formData.getAll("componentCategories").map((value) => String(value).trim());

  return titles
    .map((title, index) => ({
      id: ids[index] || slugify(title) || `component-${index + 1}`,
      title,
      description: descriptions[index] ?? "",
      priceCents: dollarsToCents(prices[index] ?? null),
      category: categories[index] ?? ""
    }))
    .filter((component) => component.title);
}

function redirectWithVendorProfileError(message: string): never {
  redirect(`/onboarding?profileError=${encodeURIComponent(message)}#profile`);
}

function redirectWithOfferingError(message: string): never {
  redirect(`/onboarding?offeringError=${encodeURIComponent(message)}#services`);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function firstValidationMessage(
  error: { issues: Array<{ path: Array<string | number>; message: string }> },
  labels: Record<string, string>
) {
  return friendlyValidationMessage(error.issues, labels);
}

export async function upsertVendorProfileAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const rate = await checkServerActionRateLimit([
    { key: "vendor-profile:ip:{ip}", limit: 18, intervalMs: 60_000 },
    { key: `vendor-profile:user:${session.user.id}`, limit: 8, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    redirectWithVendorProfileError("Please wait a minute before saving your vendor profile again.");
  }

  const vendorUsername = String(formData.get("username") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  const result = vendorOnboardingSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(vendorUsername || formData.get("name")),
    username: vendorUsername,
    website: formData.get("website") || undefined,
    instagramUrl: formData.get("instagramUrl") || undefined,
    tiktokUrl: formData.get("tiktokUrl") || undefined,
    bio: formData.get("bio"),
    formattedAddress: firstFormValue(formData, "formattedAddress", "locationFormattedAddress"),
    city: firstFormValue(formData, "locationCity", "city"),
    state: firstFormValue(formData, "locationState", "state"),
    zipCode: firstFormValue(formData, "locationZipCode", "zipCode"),
    locationLat: firstFormValue(formData, "locationLat"),
    locationLng: firstFormValue(formData, "locationLng"),
    googlePlaceId: firstFormValue(formData, "googlePlaceId", "locationPlaceId"),
    serviceRadiusMiles: formData.get("serviceRadiusMiles") || undefined,
    weekendAvailable: formData.get("weekendAvailable") === "on",
    serviceAreaNotes: formData.get("serviceAreaNotes"),
    availabilityNotes: formData.get("availabilityNotes") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    categoryIds: formDataToArray(formData, "categoryIds"),
    photoUrls: formDataToArray(formData, "photoUrls")
  });
  if (!result.success) {
    securityLog("vendor_profile_validation_failed", { userId: session.user.id });
    redirectWithVendorProfileError(
      firstValidationMessage(result.error, {
        name: "Business Name",
        city: "City",
        slug: "Vendor Username",
        username: "Vendor Username",
        website: "Website",
        instagramUrl: "Instagram Link",
        tiktokUrl: "TikTok Link",
        photoUrls: "Cover/banner image"
      })
    );
  }
  const parsed = result.data;
  const logoCrop = parseImageCrop(formData.get("logoUrlCrop"));
  const photoCrops = parseImageCropArray(formData.getAll("photoUrlsCrop"));
  const coverPhotoCrop = photoCrops[0] ?? logoCrop;

  let vendor;
  try {
    vendor = await db.vendorProfile.upsert({
      where: { userId: session.user.id },
      update: {
        name: parsed.name,
        status: VendorProfileStatus.CLAIMED,
        slug: parsed.slug,
        username: parsed.username || null,
        website: parsed.website || null,
        instagramUrl: parsed.instagramUrl || null,
        tiktokUrl: parsed.tiktokUrl || null,
        bio: parsed.bio || null,
        formattedAddress: parsed.formattedAddress || null,
        city: parsed.city,
        state: parsed.state || null,
        zipCode: parsed.zipCode || null,
        locationLat: parsed.locationLat ?? null,
        locationLng: parsed.locationLng ?? null,
        googlePlaceId: parsed.googlePlaceId || null,
        serviceRadiusMiles: parsed.serviceRadiusMiles,
        weekendAvailable: parsed.weekendAvailable,
        serviceAreaNotes: parsed.serviceAreaNotes || null,
        availabilityNotes: parsed.availabilityNotes || null,
        logoUrl: parsed.logoUrl || null,
        logoCrop: logoCrop ?? Prisma.JsonNull,
        photos: parsed.photoUrls,
        photoCrops,
        coverPhoto: parsed.photoUrls[0] ?? parsed.logoUrl ?? null,
        coverPhotoCrop: coverPhotoCrop ?? Prisma.JsonNull
      },
      create: {
        userId: session.user.id,
        status: VendorProfileStatus.CLAIMED,
        claimedAt: new Date(),
        name: parsed.name,
        slug: parsed.slug,
        username: parsed.username || null,
        website: parsed.website || null,
        instagramUrl: parsed.instagramUrl || null,
        tiktokUrl: parsed.tiktokUrl || null,
        bio: parsed.bio || null,
        formattedAddress: parsed.formattedAddress || null,
        city: parsed.city,
        state: parsed.state || null,
        zipCode: parsed.zipCode || null,
        locationLat: parsed.locationLat ?? null,
        locationLng: parsed.locationLng ?? null,
        googlePlaceId: parsed.googlePlaceId || null,
        serviceRadiusMiles: parsed.serviceRadiusMiles,
        weekendAvailable: parsed.weekendAvailable,
        serviceAreaNotes: parsed.serviceAreaNotes || null,
        availabilityNotes: parsed.availabilityNotes || null,
        logoUrl: parsed.logoUrl || null,
        logoCrop: logoCrop ?? Prisma.JsonNull,
        photos: parsed.photoUrls,
        photoCrops,
        coverPhoto: parsed.photoUrls[0] ?? parsed.logoUrl ?? null,
        coverPhotoCrop: coverPhotoCrop ?? Prisma.JsonNull
      }
    });
  } catch (error) {
    securityLog("vendor_profile_upsert_failed", {
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown",
      userId: session.user.id
    });
    redirectWithVendorProfileError(
      isUniqueConstraintError(error)
        ? "That vendor username or shop username is already taken."
        : "Your vendor profile could not be saved. Please try again."
    );
  }

  const validVendorCategoryCount = await db.category.count({
    where: { id: { in: parsed.categoryIds }, audience: CategoryAudience.VENDOR }
  });
  if (validVendorCategoryCount !== parsed.categoryIds.length) {
    redirectWithVendorProfileError("One or more selected categories are invalid for vendors.");
  }

  await db.vendorCategory.deleteMany({ where: { vendorId: vendor.id } });
  if (parsed.categoryIds.length > 0) {
    await db.vendorCategory.createMany({
      data: parsed.categoryIds.map((categoryId) => ({ vendorId: vendor.id, categoryId })),
      skipDuplicates: true
    });
  }

  if (session.user.role === UserRole.BUYER) {
    await db.user.update({
      where: { id: session.user.id },
      data: { role: UserRole.VENDOR }
    });
  }

  try {
    await ensureSellerAccountForVendorProfile(vendor.id);
  } catch (error) {
    securityLog("vendor_seller_account_sync_failed", {
      error: error instanceof Error ? error.message : "unknown",
      vendorId: vendor.id,
      userId: session.user.id
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  redirect("/vendor/dashboard");
}

export async function upsertOfferingAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const rate = await checkServerActionRateLimit([
    { key: "vendor-offering:ip:{ip}", limit: 24, intervalMs: 60_000 },
    { key: `vendor-offering:user:${session.user.id}`, limit: 10, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    redirectWithOfferingError("Please wait a minute before saving another offering.");
  }

  const vendor = await db.vendorProfile.findUnique({
    where: { userId: session.user.id }
  });
  if (!vendor) throw new Error("Create vendor profile first");

  const result = offeringSchema.safeParse({
    id: formData.get("id") || undefined,
    type: formData.get("type"),
    title: formData.get("title"),
    slug: formData.get("slug") || slugify(formData.get("title")),
    description: formData.get("description"),
    basePriceCents: formData.get("basePriceCents") || dollarsToCents(formData.get("startingPrice")) || undefined,
    messageForPricing: formData.get("messageForPricing") === "on",
    categoryId: formData.get("categoryId") || undefined,
    categoryIds: formDataToArray(formData, "categoryIds"),
    eventCategoryIds: formDataToArray(formData, "eventCategoryIds"),
    tags: [],
    photos: formDataToArray(formData, "photos"),
    serviceComponents: formDataToServiceComponents(formData),
    packages: formDataToPricedOptions(formData, "package"),
    addons: [],
    durationMinutes: formData.get("durationMinutes") || undefined,
    turnaroundDays: formData.get("turnaroundDays") || undefined,
    inventoryCount: formData.get("inventoryCount") || undefined,
    allowInstantBook: formData.get("allowInstantBook") === "on",
    autoRenewListing: formData.get("autoRenewListing") === "on"
  });
  if (!result.success) {
    securityLog("vendor_offering_validation_failed", { userId: session.user.id });
    redirectWithOfferingError(
      firstValidationMessage(result.error, {
        type: "Offering Type",
        title: "Offering Title",
        description: "Description",
        categoryIds: "Service Categories",
        photos: "Offering photo",
        basePriceCents: "Starting price"
      })
    );
  }
  const parsed = result.data;
  const photoCrops = parseImageCropArray(formData.getAll("photosCrop"));
  const uniqueCategoryIds = [...new Set(parsed.categoryIds)];
  const primaryCategoryId = parsed.categoryId && uniqueCategoryIds.includes(parsed.categoryId)
    ? parsed.categoryId
    : uniqueCategoryIds[0];

  const offeringCategories = await db.category.findMany({
    where: { id: { in: uniqueCategoryIds }, audience: CategoryAudience.VENDOR },
    select: { id: true, name: true }
  });
  if (!primaryCategoryId || offeringCategories.length !== uniqueCategoryIds.length) {
    redirectWithOfferingError("Choose at least one valid service category.");
  }
  const offeringCategory = offeringCategories.find((category) => category.id === primaryCategoryId) ?? offeringCategories[0];

  const uniqueEventCategoryIds = [...new Set(parsed.eventCategoryIds)];
  const validEventCategoryCount = uniqueEventCategoryIds.length
    ? await db.category.count({
        where: { id: { in: uniqueEventCategoryIds }, audience: CategoryAudience.BUYER }
      })
    : 0;
  if (validEventCategoryCount !== uniqueEventCategoryIds.length) {
    redirectWithOfferingError("One or more selected event types are invalid.");
  }

  const payload = {
    vendorId: vendor.id,
    type: parsed.type,
    title: parsed.title,
    slug: parsed.slug,
    description: parsed.description,
    basePriceCents: parsed.messageForPricing ? null : parsed.basePriceCents ?? null,
    messageForPricing: parsed.messageForPricing,
    categoryId: primaryCategoryId,
    tags: [],
    photos: parsed.photos,
    photoCrops,
    variantsJson: parsed.packages,
    addonsJson: parsed.addons,
    faqJson: {
      serviceComponents: parsed.serviceComponents
    },
    durationMinutes: parsed.durationMinutes ?? null,
    turnaroundDays: parsed.turnaroundDays ?? null,
    inventoryCount: parsed.type === "PRODUCT" ? (parsed.inventoryCount ?? null) : null,
    allowInstantBook: parsed.allowInstantBook
  };

  let offeringId = parsed.id;

  if (parsed.id) {
    const existing = await db.offering.findUnique({ where: { id: parsed.id } });
    if (!existing || existing.vendorId !== vendor.id) throw new Error("Offering not found");
    await db.offering.update({ where: { id: parsed.id }, data: payload });
  } else {
    const offering = await db.offering.create({ data: payload });
    offeringId = offering.id;
  }

  if (!offeringId) {
    throw new Error("Offering could not be saved");
  }

  await db.offeringCategory.deleteMany({ where: { offeringId } });
  await db.offeringCategory.createMany({
    data: uniqueCategoryIds.map((categoryId) => ({ offeringId, categoryId })),
    skipDuplicates: true
  });

  await db.offeringEventCategory.deleteMany({ where: { offeringId } });
  if (uniqueEventCategoryIds.length > 0) {
    await db.offeringEventCategory.createMany({
      data: uniqueEventCategoryIds.map((categoryId) => ({ offeringId, categoryId })),
      skipDuplicates: true
    });
  }

  const minPrice = await db.offering.findFirst({
    where: { vendorId: vendor.id, active: true, messageForPricing: false, basePriceCents: { not: null } },
    orderBy: { basePriceCents: "asc" },
    select: { basePriceCents: true }
  });

  await db.vendorProfile.update({
    where: { id: vendor.id },
    data: { startingPriceCents: minPrice?.basePriceCents ?? null }
  });

  await createListing({
    vendorProfileId: vendor.id,
    offeringId,
    title: parsed.title,
    category: offeringCategory.name,
    description: parsed.description,
    priceFrom: parsed.messageForPricing ? null : parsed.basePriceCents ?? null,
    city: vendor.city,
    state: vendor.state,
    zipCode: vendor.zipCode,
    formattedAddress: vendor.formattedAddress,
    locationLat: vendor.locationLat,
    locationLng: vendor.locationLng,
    googlePlaceId: vendor.googlePlaceId,
    quantity: parsed.type === "PRODUCT" ? parsed.inventoryCount ?? 1 : 1,
    autoRenew: parsed.autoRenewListing,
    publish: true
  });

  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/offering/${offeringId}`);
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  revalidatePath(`/offering/${offeringId}`);
  revalidatePath("/listings");
  revalidatePath("/explore");
  revalidatePath("/categories");
  redirect("/vendor/dashboard#services");
}

export async function updateSellerMarketplaceSettingsAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  if (session.user.role === UserRole.VENDOR) {
    await requireVerifiedVendorProfile(session.user.id);
  }
  const vendor = await db.vendorProfile.findUnique({
    where: { userId: session.user.id }
  });
  if (!vendor) throw new Error("Create vendor profile first");

  const { seller } = await ensureSellerAccountForVendorProfile(vendor.id);
  const offsiteAdsTier =
    String(formData.get("offsiteAdsTier")) === OffsiteAdsTier.HIGH_VOLUME
      ? OffsiteAdsTier.HIGH_VOLUME
      : OffsiteAdsTier.STANDARD;

  await db.seller.update({
    where: { id: seller.id },
    data: {
      offsiteAdsEnabled: formData.get("offsiteAdsEnabled") === "on",
      offsiteAdsTier
    }
  });

  revalidatePath("/vendor/dashboard");
}
