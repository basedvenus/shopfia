"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function deleteBusinessAction(businessId: string, confirmation: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Please sign in again before deleting your business." };
  try {
    const result = await db.$transaction(async (tx) => {
      const business = await tx.vendorProfile.findFirst({
        where: { id: businessId, userId: session.user.id },
        select: { name: true, slug: true, _count: { select: { orders: true, quoteRequests: true, conversations: true, inquiries: true, reviews: true, partyVendorRatings: true, partyPhotoRatings: true } } }
      });
      if (!business) return { error: "Only the business owner can delete this business." };
      if (confirmation.trim() !== business.name) return { error: "Type the business name exactly to confirm." };
      if (Object.values(business._count).some((count) => count > 0)) {
        return { error: "This business has customer requests, messages, bookings, or ratings. Contact ShopFia support to close it while preserving those records." };
      }
      // Listings outlive offerings; remove them from discovery before deleting the profile.
      await tx.listing.updateMany({ where: { offering: { vendorId: businessId } }, data: { status: "INACTIVE" } });
      await tx.vendorProfile.delete({ where: { id: businessId } });
      return { slug: business.slug };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return { error: result.error };
    revalidatePath("/vendor/dashboard");
    revalidatePath("/explore");
    revalidatePath(`/${result.slug}`);
    revalidatePath(`/vendor/profile/${result.slug}`);
    revalidatePath(`/vendor/business/${result.slug}`);
    return { success: true };
  } catch {
    return { error: "Your business was not deleted. Please try again or contact ShopFia support." };
  }
}
