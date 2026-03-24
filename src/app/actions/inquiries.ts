"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { publicInquirySchema } from "@/lib/validators/inquiry";

export async function createPublicInquiryAction(formData: FormData) {
  const parsed = publicInquirySchema.parse({
    vendorProfileId: formData.get("vendorProfileId"),
    listingId: formData.get("listingId") || undefined,
    offeringId: formData.get("offeringId") || undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    eventDate: formData.get("eventDate") || undefined,
    eventLocation: formData.get("eventLocation"),
    budgetDollars: formData.get("budgetDollars") || undefined,
    message: formData.get("message")
  });

  const vendor = await db.vendorProfile.findUnique({
    where: { id: parsed.vendorProfileId },
    select: { id: true, slug: true, verified: true }
  });
  if (!vendor || !vendor.verified) {
    throw new Error("Vendor not found");
  }

  let listingId: string | null = null;
  let offeringId: string | null = null;

  if (parsed.listingId) {
    const listing = await db.listing.findUnique({
      where: { id: parsed.listingId },
      include: {
        shop: {
          select: { vendorProfileId: true }
        },
        offering: {
          select: { vendorId: true }
        }
      }
    });
    const listingVendorProfileId =
      listing?.shop?.vendorProfileId ??
      listing?.offering?.vendorId ??
      null;
    if (
      !listing ||
      listing.status !== "ACTIVE" ||
      listingVendorProfileId !== vendor.id
    ) {
      throw new Error("Listing not found");
    }
    listingId = listing.id;
    offeringId = listing.offeringId ?? null;
  }

  if (parsed.offeringId) {
    const offering = await db.offering.findUnique({
      where: { id: parsed.offeringId },
      select: { id: true, vendorId: true, active: true, listing: { select: { id: true } } }
    });
    if (!offering || !offering.active || offering.vendorId !== vendor.id) {
      throw new Error("Offering not found");
    }
    offeringId = offering.id;
    listingId = listingId ?? offering.listing?.id ?? null;
  }

  const inquiry = await db.inquiry.create({
    data: {
      vendorProfileId: vendor.id,
      listingId,
      offeringId,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone || null,
      eventDate: parsed.eventDate ? new Date(parsed.eventDate) : null,
      eventLocation: parsed.eventLocation,
      budgetCents:
        parsed.budgetDollars != null ? Math.round(parsed.budgetDollars * 100) : null,
      message: parsed.message || null
    }
  });

  revalidatePath("/admin");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  if (offeringId) {
    revalidatePath(`/offering/${offeringId}`);
  }

  return {
    success: true,
    inquiryId: inquiry.id
  };
}
