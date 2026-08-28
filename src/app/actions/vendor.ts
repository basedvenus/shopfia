"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CategoryAudience, OffsiteAdsTier, Prisma, UserRole, VendorProfileStatus, VerificationDocumentType } from "@prisma/client";
import { z } from "zod";
import { requireRole, requireSession, requireVerifiedVendorProfile } from "@/lib/auth/guards";
import { parseImageCrop, parseImageCropArray } from "@/lib/image-crop";
import { securityLog } from "@/lib/security/audit-log";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { createListing, ensureSellerAccountForVendorProfile } from "@/lib/services/marketplace-fees";
import { storefrontCustomizationSchema, vendorOnboardingSchema, offeringSchema } from "@/lib/validators/vendor";
import { friendlyValidationMessage } from "@/lib/validators/messages";
import {
  isReservedStorefrontSlug,
  sanitizeHiddenStorefrontSections,
  sanitizeStorefrontSectionLabels,
  sanitizeStorefrontSections,
  slugifyBusinessUrl,
  storefrontAccentColorFromPalette,
  normalizeStorefrontPalette,
  storefrontPath,
  businessManagerWhere
} from "@/lib/businesses";

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

function normalizeBusinessName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const UNCLAIMED_VENDOR_CATEGORIES = [
  "Backdrops",
  "Balloons",
  "Cakes & Desserts",
  "Catering & Beverages",
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

    const claimedVendor = await tx.vendorProfile.update({
      where: { id: unclaimedVendor.id },
      data: {
        userId: existingVendor ? null : session.user.id,
        status: VendorProfileStatus.CLAIMED,
        claimedAt: new Date()
      },
      select: { id: true, slug: true }
    });

    await tx.vendorProfileManager.upsert({
      where: {
        vendorProfileId_userId: {
          vendorProfileId: claimedVendor.id,
          userId: session.user.id
        }
      },
      update: { role: "OWNER" },
      create: {
        role: "OWNER",
        userId: session.user.id,
        vendorProfileId: claimedVendor.id
      }
    });

    return claimedVendor;
  });

  revalidatePath(`/vendor/profile/${unclaimedVendor.slug}`);
  revalidatePath(`/vendor/profile/${destination.slug}`);
  revalidatePath("/my-parties");
  redirect(`/vendor/dashboard/${destination.slug}`);
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

function parseEditorJson(value: string | undefined) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

type StorefrontEditorService = {
  active?: boolean;
  basePriceCents?: number | null;
  categoryId?: string | null;
  description?: string;
  featured?: boolean;
  id?: string;
  clientId?: string;
  messageForPricing?: boolean;
  photos?: string[];
  title?: string;
  turnaroundDays?: number | null;
};

function parseEditorServices(value: string | undefined): StorefrontEditorService[] {
  const parsed = parseEditorJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      active: item.active !== false,
      basePriceCents: typeof item.basePriceCents === "number" ? Math.max(0, Math.round(item.basePriceCents)) : null,
      categoryId: typeof item.categoryId === "string" ? item.categoryId : null,
      clientId: typeof item.clientId === "string" ? item.clientId : undefined,
      description: typeof item.description === "string" ? item.description.trim().slice(0, 4000) : "",
      featured: item.featured === true,
      id: typeof item.id === "string" && z.string().cuid().safeParse(item.id).success ? item.id : undefined,
      messageForPricing: Boolean(item.messageForPricing),
      photos: Array.isArray(item.photos)
        ? item.photos.filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0).slice(0, 10)
        : [],
      title: typeof item.title === "string" ? item.title.trim().slice(0, 120) : "",
      turnaroundDays: typeof item.turnaroundDays === "number" ? Math.max(0, Math.round(item.turnaroundDays)) : null
    }))
    .filter((item) => item.title && item.description.length >= 10);
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

function redirectWithVendorProfileError(message: string, options?: { newBusiness?: boolean }): never {
  const params = new URLSearchParams({ profileError: message });
  if (options?.newBusiness) {
    params.set("newBusiness", "1");
  }
  redirect(`/onboarding?${params.toString()}#profile`);
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

const storefrontCustomizeLabels = {
  name: "Business name",
  tagline: "Tagline",
  bio: "About Our Business",
  aboutHeading: "About heading",
  aboutImage: "About image",
  city: "City",
  logoUrl: "Logo",
  coverPhoto: "Cover image",
  photoUrls: "Portfolio photos",
  website: "Website",
  instagramUrl: "Instagram Link",
  tiktokUrl: "TikTok Link"
};

type StorefrontCustomizationInput = z.infer<typeof storefrontCustomizationSchema>;

function storefrontCustomizationPayloadFromFormData(formData: FormData) {
  return {
    businessId: formData.get("businessId"),
    intent: formData.get("intent") || "publish",
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state") || undefined,
    tagline: formData.get("tagline") || undefined,
    bio: formData.get("bio") || undefined,
    aboutHeading: formData.get("aboutHeading") || undefined,
    aboutImage: formData.get("aboutImage") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    coverPhoto: formData.get("coverPhoto") || undefined,
    photoUrls: formDataToArray(formData, "photoUrls"),
    serviceAreaNotes: formData.get("serviceAreaNotes") || undefined,
    availabilityNotes: formData.get("availabilityNotes") || undefined,
    website: formData.get("website") || undefined,
    instagramUrl: formData.get("instagramUrl") || undefined,
    tiktokUrl: formData.get("tiktokUrl") || undefined,
    layout: formData.get("layout"),
    fontStyle: formData.get("fontStyle"),
    palette: formData.get("palette"),
    buttonStyle: formData.get("buttonStyle"),
    imageShape: formData.get("imageShape"),
    textTone: formData.get("textTone") || "AUTO",
    sectionOrder: formDataToArray(formData, "sectionOrder"),
    hiddenSections: formDataToArray(formData, "hiddenSections"),
    sectionLabelsJson: formData.get("sectionLabelsJson") || undefined,
    faqJson: formData.get("faqJson") || undefined,
    policiesJson: formData.get("policiesJson") || undefined,
    bookingJson: formData.get("bookingJson") || undefined,
    featuredOfferingIds: formDataToArray(formData, "featuredOfferingIds"),
    offeringOrder: formDataToArray(formData, "offeringOrder"),
    servicesJson: formData.get("servicesJson") || undefined
  };
}

function prepareStorefrontCustomizationPayload(parsed: StorefrontCustomizationInput, existingOfferingIds: string[]) {
  const sanitizedSectionOrder = sanitizeStorefrontSections(parsed.sectionOrder);
  const sanitizedHiddenSections = sanitizeHiddenStorefrontSections(parsed.hiddenSections);
  const sanitizedSectionLabels = sanitizeStorefrontSectionLabels(parseEditorJson(parsed.sectionLabelsJson));
  const storefrontPalette = normalizeStorefrontPalette(parsed.palette);
  const editorServices = parseEditorServices(parsed.servicesJson);
  const hiddenOfferingIds = editorServices
    .filter((service) => service.active === false && service.id && existingOfferingIds.includes(service.id))
    .map((service) => service.id as string);
  const draftPayload = JSON.parse(JSON.stringify({
    aboutHeading: parsed.aboutHeading || "",
    aboutImage: parsed.aboutImage || "",
    availabilityNotes: parsed.availabilityNotes || "",
    bio: parsed.bio || "",
    booking: parseEditorJson(parsed.bookingJson) ?? {},
    buttonStyle: parsed.buttonStyle,
    city: parsed.city,
    coverPhoto: parsed.coverPhoto || "",
    faqs: parseEditorJson(parsed.faqJson) ?? [],
    featuredOfferingIds: parsed.featuredOfferingIds,
    fontStyle: parsed.fontStyle,
    hiddenSections: sanitizedHiddenSections,
    hiddenOfferingIds,
    imageShape: parsed.imageShape,
    instagramUrl: parsed.instagramUrl || "",
    layout: parsed.layout,
    logoUrl: parsed.logoUrl || "",
    name: parsed.name,
    offeringOrder: parsed.offeringOrder,
    palette: storefrontPalette,
    textTone: parsed.textTone,
    photoUrls: parsed.photoUrls,
    policies: parseEditorJson(parsed.policiesJson) ?? [],
    sectionLabels: sanitizedSectionLabels,
    sectionOrder: sanitizedSectionOrder,
    serviceAreaNotes: parsed.serviceAreaNotes || "",
    services: editorServices.map((service) => ({
      active: service.active !== false,
      basePriceCents: service.basePriceCents ?? null,
      categoryId: service.categoryId ?? null,
      clientId: service.clientId ?? service.id ?? "",
      description: service.description ?? "",
      featured: service.active !== false && parsed.featuredOfferingIds.includes(service.clientId ?? service.id ?? ""),
      id: service.id ?? service.clientId,
      isNew: !service.id,
      messageForPricing: Boolean(service.messageForPricing),
      photos: service.photos ?? [],
      title: service.title ?? "",
      turnaroundDays: service.turnaroundDays ?? null
    })),
    state: parsed.state || "",
    tagline: parsed.tagline || "",
    tiktokUrl: parsed.tiktokUrl || "",
    website: parsed.website || "",
    savedAt: new Date().toISOString()
  }));
  const orderedOfferingIds = parsed.offeringOrder.filter((id) => existingOfferingIds.includes(id));
  const featuredOfferingIds = parsed.featuredOfferingIds
    .filter((id) => existingOfferingIds.includes(id) && !hiddenOfferingIds.includes(id));

  return {
    draftPayload,
    featuredOfferingIds,
    hiddenOfferingIds,
    orderedOfferingIds,
    sanitizedHiddenSections,
    sanitizedSectionLabels,
    sanitizedSectionOrder,
    storefrontPalette
  };
}

export async function autosaveStorefrontDraftAction(input: unknown) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const rate = await checkServerActionRateLimit([
    { key: "storefront-draft-autosave:ip:{ip}", limit: 90, intervalMs: 60_000 },
    { key: `storefront-draft-autosave:user:${session.user.id}`, limit: 45, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return { ok: false, error: "Autosave is pausing for a moment. Your changes are still in the editor." };
  }

  const result = storefrontCustomizationSchema.safeParse({ ...(typeof input === "object" && input ? input : {}), intent: "draft" });
  if (!result.success) {
    return { ok: false, error: firstValidationMessage(result.error, storefrontCustomizeLabels) };
  }

  const parsed = result.data;
  const vendor = await db.vendorProfile.findFirst({
    where: {
      id: parsed.businessId,
      ...(session.user.role === UserRole.ADMIN
        ? {}
        : {
            OR: [
              { userId: session.user.id },
              { managers: { some: { userId: session.user.id } } }
            ]
          })
    },
    select: {
      id: true,
      slug: true,
      offerings: { select: { id: true } }
    }
  });
  if (!vendor) {
    return { ok: false, error: "That business could not be found." };
  }

  const { draftPayload } = prepareStorefrontCustomizationPayload(
    parsed,
    vendor.offerings.map((offering) => offering.id)
  );
  await db.vendorProfile.update({
    where: { id: vendor.id },
    data: { storefrontDraftJson: draftPayload }
  });
  revalidatePath(`/vendor/business/${vendor.slug}/storefront`);

  return { ok: true, savedAt: String(draftPayload.savedAt) };
}

export async function updateStorefrontCustomizationAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const submittedBusinessSlug = slugifyBusinessUrl(String(formData.get("businessSlug") ?? ""));
  const customizeErrorBasePath = submittedBusinessSlug ? `/vendor/business/${submittedBusinessSlug}/storefront` : "/vendor/dashboard";
  const redirectWithCustomizeError = (message: string): never => {
    redirect(`${customizeErrorBasePath}?customizeError=${encodeURIComponent(message)}`);
  };
  const rate = await checkServerActionRateLimit([
    { key: "storefront-customize:ip:{ip}", limit: 24, intervalMs: 60_000 },
    { key: `storefront-customize:user:${session.user.id}`, limit: 10, intervalMs: 60_000 }
  ]);
  if (!rate.ok) {
    return redirectWithCustomizeError("Please wait a minute before publishing again.");
  }

  const result = storefrontCustomizationSchema.safeParse(storefrontCustomizationPayloadFromFormData(formData));
  if (!result.success) {
    const message = firstValidationMessage(result.error, storefrontCustomizeLabels);
    return redirectWithCustomizeError(message);
  }

  const parsed = result.data;
  const vendor = await db.vendorProfile.findFirst({
    where: {
      id: parsed.businessId,
      ...(session.user.role === UserRole.ADMIN
        ? {}
        : {
            OR: [
              { userId: session.user.id },
              { managers: { some: { userId: session.user.id } } }
            ]
          })
    },
    select: {
      id: true,
      city: true,
      slug: true,
      state: true,
      offerings: { select: { id: true } }
    }
  });
  if (!vendor) {
    return redirectWithCustomizeError("That business could not be found.");
  }
  const existingOfferingIds = vendor.offerings.map((offering) => offering.id);
  const {
    draftPayload,
    featuredOfferingIds,
    hiddenOfferingIds,
    orderedOfferingIds,
    sanitizedHiddenSections,
    sanitizedSectionLabels,
    sanitizedSectionOrder,
    storefrontPalette
  } = prepareStorefrontCustomizationPayload(parsed, existingOfferingIds);

  if (parsed.intent === "draft") {
    await db.vendorProfile.update({
      where: { id: vendor.id },
      data: { storefrontDraftJson: draftPayload }
    });
    revalidatePath(`/vendor/business/${vendor.slug}/storefront`);
    redirect(`/vendor/business/${vendor.slug}/storefront?draft=1`);
  }

  await db.vendorProfile.update({
    where: { id: vendor.id },
    data: {
      name: parsed.name,
      city: parsed.city,
      state: parsed.state || null,
      bio: parsed.bio || null,
      logoUrl: parsed.logoUrl || null,
      coverPhoto: parsed.coverPhoto || null,
      photos: parsed.photoUrls,
      serviceAreaNotes: parsed.serviceAreaNotes || null,
      availabilityNotes: parsed.availabilityNotes || null,
      website: parsed.website || null,
      instagramUrl: parsed.instagramUrl || null,
      tiktokUrl: parsed.tiktokUrl || null,
      storefrontTagline: parsed.tagline || null,
      storefrontAboutHeading: parsed.aboutHeading || null,
      storefrontAboutImage: parsed.aboutImage || null,
      storefrontLayout: parsed.layout,
      storefrontFontStyle: parsed.fontStyle,
      storefrontPalette,
      storefrontButtonStyle: parsed.buttonStyle,
      storefrontImageShape: parsed.imageShape,
      storefrontTextTone: parsed.textTone,
      storefrontAccentColor: storefrontAccentColorFromPalette(storefrontPalette),
      storefrontSectionOrder: sanitizedSectionOrder,
      storefrontHiddenSections: sanitizedHiddenSections,
      storefrontDraftJson: Prisma.JsonNull,
      storefrontFaqJson: parseEditorJson(parsed.faqJson) ?? Prisma.JsonNull,
      storefrontPoliciesJson: parseEditorJson(parsed.policiesJson) ?? Prisma.JsonNull,
      storefrontBookingJson: parseEditorJson(parsed.bookingJson) ?? Prisma.JsonNull,
      storefrontSectionLabels: Object.keys(sanitizedSectionLabels).length ? sanitizedSectionLabels : Prisma.JsonNull,
      storefrontFeaturedOfferingIds: featuredOfferingIds,
      storefrontHiddenOfferingIds: hiddenOfferingIds,
      storefrontOfferingOrder: [...orderedOfferingIds, ...existingOfferingIds.filter((id) => !orderedOfferingIds.includes(id))]
    }
  });

  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/business/${vendor.slug}`);
  revalidatePath(`/vendor/business/${vendor.slug}/storefront`);
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  revalidatePath(storefrontPath(vendor.slug));
  redirect(`/vendor/business/${vendor.slug}/storefront?published=1`);
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

  const businessId = String(formData.get("businessId") ?? "").trim();
  const isCreatingNewBusiness = String(formData.get("newBusiness") ?? "") === "1";
  const existingVendor = businessId
    ? await db.vendorProfile.findFirst({
        where: {
          id: businessId,
          ...businessManagerWhere(session.user.id, session.user.role)
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          username: true,
          userId: true,
          managers: { where: { userId: session.user.id }, select: { userId: true }, take: 1 },
          _count: { select: { managers: true } }
        }
      })
    : isCreatingNewBusiness
      ? null
      : await db.vendorProfile.findFirst({
        where: { userId: session.user.id },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          username: true,
          userId: true,
          managers: { where: { userId: session.user.id }, select: { userId: true }, take: 1 },
          _count: { select: { managers: true } }
        },
        orderBy: { createdAt: "asc" }
      });
  if (businessId && !existingVendor) {
    redirectWithVendorProfileError("That business could not be found for your account.", { newBusiness: isCreatingNewBusiness });
  }
  let targetVendor = existingVendor;
  const submittedStorefrontSlug = slugifyBusinessUrl(String(formData.get("slug") ?? ""));
  const submittedBusinessName = String(formData.get("name") ?? "");
  const requestedSlug = submittedStorefrontSlug || slugifyBusinessUrl(submittedBusinessName);
  const submittedVendorUsername = String(formData.get("username") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (isReservedStorefrontSlug(requestedSlug)) {
    redirectWithVendorProfileError("That storefront URL is reserved. Choose a different ending.", { newBusiness: isCreatingNewBusiness });
  }
  const conflictingBusinesses = requestedSlug || submittedVendorUsername
    ? await db.vendorProfile.findMany({
        where: {
          OR: [
            ...(requestedSlug ? [{ slug: requestedSlug }] : []),
            ...(submittedVendorUsername ? [{ username: submittedVendorUsername }] : [])
          ],
          ...(targetVendor ? { id: { not: targetVendor.id } } : {})
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          username: true,
          userId: true,
          managers: { where: { userId: session.user.id }, select: { userId: true }, take: 1 },
          _count: { select: { managers: true } }
        },
        take: 3
      })
    : [];
  if (conflictingBusinesses.length > 0) {
    const reusableBusinesses = conflictingBusinesses.filter((business) => {
      const isManagedByUser = business.userId === session.user.id || business.managers.length > 0;
      const isOwnerlessExactMatch =
        isCreatingNewBusiness &&
        !business.userId &&
        business._count.managers === 0 &&
        business.status === VendorProfileStatus.CLAIMED &&
        normalizeBusinessName(business.name) === normalizeBusinessName(submittedBusinessName);

      return isManagedByUser || isOwnerlessExactMatch;
    });
    const blockedBusiness = conflictingBusinesses.find(
      (business) => !reusableBusinesses.some((reusableBusiness) => reusableBusiness.id === business.id)
    );
    if (blockedBusiness) {
      const conflictField = blockedBusiness.username === submittedVendorUsername ? "username" : "storefront URL";
      redirectWithVendorProfileError(`That ${conflictField} is already taken by another storefront.`, {
        newBusiness: isCreatingNewBusiness
      });
    }

    const exactSlugMatch = reusableBusinesses.find((business) => business.slug === requestedSlug);
    const exactUsernameMatch = reusableBusinesses.find((business) => business.username === submittedVendorUsername);
    const reusableBusiness = exactSlugMatch ?? exactUsernameMatch ?? reusableBusinesses[0];
    const isOwnerlessExactMatch =
      reusableBusinesses.length > 1 &&
      !reusableBusinesses.some((business) => business.slug === requestedSlug && business.username === submittedVendorUsername);
    if (isOwnerlessExactMatch) {
      redirectWithVendorProfileError("We found more than one saved copy of that business. Open it from your vendor dashboard and update it there.", {
        newBusiness: isCreatingNewBusiness
      });
    }
    targetVendor = reusableBusiness;
  }
  const vendorUsername = submittedVendorUsername || targetVendor?.username || targetVendor?.slug || "";
  const vendorSlug = requestedSlug || targetVendor?.slug || slugify(vendorUsername || formData.get("name"));
  const result = vendorOnboardingSchema.safeParse({
    name: formData.get("name"),
    slug: vendorSlug,
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
    storefrontAccentColor: formData.get("storefrontAccentColor") || undefined,
    storefrontSectionOrder: formDataToArray(formData, "storefrontSectionOrder"),
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
        photoUrls: "Cover/banner image",
        categoryIds: "Categories"
      }),
      { newBusiness: isCreatingNewBusiness }
    );
  }
  const parsed = result.data;
  const logoCrop = parseImageCrop(formData.get("logoUrlCrop"));
  const photoCrops = parseImageCropArray(formData.getAll("photoUrlsCrop"));
  const coverPhotoCrop = photoCrops[0] ?? logoCrop;
  const validVendorCategoryCount = parsed.categoryIds.length
    ? await db.category.count({
        where: { id: { in: parsed.categoryIds }, audience: CategoryAudience.VENDOR }
      })
    : 0;
  if (validVendorCategoryCount !== parsed.categoryIds.length) {
    redirectWithVendorProfileError("One or more selected categories are invalid for vendors.", {
      newBusiness: isCreatingNewBusiness
    });
  }

  const existingPrimaryVendor = targetVendor
    ? null
    : await db.vendorProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      });

  let vendor;
  try {
    vendor = await db.$transaction(async (tx) => {
      const savedVendor = targetVendor
        ? await tx.vendorProfile.update({
            where: { id: targetVendor.id },
            data: {
              name: parsed.name,
              status: VendorProfileStatus.CLAIMED,
              slug: parsed.slug,
              username: parsed.username,
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
          })
        : await tx.vendorProfile.create({
            data: {
              userId: existingPrimaryVendor ? null : session.user.id,
              status: VendorProfileStatus.CLAIMED,
              claimedAt: new Date(),
              name: parsed.name,
              slug: parsed.slug,
              username: parsed.username,
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

      await tx.vendorProfileManager.upsert({
        where: {
          vendorProfileId_userId: {
            vendorProfileId: savedVendor.id,
            userId: session.user.id
          }
        },
        update: { role: "OWNER" },
        create: {
          role: "OWNER",
          userId: session.user.id,
          vendorProfileId: savedVendor.id
        }
      });

      await tx.vendorCategory.deleteMany({ where: { vendorId: savedVendor.id } });
      if (parsed.categoryIds.length > 0) {
        await tx.vendorCategory.createMany({
          data: parsed.categoryIds.map((categoryId) => ({ vendorId: savedVendor.id, categoryId })),
          skipDuplicates: true
        });
      }

      return savedVendor;
    });
  } catch (error) {
    securityLog("vendor_profile_upsert_failed", {
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown",
      userId: session.user.id
    });
    redirectWithVendorProfileError(
      isUniqueConstraintError(error)
        ? "That vendor username or shop username is already taken."
        : "Your vendor profile could not be saved. Please try again.",
      { newBusiness: isCreatingNewBusiness }
    );
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
  revalidatePath(`/vendor/dashboard/${vendor.slug}`);
  revalidatePath(`/vendor/business/${vendor.slug}`);
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  revalidatePath(storefrontPath(vendor.slug));
  redirect(`/vendor/business/${vendor.slug}`);
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

  const businessId = String(formData.get("businessId") ?? "").trim();
  const vendor = await db.vendorProfile.findFirst({
    where: businessId
      ? {
          id: businessId,
          ...businessManagerWhere(session.user.id, session.user.role)
        }
      : businessManagerWhere(session.user.id, session.user.role),
    orderBy: { createdAt: "asc" }
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
  revalidatePath(`/vendor/dashboard/${vendor.slug}`);
  revalidatePath(`/vendor/offering/${offeringId}`);
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  revalidatePath(storefrontPath(vendor.slug));
  revalidatePath(`/offering/${offeringId}`);
  revalidatePath("/listings");
  revalidatePath("/explore");
  revalidatePath("/categories");
  redirect("/vendor/dashboard#services");
}

export async function submitBusinessVerificationDocumentAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const vendorProfileId = String(formData.get("businessId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const file = formData.get("document");
  const expiresAtValue = String(formData.get("expiresAt") ?? "").trim();
  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  const maxSize = 8 * 1024 * 1024;

  if (!vendorProfileId || !Object.values(VerificationDocumentType).includes(type as VerificationDocumentType)) {
    throw new Error("Choose a valid credential type.");
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Upload documentation before requesting verification.");
  }
  if (!allowedTypes.has(file.type)) {
    throw new Error("Upload a PDF, JPG, PNG, or WebP document.");
  }
  if (file.size > maxSize) {
    throw new Error("Verification documents must be 8 MB or smaller.");
  }

  const vendor = await db.vendorProfile.findFirst({
    where: {
      id: vendorProfileId,
      OR: [
        { userId: session.user.id },
        { managers: { some: { userId: session.user.id } } }
      ]
    },
    select: { id: true, slug: true }
  });
  if (!vendor) {
    throw new Error("That business could not be found for your account.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await db.businessVerificationDocument.create({
    data: {
      contentType: file.type,
      data: bytes,
      expiresAt: expiresAtValue ? new Date(expiresAtValue) : null,
      originalName: file.name,
      size: file.size,
      status: "PENDING_REVIEW",
      storageKey: `business-verification/${vendor.id}/${Date.now()}-${slugify(file.name)}`,
      type: type as VerificationDocumentType,
      uploadedById: session.user.id,
      vendorProfileId: vendor.id
    }
  });

  revalidatePath(`/vendor/dashboard/${vendor.slug}`);
  revalidatePath(storefrontPath(vendor.slug));
}

export async function updateSellerMarketplaceSettingsAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  if (session.user.role === UserRole.VENDOR) {
    await requireVerifiedVendorProfile(session.user.id);
  }
  const businessId = String(formData.get("businessId") ?? "").trim();
  const vendor = await db.vendorProfile.findFirst({
    where: businessId
      ? {
          id: businessId,
          OR: [
            { userId: session.user.id },
            { managers: { some: { userId: session.user.id } } }
          ]
        }
      : {
          OR: [
            { userId: session.user.id },
            { managers: { some: { userId: session.user.id } } }
          ]
        },
    orderBy: { createdAt: "asc" }
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
  revalidatePath(`/vendor/dashboard/${vendor.slug}`);
}
