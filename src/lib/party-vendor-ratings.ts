import type { Prisma } from "@prisma/client";
type RatedPhoto = { vendorIds: string[]; vendorRatings?: Record<string, number> };
/** Photo tags share one rating for each vendor in the current user's party. */
export function collectPartyVendorRatings(photos: RatedPhoto[], saved: Record<string, number> = {}) {
  const ratings = { ...saved };
  for (const photo of photos) {
    for (const vendorId of photo.vendorIds) {
      const rating = photo.vendorRatings?.[vendorId];
      if (typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5) ratings[vendorId] = rating;
    }
  }
  return ratings;
}
export async function persistPartyVendorRatings(tx: Pick<Prisma.TransactionClient, "partyVendorRating">, eventId: string, userId: string, vendorIds: string[], ratings: Record<string, number>) {
  for (const vendorId of new Set(vendorIds)) {
    const rating = ratings[vendorId];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    await tx.partyVendorRating.upsert({ where: { eventId_userId_vendorId: { eventId, userId, vendorId } }, update: { rating }, create: { eventId, userId, vendorId, rating } });
  }
}
