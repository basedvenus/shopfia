"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkServerActionRateLimit } from "@/lib/security/request";

export async function deletePartyEventAction(eventId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to delete your party." };
  if (typeof eventId !== "string" || !eventId.trim() || eventId.length > 128) return { ok: false, error: "Choose a party to delete." };
  const rate = await checkServerActionRateLimit([{ key: `party-delete:${session.user.id}`, limit: 10, intervalMs: 60_000 }]);
  if (!rate.ok) return { ok: false, error: "Please wait a minute before trying again." };
  try {
    const deleted = await db.$transaction(async (tx) => {
      const where = { id: eventId, userId: session.user.id };
      const party = await tx.partyEvent.findFirst({ where, select: { slug: true, user: { select: { username: true } } } });
      if (!party) return null;
      // Keep the ownership check on the write as well as the read.
      // Existing foreign-key cascades remove the party's photos and related records.
      const result = await tx.partyEvent.deleteMany({ where });
      return result.count === 1 ? party : null;
    });
    if (!deleted) return { ok: false, error: "This party could not be found or you don’t have permission to delete it." };
    for (const path of ["/", "/parties", "/my-parties", "/favorites", "/notifications", `/events/${deleted.slug}`]) revalidatePath(path);
    if (deleted.user.username) revalidatePath(`/profiles/${deleted.user.username}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Your party could not be deleted. Please try again." };
  }
}
