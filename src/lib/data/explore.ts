import { CategoryAudience, Prisma } from "@prisma/client";
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

const serviceCategoryOrder = [
  "Cakes & Desserts",
  "Florals",
  "Decor & Installation",
  "Styled Setups",
  "Event Planning",
  "Party Favors & Gifts",
  "Food & Beverage",
  "Kids Activities"
];

const eventCategoryOrder = [
  "Baby Shower",
  "Birthday Party",
  "Wedding",
  "Corporate Event",
  "Holiday Party",
  "Graduation Party"
];

function displayCategoryName(name: string) {
  return name === "Party Favors and Gifts" ? "Party Favors & Gifts" : name;
}

function sortByOrder<T extends { name: string }>(items: T[], order: string[]) {
  return [...items].sort((left, right) => {
    const leftIndex = order.indexOf(displayCategoryName(left.name));
    const rightIndex = order.indexOf(displayCategoryName(right.name));

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return displayCategoryName(left.name).localeCompare(displayCategoryName(right.name));
  });
}

export async function getExploreData(input: Record<string, string | string[] | undefined>) {
  const { db } = await import("@/lib/db");

  const clean = (v: unknown) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

  const parsed = exploreSearchSchema.parse({
    q: clean(input.q),
    city: clean(input.city),
    zip: clean(input.zip),
    categoryId: clean(input.categoryId),
    eventCategoryId: clean(input.eventCategoryId),
    minPrice: clean(input.minPrice),
    maxPrice: clean(input.maxPrice),
    availableWeekend: clean(input.availableWeekend),
    minRating: clean(input.minRating),
    radius: clean(input.radius),
    sort: clean(input.sort),
  });
  const minPriceCents = parsed.minPrice != null ? Math.round(parsed.minPrice * 100) : undefined;
  const maxPriceCents = parsed.maxPrice != null ? Math.round(parsed.maxPrice * 100) : undefined;

  const andFilters: Prisma.VendorProfileWhereInput[] = [
    { offerings: { some: { active: true } } }
  ];

  if (parsed.city) {
    andFilters.push({
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
    });
  }

  if (parsed.minRating) andFilters.push({ averageRating: { gte: parsed.minRating } });
  if (parsed.radius) andFilters.push({ serviceRadiusMiles: { gte: parsed.radius } });
  if (parsed.availableWeekend === "true") andFilters.push({ weekendAvailable: true });
  if (parsed.availableWeekend === "false") andFilters.push({ weekendAvailable: false });

  if (parsed.categoryId) {
    andFilters.push({
      OR: [
        { categories: { some: { categoryId: parsed.categoryId } } },
        { offerings: { some: { active: true, categoryId: parsed.categoryId } } }
      ]
    });
  }

  if (parsed.eventCategoryId) {
    andFilters.push({
      offerings: {
        some: {
          active: true,
          eventCategories: { some: { categoryId: parsed.eventCategoryId } }
        }
      }
    });
  }

  if (parsed.q) {
    andFilters.push({
      OR: [
        { name: { contains: parsed.q, mode: "insensitive" } },
        { bio: { contains: parsed.q, mode: "insensitive" } },
        {
          offerings: {
            some: {
              OR: [
                { title: { contains: parsed.q, mode: "insensitive" } },
                { description: { contains: parsed.q, mode: "insensitive" } },
                { tags: { has: parsed.q.toLowerCase() } },
                {
                  eventCategories: {
                    some: {
                      category: { name: { contains: parsed.q, mode: "insensitive" } }
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    });
  }

  const where: Prisma.VendorProfileWhereInput = { AND: andFilters };

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

  const [vendors, categories, eventCategories] = await Promise.all([
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
          select: { id: true, basePriceCents: true, category: { select: { name: true } }, type: true },
          take: 3,
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    db.category.findMany({
      where: { audience: CategoryAudience.VENDOR },
      orderBy: { name: "asc" }
    }),
    db.category.findMany({
      where: { audience: CategoryAudience.BUYER },
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

  return {
    filters: parsed,
    vendors: finalVendors,
    categories: sortByOrder(categories, serviceCategoryOrder).map((category) => ({
      ...category,
      name: displayCategoryName(category.name)
    })),
    eventCategories: sortByOrder(
      eventCategories.filter((category) => eventCategoryOrder.includes(category.name)),
      eventCategoryOrder
    )
  };
}
