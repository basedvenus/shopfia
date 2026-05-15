"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { checkServerActionRateLimit } from "@/lib/security/request";

const favoriteTargetSchema = z.discriminatedUnion("targetType", [
  z.object({ targetType: z.literal("vendor"), targetId: z.string().min(1) }),
  z.object({ targetType: z.literal("party"), targetId: z.string().min(1) }),
  z.object({ targetType: z.literal("offering"), targetId: z.string().min(1) })
]);

export type FavoriteTargetType = z.infer<typeof favoriteTargetSchema>["targetType"];

export async function toggleFavoriteAction(targetTypeOrVendorId: FavoriteTargetType | string, targetId?: string) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const rate = await checkServerActionRateLimit([
    { key: "favorite-toggle:ip:{ip}", limit: 80, intervalMs: 60_000 },
    { key: `favorite-toggle:user:${session.user.id}`, limit: 45, intervalMs: 60_000 }
  ]);
  if (!rate.ok) throw new Error("Please wait a minute before saving more items.");

  const target = targetId
    ? favoriteTargetSchema.parse({ targetType: targetTypeOrVendorId, targetId })
    : favoriteTargetSchema.parse({ targetType: "vendor", targetId: targetTypeOrVendorId });

  if (target.targetType === "vendor") {
    const vendor = await db.vendorProfile.findUnique({
      where: { id: target.targetId },
      select: { id: true, slug: true }
    });
    if (!vendor) throw new Error("Vendor not found");

    const existing = await db.favorite.findUnique({
      where: { buyerId_vendorId: { buyerId: session.user.id, vendorId: vendor.id } }
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
    } else {
      await db.favorite.create({
        data: { buyerId: session.user.id, vendorId: vendor.id }
      });
    }

    revalidatePath(`/vendor/profile/${vendor.slug}`);
  }

  if (target.targetType === "party") {
    const party = await db.partyEvent.findUnique({
      where: { id: target.targetId },
      select: { id: true, slug: true }
    });
    if (!party) throw new Error("Party not found");

    const existing = await db.favorite.findUnique({
      where: { buyerId_partyEventId: { buyerId: session.user.id, partyEventId: party.id } }
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
    } else {
      await db.favorite.create({
        data: { buyerId: session.user.id, partyEventId: party.id }
      });
    }

    revalidatePath(`/events/${party.slug}`);
    revalidatePath("/parties");
  }

  if (target.targetType === "offering") {
    const offering = await db.offering.findUnique({
      where: { id: target.targetId },
      select: { id: true, vendor: { select: { slug: true } } }
    });
    if (!offering) throw new Error("Service not found");

    const existing = await db.favorite.findUnique({
      where: { buyerId_offeringId: { buyerId: session.user.id, offeringId: offering.id } }
    });

    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
    } else {
      await db.favorite.create({
        data: { buyerId: session.user.id, offeringId: offering.id }
      });
    }

    revalidatePath(`/offering/${offering.id}`);
    revalidatePath(`/vendor/profile/${offering.vendor.slug}`);
  }

  revalidatePath("/favorites");
  revalidatePath("/explore");
  revalidatePath("/listings");
}

export async function createFavoriteCollectionAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const rate = await checkServerActionRateLimit([
    { key: "favorite-collection:ip:{ip}", limit: 20, intervalMs: 60_000 },
    { key: `favorite-collection:user:${session.user.id}`, limit: 8, intervalMs: 60_000 }
  ]);
  if (!rate.ok) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await db.favoriteCollection.upsert({
    where: {
      buyerId_name: {
        buyerId: session.user.id,
        name
      }
    },
    update: {},
    create: {
      buyerId: session.user.id,
      name
    }
  });

  revalidatePath("/favorites");
}
