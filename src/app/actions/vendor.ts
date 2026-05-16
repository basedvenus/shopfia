"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CategoryAudience, OffsiteAdsTier, Prisma, UserRole } from "@prisma/client";
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

  return names
    .map((name, index) => ({
      name,
      description: descriptions[index] ?? "",
      priceCents: dollarsToCents(prices[index] ?? null),
      componentIds: parseJsonStringArray(componentIdGroups[index] ?? null)
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
    categoryId: formData.get("categoryId"),
    eventCategoryIds: formDataToArray(formData, "eventCategoryIds"),
    tags: formDataToArray(formData, "tags"),
    photos: formDataToArray(formData, "photos"),
    serviceComponents: formDataToServiceComponents(formData),
    packages: formDataToPricedOptions(formData, "package"),
    addons: formDataToPricedOptions(formData, "addon"),
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
        categoryId: "Service Category",
        photos: "Offering photo",
        basePriceCents: "Starting price"
      })
    );
  }
  const parsed = result.data;
  const photoCrops = parseImageCropArray(formData.getAll("photosCrop"));

  const offeringCategory = await db.category.findFirst({
    where: { id: parsed.categoryId, audience: CategoryAudience.VENDOR },
    select: { id: true, name: true }
  });
  if (!offeringCategory) {
    redirectWithOfferingError("Service Category is required");
  }

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
    categoryId: parsed.categoryId,
    tags: parsed.tags.map((t) => t.toLowerCase()),
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
