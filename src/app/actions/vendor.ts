"use server";

import { revalidatePath } from "next/cache";
import { CategoryAudience, OffsiteAdsTier, UserRole } from "@prisma/client";
import { requireRole, requireSession, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { createListing, ensureSellerAccountForVendorProfile } from "@/lib/services/marketplace-fees";
import { vendorOnboardingSchema, offeringSchema } from "@/lib/validators/vendor";

function formDataToArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
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

function formDataToPricedOptions(formData: FormData, prefix: "package" | "addon") {
  const names = formDataToArray(formData, `${prefix}Names`);
  const descriptions = formData.getAll(`${prefix}Descriptions`).map((value) => String(value).trim());
  const prices = formData.getAll(`${prefix}Prices`);

  return names.map((name, index) => ({
    name,
    description: descriptions[index] ?? "",
    priceCents: dollarsToCents(prices[index] ?? null)
  }));
}

export async function upsertVendorProfileAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const vendorUsername = String(formData.get("username") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  const parsed = vendorOnboardingSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(vendorUsername || formData.get("name")),
    username: vendorUsername || undefined,
    website: formData.get("website") || undefined,
    instagramUrl: formData.get("instagramUrl") || undefined,
    tiktokUrl: formData.get("tiktokUrl") || undefined,
    bio: formData.get("bio"),
    city: formData.get("city"),
    state: formData.get("state"),
    zipCode: formData.get("zipCode"),
    serviceRadiusMiles: formData.get("serviceRadiusMiles") || undefined,
    weekendAvailable: formData.get("weekendAvailable") === "on",
    serviceAreaNotes: formData.get("serviceAreaNotes"),
    availabilityNotes: formData.get("availabilityNotes") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    categoryIds: formDataToArray(formData, "categoryIds"),
    photoUrls: formDataToArray(formData, "photoUrls")
  });

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
        city: parsed.city,
        state: parsed.state || null,
        zipCode: parsed.zipCode || null,
        serviceRadiusMiles: parsed.serviceRadiusMiles,
        weekendAvailable: parsed.weekendAvailable,
        serviceAreaNotes: parsed.serviceAreaNotes || null,
        availabilityNotes: parsed.availabilityNotes || null,
        logoUrl: parsed.logoUrl || null,
        photos: parsed.photoUrls,
        coverPhoto: parsed.photoUrls[0] ?? parsed.logoUrl ?? null
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
        city: parsed.city,
        state: parsed.state || null,
        zipCode: parsed.zipCode || null,
        serviceRadiusMiles: parsed.serviceRadiusMiles,
        weekendAvailable: parsed.weekendAvailable,
        serviceAreaNotes: parsed.serviceAreaNotes || null,
        availabilityNotes: parsed.availabilityNotes || null,
        logoUrl: parsed.logoUrl || null,
        photos: parsed.photoUrls,
        coverPhoto: parsed.photoUrls[0] ?? parsed.logoUrl ?? null
      }
    });
  } catch {
    throw new Error("That vendor username is already taken.");
  }

  const validVendorCategoryCount = await db.category.count({
    where: { id: { in: parsed.categoryIds }, audience: CategoryAudience.VENDOR }
  });
  if (validVendorCategoryCount !== parsed.categoryIds.length) {
    throw new Error("One or more selected categories are invalid for vendors");
  }

  await db.vendorCategory.deleteMany({ where: { vendorId: vendor.id } });
  await db.vendorCategory.createMany({
    data: parsed.categoryIds.map((categoryId) => ({ vendorId: vendor.id, categoryId })),
    skipDuplicates: true
  });

  if (session.user.role === UserRole.BUYER) {
    await db.user.update({
      where: { id: session.user.id },
      data: { role: UserRole.VENDOR }
    });
  }

  await ensureSellerAccountForVendorProfile(vendor.id);

  revalidatePath("/onboarding");
  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
}

export async function upsertOfferingAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  const vendor = await db.vendorProfile.findUnique({
    where: { userId: session.user.id }
  });
  if (!vendor) throw new Error("Create vendor profile first");

  const parsed = offeringSchema.parse({
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
    packages: formDataToPricedOptions(formData, "package"),
    addons: formDataToPricedOptions(formData, "addon"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    turnaroundDays: formData.get("turnaroundDays") || undefined,
    inventoryCount: formData.get("inventoryCount") || undefined,
    allowInstantBook: formData.get("allowInstantBook") === "on",
    autoRenewListing: formData.get("autoRenewListing") === "on"
  });

  const offeringCategory = await db.category.findFirst({
    where: { id: parsed.categoryId, audience: CategoryAudience.VENDOR },
    select: { id: true, name: true }
  });
  if (!offeringCategory) {
    throw new Error("Offering category must be a vendor category");
  }

  const uniqueEventCategoryIds = [...new Set(parsed.eventCategoryIds)];
  const validEventCategoryCount = uniqueEventCategoryIds.length
    ? await db.category.count({
        where: { id: { in: uniqueEventCategoryIds }, audience: CategoryAudience.BUYER }
      })
    : 0;
  if (validEventCategoryCount !== uniqueEventCategoryIds.length) {
    throw new Error("Event types must be Shop by Event categories");
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
    variantsJson: parsed.packages,
    addonsJson: parsed.addons,
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
    quantity: parsed.type === "PRODUCT" ? parsed.inventoryCount ?? 1 : 1,
    autoRenew: parsed.autoRenewListing,
    publish: true
  });

  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  revalidatePath("/explore");
  revalidatePath("/categories");
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
