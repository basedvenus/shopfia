import { VENDOR_CATEGORY_NAMES, normalizeVendorCategoryId } from "@/lib/vendor-categories";
import { CategoryAudience, Prisma } from "@prisma/client";
import { exploreSearchSchema } from "@/lib/validators/search";
import type { z } from "zod";
import { publicVendorWhere, publicOfferingWhere } from "@/lib/public-marketplace";

type ExploreFilters = z.infer<typeof exploreSearchSchema>;
type LocatedRecord = {
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  googlePlaceId?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  serviceRadiusMiles?: number;
};

function normalizeLocation(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function distanceMiles(
  from: { lat: number; lng: number },
  to: { lat: number | null; lng: number | null }
) {
  if (to.lat == null || to.lng == null) return Number.POSITIVE_INFINITY;
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const clamped = Math.max(0, Math.min(1, a));
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

function getDistanceSortScore(vendor: {
  city: string;
  zipCode: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  serviceRadiusMiles: number;
}, locationQuery?: string, point?: { lat: number; lng: number }) {
  if (point) {
    const miles = distanceMiles(point, {
      lat: vendor.locationLat ?? null,
      lng: vendor.locationLng ?? null
    });
    return miles;
  }

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

  if (vendorCity && (vendorCity.includes(query) || query.includes(vendorCity))) {
    return 2;
  }

  return 1000 + vendor.serviceRadiusMiles;
}

// Without coordinates, location text is shared across every Explore result type.
function textLocationFilters(filters: ExploreFilters) {
  const query = filters.city ?? filters.locationLabel;
  return [
    ...(query ? [
      { city: { contains: query, mode: "insensitive" as const } },
      { state: { equals: query, mode: "insensitive" as const } },
      { zipCode: { contains: query, mode: "insensitive" as const } },
      { formattedAddress: { contains: query, mode: "insensitive" as const } }
    ] : []),
    ...(filters.placeId ? [{ googlePlaceId: filters.placeId }] : [])
  ];
}

type LocationWhere = {
  AND?: LocationWhere[];
  OR?: LocationWhere[];
  locationLat?: { gte: number; lte: number } | null;
  locationLng?: { gte?: number; lte?: number } | null;
  city?: { equals: string; mode: "insensitive" };
  zipCode?: { equals: string; mode: "insensitive" };
  googlePlaceId?: string;
};

function coordinateLocationFilter(filters: ExploreFilters, defaultRadius: number): LocationWhere {
  const lat = filters.lat!;
  const lng = filters.lng!;
  const angularRadius = (filters.radius ?? defaultRadius) / 3958.8;
  const latDelta = angularRadius * 180 / Math.PI;
  const bounds: LocationWhere[] = [{ locationLat: { gte: Math.max(-90, lat - latDelta), lte: Math.min(90, lat + latDelta) } }];
  if (Math.abs(lat) + latDelta < 90) {
    const lngDelta = Math.asin(Math.sin(angularRadius) / Math.cos(lat * Math.PI / 180)) * 180 / Math.PI;
    const west = lng - lngDelta;
    const east = lng + lngDelta;
    bounds.push(west < -180 ? { OR: [
      { locationLng: { gte: west + 360 } }, { locationLng: { lte: east } }
    ] } : east > 180 ? { OR: [
      { locationLng: { gte: west } }, { locationLng: { lte: east - 360 } }
    ] } : { locationLng: { gte: west, lte: east } });
  }
  const fallback: LocationWhere[] = [];
  if (filters.placeId) fallback.push({ googlePlaceId: filters.placeId });
  if (filters.zip) fallback.push({ zipCode: { equals: filters.zip, mode: "insensitive" } });
  const cityTerms = filters.locationCity ? [filters.locationCity] :
    (filters.locationLabel ?? filters.city ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  fallback.push(...cityTerms.map((city) => ({ city: { equals: city, mode: "insensitive" as const } })));
  return { OR: [
    { AND: bounds },
    ...(fallback.length ? [{ AND: [
      { OR: [{ locationLat: null }, { locationLng: null }] },
      { OR: fallback }
    ] }] : [])
  ] };
}

function matchesSearchLocation(record: LocatedRecord, filters: ExploreFilters) {
  if (filters.lat == null || filters.lng == null) return true;
  const miles = distanceMiles({ lat: filters.lat, lng: filters.lng }, {
    lat: record.locationLat ?? null,
    lng: record.locationLng ?? null
  });
  if (Number.isFinite(miles)) {
    // An explicit distance is a cap; default discovery also includes vendors
    // whose advertised service area reaches the selected location.
    return miles <= (filters.radius ?? Math.max(50, record.serviceRadiusMiles ?? 0));
  }

  // Legacy records may not have coordinates. Only retain them with positive
  // location evidence; an empty city must never match every selected place.
  if (filters.placeId && record.googlePlaceId === filters.placeId) return true;
  if (filters.zip && normalizeLocation(record.zipCode) === normalizeLocation(filters.zip)) return true;
  const city = normalizeLocation(record.city);
  if (!city) return false;
  const state = normalizeLocation(record.state);
  if (filters.locationCity) {
    return city === normalizeLocation(filters.locationCity) &&
      (!filters.locationState || state === normalizeLocation(filters.locationState));
  }
  const parts = normalizeLocation(filters.locationLabel ?? filters.city).split(",").map((part) => part.trim());
  return parts.includes(city) && (!state || parts.length === 1 || parts.some((part) => part === state || part.startsWith(`${state} `)));
}

// Coordinates need an exact in-memory distance check. Read subsequent batches
// rather than applying it only to the first globally ranked database page.
async function locationPage<T>(
  fetch: (page: { skip: number; take: number }) => Promise<T[]>,
  limit: number,
  filter?: (row: T) => boolean,
  compare?: (left: T, right: T) => number
) {
  if (!filter && !compare) return { items: await fetch({ skip: 0, take: limit }), truncated: false };
  const matches: T[] = [];
  const batchSize = 100;
  let skip = 0;
  // Bound work even for dense regions. Distance sorting is over these candidates.
  const maxCandidates = 1000;
  while (skip < maxCandidates) {
    const rows = await fetch({ skip, take: batchSize });
    matches.push(...(filter ? rows.filter(filter) : rows));
    if (rows.length < batchSize || (!compare && matches.length >= limit)) break;
    skip += rows.length;
  }
  if (compare) matches.sort(compare);
  return { items: matches.slice(0, limit), truncated: skip >= maxCandidates };
}

const serviceCategoryOrder: string[] = [...VENDOR_CATEGORY_NAMES];

const eventCategoryOrder = [
  "Baby Shower",
  "Birthday Party",
  "Bridal Shower",
  "Wedding",
  "Kids Party",
  "Garden Party",
  "Outdoor Event",
  "Picnic Party",
  "Corporate Event",
  "Holiday Party",
  "Graduation Party"
];

function displayCategoryName(name: string) {
  return name;
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
    zip: clean(input.zip) ?? clean(input.locationZipCode),
    locationCity: clean(input.locationCity),
    locationState: clean(input.locationState),
    placeId: clean(input.placeId),
    locationLabel: clean(input.locationLabel),
    lat: clean(input.lat),
    lng: clean(input.lng),
    theme: input.theme,
    categoryId: Array.isArray(input.categoryId) ? [...new Set(input.categoryId.map(normalizeVendorCategoryId))] : input.categoryId ? normalizeVendorCategoryId(input.categoryId) : undefined,
    eventCategoryId: clean(input.eventCategoryId),
    minPrice: clean(input.minPrice),
    maxPrice: clean(input.maxPrice),
    availableWeekend: clean(input.availableWeekend),
    minRating: clean(input.minRating),
    radius: clean(input.radius),
    verified: clean(input.verified),
    sort: clean(input.sort),
  });
  const minPriceCents = parsed.minPrice != null ? Math.round(parsed.minPrice * 100) : undefined;
  const maxPriceCents = parsed.maxPrice != null ? Math.round(parsed.maxPrice * 100) : undefined;
  const searchPoint = parsed.lat != null && parsed.lng != null
    ? { lat: parsed.lat, lng: parsed.lng }
    : undefined;

  const andFilters: Prisma.VendorProfileWhereInput[] = [publicVendorWhere()];
  const offeringAndFilters: Prisma.OfferingWhereInput[] = [publicOfferingWhere({ active: true })];
  if (searchPoint) {
    // Vendor input validation caps advertised travel at 200 miles.
    const locationFilter = coordinateLocationFilter(parsed, 200);
    andFilters.push(locationFilter);
    offeringAndFilters.push({ vendor: locationFilter });
  }

  if (!searchPoint) {
    const locationFilters = textLocationFilters(parsed);
    if (locationFilters.length) {
      andFilters.push({ OR: locationFilters });
      offeringAndFilters.push({ vendor: { OR: locationFilters } });
    }
    if (parsed.zip) {
      const zipFilter = { zipCode: { equals: parsed.zip, mode: "insensitive" as const } };
      andFilters.push(zipFilter);
      offeringAndFilters.push({ vendor: zipFilter });
    }
  }

  if (minPriceCents != null || maxPriceCents != null) {
    const priceFilter = { gte: minPriceCents, lte: maxPriceCents };
    andFilters.push({ startingPriceCents: priceFilter });
    offeringAndFilters.push({ basePriceCents: priceFilter, messageForPricing: false });
  }

  if (parsed.minRating) andFilters.push({ averageRating: { gte: parsed.minRating } });
  if (parsed.radius && !searchPoint) andFilters.push({ serviceRadiusMiles: { gte: parsed.radius } });
  if (parsed.minRating) offeringAndFilters.push({ vendor: { averageRating: { gte: parsed.minRating } } });
  if (parsed.radius && !searchPoint) offeringAndFilters.push({ vendor: { serviceRadiusMiles: { gte: parsed.radius } } });
  if (parsed.verified === "true") {
    andFilters.push({ verified: true });
    offeringAndFilters.push({ vendor: { verified: true } });
  }
  if (parsed.availableWeekend === "true") andFilters.push({ weekendAvailable: true });
  if (parsed.availableWeekend === "false") andFilters.push({ weekendAvailable: false });
  if (parsed.availableWeekend === "true") offeringAndFilters.push({ vendor: { weekendAvailable: true } });
  if (parsed.availableWeekend === "false") offeringAndFilters.push({ vendor: { weekendAvailable: false } });

  if (parsed.categoryId.length > 0) {
    andFilters.push({
      OR: [
        { categories: { some: { categoryId: { in: parsed.categoryId } } } },
        {
          offerings: {
            some: publicOfferingWhere({
              active: true,
              OR: [
                { categoryId: { in: parsed.categoryId } },
                { categories: { some: { categoryId: { in: parsed.categoryId } } } }
              ]
            })
          }
        }
      ]
    });
    offeringAndFilters.push({
      OR: [
        { categoryId: { in: parsed.categoryId } },
        { categories: { some: { categoryId: { in: parsed.categoryId } } } },
        { vendor: { categories: { some: { categoryId: { in: parsed.categoryId } } } } }
      ]
    });
  }

  if (parsed.eventCategoryId) {
    andFilters.push({
      offerings: {
        some: publicOfferingWhere({
          active: true,
          eventCategories: { some: { categoryId: parsed.eventCategoryId } }
        })
      }
    });
    offeringAndFilters.push({
      eventCategories: { some: { categoryId: parsed.eventCategoryId } }
    });
  }

  if (parsed.theme.length > 0) {
    const themeFilters = parsed.theme.flatMap((theme) => getThemeTerms(theme));
    if (themeFilters.length > 0) {
      andFilters.push({
        OR: themeFilters.flatMap((theme) => [
          { name: { contains: theme, mode: "insensitive" } },
          { bio: { contains: theme, mode: "insensitive" } },
          { categories: { some: { category: { name: { contains: theme, mode: "insensitive" } } } } },
          {
            offerings: {
              some: publicOfferingWhere({
                active: true,
                OR: [
                  { title: { contains: theme, mode: "insensitive" } },
                  { description: { contains: theme, mode: "insensitive" } },
                  { tags: { has: theme.toLowerCase() } },
                  { category: { name: { contains: theme, mode: "insensitive" } } },
                  { categories: { some: { category: { name: { contains: theme, mode: "insensitive" } } } } },
                  {
                    eventCategories: {
                      some: {
                        category: { name: { contains: theme, mode: "insensitive" } }
                      }
                    }
                  }
                ]
              })
            }
          }
        ])
      });
      offeringAndFilters.push({
        OR: themeFilters.flatMap((theme) => [
          { title: { contains: theme, mode: "insensitive" } },
          { description: { contains: theme, mode: "insensitive" } },
          { tags: { has: theme.toLowerCase() } },
          { category: { name: { contains: theme, mode: "insensitive" } } },
          { categories: { some: { category: { name: { contains: theme, mode: "insensitive" } } } } },
          { eventCategories: { some: { category: { name: { contains: theme, mode: "insensitive" } } } } },
          { vendor: { name: { contains: theme, mode: "insensitive" } } },
          { vendor: { bio: { contains: theme, mode: "insensitive" } } },
          { vendor: { categories: { some: { category: { name: { contains: theme, mode: "insensitive" } } } } } }
        ])
      });
    }
  }

  if (parsed.q) {
    andFilters.push({
      OR: [
        { name: { contains: parsed.q, mode: "insensitive" } },
        { username: { contains: parsed.q, mode: "insensitive" } },
        { slug: { contains: parsed.q, mode: "insensitive" } },
        { bio: { contains: parsed.q, mode: "insensitive" } },
        { city: { contains: parsed.q, mode: "insensitive" } },
        { state: { contains: parsed.q, mode: "insensitive" } },
        { zipCode: { contains: parsed.q, mode: "insensitive" } },
        { serviceAreaNotes: { contains: parsed.q, mode: "insensitive" } },
        { availabilityNotes: { contains: parsed.q, mode: "insensitive" } },
        { user: { username: { contains: parsed.q, mode: "insensitive" } } },
        {
          categories: {
            some: {
              category: { name: { contains: parsed.q, mode: "insensitive" } }
            }
          }
        },
        {
          offerings: {
            some: publicOfferingWhere({
              active: true,
              OR: [
                { title: { contains: parsed.q, mode: "insensitive" } },
                { description: { contains: parsed.q, mode: "insensitive" } },
                { tags: { has: parsed.q.toLowerCase() } },
                { category: { name: { contains: parsed.q, mode: "insensitive" } } },
                {
                  categories: {
                    some: {
                      category: { name: { contains: parsed.q, mode: "insensitive" } }
                    }
                  }
                },
                {
                  eventCategories: {
                    some: {
                      category: { name: { contains: parsed.q, mode: "insensitive" } }
                    }
                  }
                }
              ]
            })
          }
        }
      ]
    });
    offeringAndFilters.push({
      OR: [
        { title: { contains: parsed.q, mode: "insensitive" } },
        { description: { contains: parsed.q, mode: "insensitive" } },
        { tags: { has: parsed.q.toLowerCase() } },
        { category: { name: { contains: parsed.q, mode: "insensitive" } } },
        {
          categories: {
            some: {
              category: { name: { contains: parsed.q, mode: "insensitive" } }
            }
          }
        },
        {
          eventCategories: {
            some: {
              category: { name: { contains: parsed.q, mode: "insensitive" } }
            }
          }
        },
        { vendor: { name: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { username: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { bio: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { user: { username: { contains: parsed.q, mode: "insensitive" } } } },
        { vendor: { slug: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { city: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { state: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { zipCode: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { serviceAreaNotes: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { availabilityNotes: { contains: parsed.q, mode: "insensitive" } } },
        { vendor: { categories: { some: { category: { name: { contains: parsed.q, mode: "insensitive" } } } } } }
      ]
    });
  }

  const where: Prisma.VendorProfileWhereInput = { AND: andFilters };
  const offeringWhere: Prisma.OfferingWhereInput = { AND: offeringAndFilters };
  const partyAndFilters: Prisma.PartyEventWhereInput[] = [
    {
      OR: [
        { coverImageUrl: { not: null } },
        { imageUrls: { isEmpty: false } },
        { photos: { some: {} } }
      ]
    }
  ];

  if (searchPoint) partyAndFilters.push(coordinateLocationFilter(parsed, 50));

  if (!searchPoint) {
    const locationFilters = textLocationFilters(parsed);
    const locationQuery = parsed.city ?? parsed.locationLabel;
    if (locationFilters.length) partyAndFilters.push({ OR: [
      ...locationFilters,
      ...(locationQuery ? [{ location: { contains: locationQuery, mode: "insensitive" as const } }] : [])
    ] });
    if (parsed.zip) partyAndFilters.push({ zipCode: { equals: parsed.zip, mode: "insensitive" } });
  }

  if (parsed.categoryId.length > 0) {
    partyAndFilters.push({
      taggedVendors: {
        some: publicVendorWhere({
          OR: [
            { categories: { some: { categoryId: { in: parsed.categoryId } } } },
            {
              offerings: {
                some: publicOfferingWhere({
                  active: true,
                  OR: [
                    { categoryId: { in: parsed.categoryId } },
                    { categories: { some: { categoryId: { in: parsed.categoryId } } } }
                  ]
                })
              }
            }
          ]
        })
      }
    });
  }

  const partyTermGroups = [
    parsed.theme.flatMap((theme) => getThemeTerms(theme)),
    parsed.q ? [parsed.q] : []
  ];
  for (const partyThemeTerms of partyTermGroups.filter((terms) => terms.length > 0)) {
    partyAndFilters.push({
      OR: partyThemeTerms.flatMap((term) => [
        { title: { contains: term, mode: "insensitive" } },
        { theme: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
        { tags: { has: term.toLowerCase() } },
        {
          taggedVendors: {
            some: publicVendorWhere({
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { bio: { contains: term, mode: "insensitive" } },
                {
                  categories: {
                    some: {
                      category: { name: { contains: term, mode: "insensitive" } }
                    }
                  }
                }
              ]
            })
          }
        }
      ])
    });
  }

  const eventCategoriesPromise = db.category.findMany({
    where: { audience: CategoryAudience.BUYER },
    orderBy: { name: "asc" }
  });
  if (parsed.eventCategoryId) {
    const eventCategory = (await eventCategoriesPromise).find((category) => category.id === parsed.eventCategoryId);
    // Parties store their event type as text, rather than an Offering relation.
    partyAndFilters.push(eventCategory ? {
      OR: getThemeTerms(eventCategory.name).flatMap((term) => [
        { title: { contains: term, mode: "insensitive" as const } },
        { theme: { contains: term, mode: "insensitive" as const } },
        { tags: { has: term.toLowerCase() } }
      ])
    } : { id: { in: [] } });
  }

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

  const [vendorPage, offeringPage, partyPage, categories, eventCategories] = await Promise.all([
    locationPage((page) => db.vendorProfile.findMany({
      where,
      ...page,
      orderBy: [...orderBy, { id: "asc" }],
      select: {
        id: true,
        averageRating: true,
        city: true,
        coverPhoto: true,
        createdAt: true,
        locationLat: true,
        locationLng: true,
        googlePlaceId: true,
        logoCrop: true,
        logoUrl: true,
        name: true,
        photos: true,
        reviewCount: true,
        serviceRadiusMiles: true,
        slug: true,
        startingPriceCents: true,
        state: true,
        status: true,
        username: true,
        verified: true,
        zipCode: true,
        user: {
          select: {
            createdAt: true,
            email: true,
            username: true
          }
        },
        sellerRatingAggregate: true,
        rankingScore: true,
        categories: { include: { category: true } },
        offerings: {
          where: publicOfferingWhere({ active: true }),
          select: { id: true, basePriceCents: true, category: { select: { name: true } }, photos: true, title: true, type: true },
          take: 3,
          orderBy: { createdAt: "desc" }
        }
      }
    }), 30,
    searchPoint ? (vendor) => matchesSearchLocation(vendor, parsed) : undefined,
    parsed.sort === "distance" ? (left, right) => {
      const leftDistance = getDistanceSortScore(left, parsed.zip ?? parsed.city, searchPoint);
      const rightDistance = getDistanceSortScore(right, parsed.zip ?? parsed.city, searchPoint);
      return (leftDistance === rightDistance ? 0 : leftDistance - rightDistance) ||
        (right.rankingScore?.score ?? 0) - (left.rankingScore?.score ?? 0);
    } : undefined),
    locationPage((page) => db.offering.findMany({
      where: offeringWhere,
      ...page,
      orderBy: [parsed.sort === "top-rated"
        ? { vendor: { averageRating: "desc" } }
        : parsed.sort === "newest" ? { createdAt: "desc" } : { updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        basePriceCents: true,
        messageForPricing: true,
        photos: true,
        title: true,
        type: true,
        category: true,
        categories: { include: { category: true } },
        vendor: {
          select: {
            id: true,
            city: true,
            coverPhoto: true,
            locationLat: true,
            locationLng: true,
            googlePlaceId: true,
            name: true,
            photos: true,
            reviewCount: true,
            serviceRadiusMiles: true,
            slug: true,
            startingPriceCents: true,
            state: true,
            status: true,
            username: true,
            verified: true,
            zipCode: true,
            user: { select: { createdAt: true, email: true, username: true } },
            rankingScore: true
          }
        }
      }
    }), 36,
    searchPoint ? (offering) => matchesSearchLocation(offering.vendor, parsed) : undefined,
    parsed.sort === "distance" ? (left, right) => {
      const leftDistance = getDistanceSortScore(left.vendor, parsed.zip ?? parsed.city, searchPoint);
      const rightDistance = getDistanceSortScore(right.vendor, parsed.zip ?? parsed.city, searchPoint);
      return leftDistance === rightDistance ? 0 : leftDistance - rightDistance;
    } : undefined),
    locationPage((page) => db.partyEvent.findMany({
      where: { AND: partyAndFilters },
      ...page,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            createdAt: true,
            email: true,
            image: true,
            name: true,
            username: true
          }
        },
        photos: {
          orderBy: { sortOrder: "asc" },
          select: { crop: true, id: true, updatedAt: true },
          take: 1
        }
      }
    }), 48,
    searchPoint ? (party) => matchesSearchLocation(party, parsed) : undefined,
    searchPoint && parsed.sort === "distance" ? (left, right) => {
      const leftDistance = distanceMiles(searchPoint, { lat: left.locationLat, lng: left.locationLng });
      const rightDistance = distanceMiles(searchPoint, { lat: right.locationLat, lng: right.locationLng });
      return leftDistance === rightDistance ? 0 : leftDistance - rightDistance;
    } : undefined),
    db.category.findMany({
      where: { audience: CategoryAudience.VENDOR },
      orderBy: { name: "asc" }
    }),
    eventCategoriesPromise
  ]);

  return {
    filters: parsed,
    offerings: offeringPage.items,
    parties: partyPage.items,
    vendors: vendorPage.items,
    truncated: {
      vendors: vendorPage.truncated,
      offerings: offeringPage.truncated,
      parties: partyPage.truncated
    },
    categories: sortByOrder(categories, serviceCategoryOrder).map((category) => ({
      ...category,
      name: displayCategoryName(category.name)
    })),
    eventCategories: sortByOrder(
      eventCategories,
      eventCategoryOrder
    )
  };
}

function getThemeTerms(theme: string) {
  const normalized = theme.trim();
  const aliases: Record<string, string[]> = {
    "Birthday Party": ["Birthday Party", "birthday"],
    "Baby Shower": ["Baby Shower", "baby shower"],
    "Bridal Shower": ["Bridal Shower", "bridal shower"],
    Wedding: ["Wedding", "wedding"],
    "Kids Party": ["Kids Party", "kids", "children"],
    Luxury: ["Luxury", "luxury"],
    "Garden Party": ["Garden Party", "garden"],
    "Outdoor Event": ["Outdoor Event", "outdoor"],
    "Picnic Party": ["Picnic Party", "picnic"]
  };

  return aliases[normalized] ?? [normalized];
}
