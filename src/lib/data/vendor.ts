import { db } from "@/lib/db";

export async function getVendorProfileBySlug(slug: string) {
  return db.vendorProfile.findFirst({
    where: { slug, verified: true },
    include: {
      sellerRatingAggregate: true,
      rankingScore: true,
      categories: { include: { category: true } },
      offerings: {
        where: { active: true },
        include: { category: true },
        orderBy: { createdAt: "desc" }
      },
      reviews: {
        include: {
          buyer: {
            select: { id: true, name: true, image: true }
          },
          response: true
        },
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });
}
