"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";

export async function toggleFavoriteAction(vendorId: string) {
  const { db } = await import("@/lib/db");
  const session = await requireRole([UserRole.BUYER, UserRole.ADMIN]);
  const vendor = await db.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true }
  });
  if (!vendor) throw new Error("Vendor not found");

  const existing = await db.favorite.findUnique({
    where: { buyerId_vendorId: { buyerId: session.user.id, vendorId } }
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
  } else {
    await db.favorite.create({
      data: { buyerId: session.user.id, vendorId }
    });
  }

  revalidatePath("/favorites");
  revalidatePath("/explore");
}
