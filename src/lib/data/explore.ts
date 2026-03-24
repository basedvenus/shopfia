import { CategoryAudience, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exploreSearchSchema } from "@/lib/validators/search";

function normalizeLocation(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getDistanceSortScore(vendor: {
  city: string;
  zipCode: string | null;
  serviceRadiusMiles: number;
}, locationQuery?: string) {
  const query = normalizeLocation(locationQuery);
  if (!query) {
    return vendor.serviceRadiusMiles;
  }

  const vendorCity = normalizeLocation(vendor.city);
  const vendorZip = normalizeLocation(vendor.zipCode);

  if (vendorZip && vendorZip === query) {
    return 0;
  }

  if (vendorCity === query) {
    return 1;
  }

  if (vendorCity.includes(query) || query.includes(vendorCity)) {
    return 2;
  }

  return 1000 + vendor.serviceRadiusMiles;
}

export async function getExploreData(input: Record<string, string | string[] | undefined>) {

  const clean = (v: unknown) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

  const parsed = exploreSearchSchema.parse({
    q: clean(input.q),
    city: clean(input.city),
    zip: clean(input.zip),
    categoryId: clean(input.categoryId),
    minPrice: clean(input.minPrice),
    maxPrice: clean(input.maxPrice),
    availableWeekend: clean(input.availableWeekend),
    minRating: clean(input.minRating),
    radius: clean(input.radius),
    sort: clean(input.sort),
  });
  const minPriceCents = parsed.minPrice != null ? Math.round(parsed.minPrice * 100) : undefined;
  const maxPriceCents = parsed.maxPrice != null ? Math.round(parsed.maxPrice * 100) : undefined;

  
  const where: Prisma.VendorProfileWhereInput = {
    verified: true,
    ...(parsed.city
      ? {
          OR: [
            {
              city: {
                contains: parsed.city,
                mode: "insensitive"
              }
            },
            {
              zipCode: {
                contains: parsed.city,
                mode: "insensitive"
              }
            }
          ]
        }
      : {}),
    ...(parsed.minRating ? { averageRating: { gte: parsed.minRating } } : {}),
    ...(parsed.radius ? { serviceRadiusMiles: { gte: parsed.radius } } : {}),
    ...(parsed.availableWeekend === "true" ? { weekendAvailable: true } : {}),
    ...(parsed.availableWeekend === "false" ? { weekendAvailable: false } : {}),
    ...(parsed.categoryId
      ? { categories: { some: { categoryId: parsed.categoryId } } }
      : {}),
    ...(parsed.q
      ? {
          OR: [
            { name: { contains: parsed.q, mode: "insensitive" } },
            { bio: { contains: parsed.q, mode: "insensitive" } },
            {
              offerings: {
                some: {
                  OR: [
                    { title: { contains: parsed.q, mode: "insensitive" } },
                    { description: { contains: parsed.q, mode: "insensitive" } },
                    { tags: { has: parsed.q.toLowerCase() } }
                  ]
                }
              }
            }
          ]
        }
      : {})
  };

  const orderBy =
    parsed.sort === "top-rated"
      ? [
          { rankingScore: { score: "desc" as const } },
          { averageRating: "desc" as const },
          { reviewCount: "desc" as const }
        ]
      : parsed.sort === "newest"
        ? [{ createdAt: "desc" as const }]
        : [
            { rankingScore: { score: "desc" as const } },
            { verified: "desc" as const },
            { reviewCount: "desc" as const },
            { createdAt: "desc" as const }
          ];

  const [vendors, categories] = await Promise.all([
    db.vendorProfile.findMany({
      where,
      take: 30,
      orderBy,
      include: {
        sellerRatingAggregate: true,
        rankingScore: true,
        categories: { include: { category: true } },
        offerings: {
          where: { active: true },
          select: { id: true, basePriceCents: true, type: true },
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    db.category.findMany({
      where: { audience: CategoryAudience.VENDOR },
      orderBy: { name: "asc" }
    })
  ]);

  const filteredByPrice = vendors.filter((vendor) => {
    const price = vendor.startingPriceCents ?? vendor.offerings[0]?.basePriceCents ?? null;
    if (!price) return true;
    if (minPriceCents != null && price < minPriceCents) return false;
    if (maxPriceCents != null && price > maxPriceCents) return false;
    return true;
  });

  const finalVendors =
    parsed.sort === "distance"
      ? [...filteredByPrice].sort((left, right) => {
          const scoreDifference =
            getDistanceSortScore(left, parsed.city) - getDistanceSortScore(right, parsed.city);

          if (scoreDifference !== 0) {
            return scoreDifference;
          }

          return (right.rankingScore?.score ?? 0) - (left.rankingScore?.score ?? 0);
        })
      : filteredByPrice;

  return { filters: parsed, vendors: finalVendors, categories };
}
