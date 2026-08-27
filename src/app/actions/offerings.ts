"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { storefrontPath } from "@/lib/businesses";
import { db } from "@/lib/db";

async function requireOwnedOffering(offeringId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in to manage services.");
  const offering = await db.offering.findUnique({
    where: { id: offeringId },
    include: {
      categories: { select: { categoryId: true } },
      eventCategories: { select: { categoryId: true } },
      vendor: { select: { id: true, slug: true, userId: true } }
    }
  });
  if (!offering || (session.user.role !== "ADMIN" && offering.vendor.userId !== session.user.id)) {
    throw new Error("That service could not be found for your business.");
  }
  return offering;
}

export async function toggleOfferingPublishedAction(formData: FormData) {
  const offering = await requireOwnedOffering(String(formData.get("offeringId") ?? ""));
  await db.offering.update({ where: { id: offering.id }, data: { active: !offering.active } });
  revalidateBusiness(offering.vendor.slug, offering.id);
}

export async function duplicateOfferingAction(formData: FormData) {
  const offering = await requireOwnedOffering(String(formData.get("offeringId") ?? ""));
  const duplicate = await db.offering.create({
    data: {
      active: false,
      addonsJson: offering.addonsJson ?? undefined,
      allowInstantBook: offering.allowInstantBook,
      basePriceCents: offering.basePriceCents,
      categoryId: offering.categoryId,
      description: offering.description,
      durationMinutes: offering.durationMinutes,
      faqJson: offering.faqJson ?? undefined,
      inventoryCount: offering.inventoryCount,
      messageForPricing: offering.messageForPricing,
      photoCrops: offering.photoCrops ?? undefined,
      photos: offering.photos,
      slug: await nextDuplicateSlug(offering.vendorId, offering.slug),
      tags: offering.tags,
      title: `${offering.title} Copy`,
      turnaroundDays: offering.turnaroundDays,
      type: offering.type,
      variantsJson: offering.variantsJson ?? undefined,
      vendorId: offering.vendorId
    }
  });
  if (offering.categories.length) {
    await db.offeringCategory.createMany({
      data: offering.categories.map((category) => ({ categoryId: category.categoryId, offeringId: duplicate.id })),
      skipDuplicates: true
    });
  }
  if (offering.eventCategories.length) {
    await db.offeringEventCategory.createMany({
      data: offering.eventCategories.map((category) => ({ categoryId: category.categoryId, offeringId: duplicate.id })),
      skipDuplicates: true
    });
  }
  revalidateBusiness(offering.vendor.slug, duplicate.id);
  redirect(`/vendor/offering/${duplicate.id}`);
}

export async function deleteOfferingAction(formData: FormData) {
  const offering = await requireOwnedOffering(String(formData.get("offeringId") ?? ""));
  await db.offering.delete({ where: { id: offering.id } });
  revalidateBusiness(offering.vendor.slug, offering.id);
}

async function nextDuplicateSlug(vendorId: string, slug: string) {
  const base = `${slug}-copy`;
  for (let index = 1; index <= 25; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`;
    const exists = await db.offering.findUnique({ where: { vendorId_slug: { vendorId, slug: candidate } }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function revalidateBusiness(slug: string, offeringId?: string) {
  revalidatePath("/vendor/dashboard");
  revalidatePath(`/vendor/business/${slug}`);
  revalidatePath(`/vendor/business/${slug}/storefront`);
  revalidatePath(storefrontPath(slug));
  revalidatePath("/explore");
  revalidatePath("/categories");
  if (offeringId) {
    revalidatePath(`/vendor/offering/${offeringId}`);
    revalidatePath(`/offering/${offeringId}`);
  }
}
