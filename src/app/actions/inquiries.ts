"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { sendNewInquiryEmail } from "@/lib/email";
import { securityLog } from "@/lib/security/audit-log";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { publicInquirySchema } from "@/lib/validators/inquiry";
import { friendlyValidationMessage } from "@/lib/validators/messages";

export async function createPublicInquiryAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Create a free account or sign in to send this inquiry.",
      requiresAuth: true
    };
  }

  const ipRate = await checkServerActionRateLimit([
    { key: "inquiry:ip:{ip}", limit: 20, intervalMs: 60_000 }
  ]);
  if (!ipRate.ok) {
    return { success: false, error: "Please wait a minute before sending another inquiry." };
  }

  const parsedResult = publicInquirySchema.safeParse({
    vendorProfileId: formData.get("vendorProfileId"),
    listingId: formData.get("listingId") || undefined,
    offeringId: formData.get("offeringId") || undefined,
    name: formData.get("name"),
    email: optionalFormValue(formData.get("email")),
    phone: optionalFormValue(formData.get("phone")),
    eventDate: formData.get("eventDate") ?? "",
    eventLocation: formData.get("eventLocation"),
    formattedAddress: formData.get("locationFormattedAddress") || undefined,
    locationCity: formData.get("locationCity") || undefined,
    locationState: formData.get("locationState") || undefined,
    locationZipCode: formData.get("locationZipCode") || undefined,
    locationLat: formData.get("locationLat") || undefined,
    locationLng: formData.get("locationLng") || undefined,
    googlePlaceId: formData.get("locationPlaceId") || undefined,
    budgetDollars: formData.get("budgetDollars") || undefined,
    guestCount: formData.get("guestCount") || undefined,
    inspirationUrls: formData
      .getAll("inspirationUrls")
      .map((value) => String(value))
      .filter(Boolean),
    message: formData.get("message")
  });
  if (!parsedResult.success) {
    securityLog("inquiry_validation_failed", { userId: session.user.id });
    return {
      success: false,
      error: getInquiryValidationMessage(parsedResult.error.issues)
    };
  }
  const parsed = parsedResult.data;

  const rate = checkRateLimit(`inquiry:${session.user.id}`, 8, 60_000);
  if (!rate.ok) {
    return { success: false, error: "Please wait a minute before sending another inquiry." };
  }

  const vendor = await db.vendorProfile.findUnique({
    where: { id: parsed.vendorProfileId },
    select: { id: true, slug: true, name: true, userId: true, user: { select: { email: true } } }
  });
  if (!vendor) {
    return { success: false, error: "Vendor not found." };
  }
  if (vendor.userId === session.user.id && session.user.role !== UserRole.ADMIN) {
    return { success: false, error: "You cannot inquire on your own listing." };
  }

  let listingId: string | null = null;
  let offeringId: string | null = null;
  let listingTitle: string | null = null;

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
    if (!listing || listing.status !== "ACTIVE" || listingVendorProfileId !== vendor.id) {
      return { success: false, error: "Listing not found." };
    }
    listingId = listing.id;
    offeringId = listing.offeringId ?? null;
    listingTitle = listing.title;
  }

  if (parsed.offeringId) {
    const offering = await db.offering.findUnique({
      where: { id: parsed.offeringId },
      select: { id: true, vendorId: true, active: true, listing: { select: { id: true } } }
    });
    if (!offering || !offering.active || offering.vendorId !== vendor.id) {
      return { success: false, error: "Offering not found." };
    }
    offeringId = offering.id;
    listingId = listingId ?? offering.listing?.id ?? null;
  }

  const now = new Date();
  const eventLocation = parsed.formattedAddress || parsed.eventLocation || null;
  const result = await db.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: {
        buyerId_vendorId: {
          buyerId: session.user.id,
          vendorId: vendor.userId
        }
      },
      update: {
        lastMessageAt: now,
        listingId,
        offeringId
      },
      create: {
        buyerId: session.user.id,
        vendorId: vendor.userId,
        vendorProfileId: vendor.id,
        listingId,
        offeringId,
        lastMessageAt: now
      }
    });

    const inquiry = await tx.inquiry.create({
      data: {
        buyerId: session.user.id,
        vendorProfileId: vendor.id,
        listingId,
        offeringId,
        conversationId: conversation.id,
        name: parsed.name,
        email: parsed.email || null,
        phone: parsed.phone || null,
        eventDate: parsed.eventDate ? new Date(parsed.eventDate) : null,
        eventLocation,
        formattedAddress: parsed.formattedAddress || null,
        locationCity: parsed.locationCity || null,
        locationState: parsed.locationState || null,
        locationZipCode: parsed.locationZipCode || null,
        locationLat: parsed.locationLat ?? null,
        locationLng: parsed.locationLng ?? null,
        googlePlaceId: parsed.googlePlaceId || null,
        guestCount: parsed.guestCount ?? null,
        inspirationUrls: parsed.inspirationUrls,
        budgetCents:
          parsed.budgetDollars != null ? Math.round(parsed.budgetDollars * 100) : null,
        message: parsed.message
      }
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: session.user.id,
        body: `INQUIRY_CARD:${inquiry.id}`,
        attachments: parsed.inspirationUrls,
        readAt: null
      }
    });

    return {
      conversationId: conversation.id,
      inquiryId: inquiry.id
    };
  });

  revalidatePath("/messages");
  revalidatePath("/admin");
  revalidatePath(`/vendor/profile/${vendor.slug}`);
  if (offeringId) {
    revalidatePath(`/offering/${offeringId}`);
  }

  if (vendor.user.email) {
    await sendNewInquiryEmail({
      budgetCents: parsed.budgetDollars != null ? Math.round(parsed.budgetDollars * 100) : null,
      buyerName: parsed.name,
      eventDate: parsed.eventDate ? new Date(parsed.eventDate) : null,
      eventLocation: parsed.locationCity && parsed.locationState
        ? `${parsed.locationCity}, ${parsed.locationState}`
        : parsed.eventLocation,
      inquiryUrl: `${getBaseUrl()}/messages?conversationId=${result.conversationId}`,
      to: vendor.user.email
    });
  }

  return {
    success: true,
    conversationId: result.conversationId,
    inquiryId: result.inquiryId
  };
}

function getBaseUrl() {
  const configured =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return configured || "http://localhost:3000";
}

function optionalFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getInquiryValidationMessage(issues: { path: (string | number)[]; message: string }[]) {
  return friendlyValidationMessage(issues, {
    budgetDollars: "Budget",
    email: "Email",
    eventDate: "Event date",
    eventLocation: "Event location",
    guestCount: "Guest count",
    inspirationUrls: "Inspiration",
    message: "Inquiry message",
    name: "Your name",
    offeringId: "Listing",
    phone: "Phone number",
    vendorProfileId: "Vendor"
  }, "Check your inquiry details.");
}
