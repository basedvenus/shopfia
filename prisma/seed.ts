import {
  CategoryAudience,
  OfferingType,
  OrderStatus,
  PrismaClient,
  UserRole
} from "@prisma/client";
import { ensureSellerAccountForVendorProfile } from "../src/lib/services/marketplace-fees";
import { refreshSellerReviewMetrics } from "../src/lib/services/reviews";

const prisma = new PrismaClient();

const categories = [
  { name: "Cakes & Desserts", iconName: "cake", audience: CategoryAudience.VENDOR },
  { name: "Decor & Installation", iconName: "party-popper", audience: CategoryAudience.VENDOR },
  { name: "Event Planning", iconName: "calendar-check-2", audience: CategoryAudience.VENDOR },
  { name: "Florals", iconName: "flower-2", audience: CategoryAudience.VENDOR },
  { name: "Food & Beverage", iconName: "utensils-crossed", audience: CategoryAudience.VENDOR },
  { name: "Kids Activities", iconName: "baby", audience: CategoryAudience.VENDOR },
  { name: "Styled Setups", iconName: "sofa", audience: CategoryAudience.VENDOR },
  { name: "Party Favors and Gifts", iconName: "gift", audience: CategoryAudience.VENDOR },
  { name: "Birthday Party", iconName: "cake-slice", audience: CategoryAudience.BUYER },
  { name: "Baby Shower", iconName: "baby", audience: CategoryAudience.BUYER },
  { name: "Wedding", iconName: "heart", audience: CategoryAudience.BUYER },
  { name: "Corporate Event", iconName: "briefcase", audience: CategoryAudience.BUYER },
  { name: "Holiday Party", iconName: "sparkles", audience: CategoryAudience.BUYER },
  { name: "Graduation Party", iconName: "graduation-cap", audience: CategoryAudience.BUYER }
] as const;

const cookiePhotos = [
  "/demo/vacaville-cookie-tulips.png",
  "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1200&q=80"
];

const floristPhotos = [
  "/demo/fairfield-lemon-tablescape.png",
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=1200&q=80"
];

async function seedCategories() {
  for (const { name, iconName, audience } of categories) {
    await prisma.category.upsert({
      where: { name },
      update: { iconName, audience },
      create: { name, iconName, audience }
    });
  }

  return Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]));
}

async function upsertVendorUser(input: {
  email: string;
  name: string;
  slug: string;
  username: string;
  website?: string;
  bio: string;
  city: string;
  state: string;
  serviceRadiusMiles: number;
  weekendAvailable: boolean;
  serviceAreaNotes: string;
  availabilityNotes: string;
  photos: string[];
  coverPhoto: string;
  logoUrl?: string;
  startingPriceCents: number;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: UserRole.VENDOR,
      vendorProfile: {
        upsert: {
          update: {
            slug: input.slug,
            username: input.username,
            website: input.website ?? null,
            name: input.name,
            bio: input.bio,
            city: input.city,
            state: input.state,
            serviceRadiusMiles: input.serviceRadiusMiles,
            weekendAvailable: input.weekendAvailable,
            serviceAreaNotes: input.serviceAreaNotes,
            availabilityNotes: input.availabilityNotes,
            photos: input.photos,
            coverPhoto: input.coverPhoto,
            logoUrl: input.logoUrl ?? input.coverPhoto,
            startingPriceCents: input.startingPriceCents,
            verified: true
          },
          create: {
            slug: input.slug,
            username: input.username,
            website: input.website ?? null,
            name: input.name,
            bio: input.bio,
            city: input.city,
            state: input.state,
            serviceRadiusMiles: input.serviceRadiusMiles,
            weekendAvailable: input.weekendAvailable,
            serviceAreaNotes: input.serviceAreaNotes,
            availabilityNotes: input.availabilityNotes,
            photos: input.photos,
            coverPhoto: input.coverPhoto,
            logoUrl: input.logoUrl ?? input.coverPhoto,
            startingPriceCents: input.startingPriceCents,
            verified: true
          }
        }
      }
    },
    create: {
      email: input.email,
      name: input.name,
      role: UserRole.VENDOR,
      vendorProfile: {
        create: {
          slug: input.slug,
          username: input.username,
          website: input.website ?? null,
          name: input.name,
          bio: input.bio,
          city: input.city,
          state: input.state,
          serviceRadiusMiles: input.serviceRadiusMiles,
          weekendAvailable: input.weekendAvailable,
          serviceAreaNotes: input.serviceAreaNotes,
          availabilityNotes: input.availabilityNotes,
          photos: input.photos,
          coverPhoto: input.coverPhoto,
          logoUrl: input.logoUrl ?? input.coverPhoto,
          startingPriceCents: input.startingPriceCents,
          verified: true
        }
      }
    },
    include: { vendorProfile: true }
  });
}

async function ensureVendorCategory(vendorId: string, categoryId: string) {
  await prisma.vendorCategory.upsert({
    where: {
      vendorId_categoryId: {
        vendorId,
        categoryId
      }
    },
    update: {},
    create: {
      vendorId,
      categoryId
    }
  });
}

async function ensureOffering(input: {
  vendorId: string;
  slug: string;
  title: string;
  description: string;
  basePriceCents: number;
  categoryId: string;
  photos: string[];
  tags: string[];
  eventCategoryIds?: string[];
  durationMinutes?: number;
  turnaroundDays?: number;
}) {
  const offering = await prisma.offering.upsert({
    where: {
      vendorId_slug: {
        vendorId: input.vendorId,
        slug: input.slug
      }
    },
    update: {
      title: input.title,
      description: input.description,
      basePriceCents: input.basePriceCents,
      categoryId: input.categoryId,
      photos: input.photos,
      tags: input.tags,
      durationMinutes: input.durationMinutes,
      turnaroundDays: input.turnaroundDays,
      active: true,
      type: OfferingType.SERVICE
    },
    create: {
      vendorId: input.vendorId,
      type: OfferingType.SERVICE,
      title: input.title,
      slug: input.slug,
      description: input.description,
      basePriceCents: input.basePriceCents,
      categoryId: input.categoryId,
      tags: input.tags,
      photos: input.photos,
      durationMinutes: input.durationMinutes,
      turnaroundDays: input.turnaroundDays,
      allowInstantBook: false
    }
  });

  await prisma.offeringEventCategory.deleteMany({ where: { offeringId: offering.id } });
  if (input.eventCategoryIds?.length) {
    await prisma.offeringEventCategory.createMany({
      data: input.eventCategoryIds.map((categoryId) => ({
        offeringId: offering.id,
        categoryId
      })),
      skipDuplicates: true
    });
  }

  return offering;
}

async function ensureCompletedOrder(input: {
  buyerId: string;
  vendorId: string;
  vendorProfileId: string;
  offeringId: string;
  amountCents: number;
  notes: string;
}) {
  const existing = await prisma.order.findFirst({
    where: {
      buyerId: input.buyerId,
      vendorProfileId: input.vendorProfileId,
      offeringId: input.offeringId,
      notes: input.notes
    }
  });

  if (existing) {
    return prisma.order.update({
      where: { id: existing.id },
      data: {
        vendorId: input.vendorId,
        amountCents: input.amountCents,
        status: OrderStatus.completed,
        paymentSucceededAt: new Date(),
        completedAt: new Date(),
        reviewEligibleAt: new Date(),
        buyerTotalCents: input.amountCents,
        itemSubtotalCents: input.amountCents
      }
    });
  }

  return prisma.order.create({
    data: {
      buyerId: input.buyerId,
      vendorId: input.vendorId,
      vendorProfileId: input.vendorProfileId,
      offeringId: input.offeringId,
      amountCents: input.amountCents,
      status: OrderStatus.completed,
      paymentSucceededAt: new Date(),
      completedAt: new Date(),
      reviewEligibleAt: new Date(),
      buyerTotalCents: input.amountCents,
      itemSubtotalCents: input.amountCents,
      notes: input.notes
    }
  });
}

async function ensureReview(input: {
  orderId: string;
  buyerId: string;
  vendorId: string;
  rating: number;
  body: string;
}) {
  await prisma.review.upsert({
    where: { orderId: input.orderId },
    update: {
      rating: input.rating,
      body: input.body
    },
    create: {
      orderId: input.orderId,
      buyerId: input.buyerId,
      vendorId: input.vendorId,
      rating: input.rating,
      body: input.body
    }
  });
}

async function refreshVendorReviewStats(vendorId: string) {
  await refreshSellerReviewMetrics(vendorId, prisma);
}

async function cleanupLegacyDemoContent() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: ["cookies@shopfia.demo"] } },
        { email: { startsWith: "codex-vendor-" } }
      ]
    }
  });
}

async function main() {
  await cleanupLegacyDemoContent();
  const categoryMap = await seedCategories();

  const baker = await upsertVendorUser({
    email: "baker@shopfia.demo",
    name: "Blush Batch Cookie Atelier",
    slug: "blush-batch-cookie-atelier",
    username: "blushbatch",
    website: "https://www.shopfia.app/vendor/profile/blush-batch-cookie-atelier",
    bio: "A luxury custom cookie studio in Vacaville specializing in hand-piped floral sets, branded favors, and editorial dessert moments for showers, birthdays, weddings, and intimate celebrations.",
    city: "Vacaville",
    state: "CA",
    serviceRadiusMiles: 28,
    weekendAvailable: true,
    serviceAreaNotes: "Vacaville, Fairfield, Dixon, Suisun City, Vallejo, Benicia, and nearby Napa venues. Pickup is available in Vacaville with local delivery for event orders.",
    availabilityNotes: "Books 2-5 weeks ahead for custom sets. Limited rush availability for small favor boxes.",
    photos: cookiePhotos,
    coverPhoto: cookiePhotos[0],
    logoUrl: cookiePhotos[0],
    startingPriceCents: 7200
  });

  const florist = await upsertVendorUser({
    email: "florals@shopfia.demo",
    name: "Solano Flora & Table",
    slug: "solano-flora-and-table",
    username: "solanoflora",
    website: "https://www.shopfia.app/vendor/profile/solano-flora-and-table",
    bio: "Modern florals and elevated table styling for intimate Solano County events. Think soft garden arrangements, layered place settings, candlelight, and fresh seasonal details that photograph beautifully.",
    city: "Fairfield",
    state: "CA",
    serviceRadiusMiles: 35,
    weekendAvailable: true,
    serviceAreaNotes: "Fairfield, Suisun City, Vacaville, Vallejo, Benicia, Dixon, and Napa. Delivery and on-site styling are available for intimate events.",
    availabilityNotes: "Ideal booking window is 3-6 weeks before your event. Limited weekday micro-event availability.",
    photos: floristPhotos,
    coverPhoto: floristPhotos[0],
    logoUrl: floristPhotos[0],
    startingPriceCents: 18500
  });

  const buyerJordan = await prisma.user.upsert({
    where: { email: "buyer@shopfia.demo" },
    update: {
      name: "Jordan Buyer",
      role: UserRole.BUYER,
      username: "jordan.parties",
      bio: "Solano County mom planning sweet birthdays, baby showers, and cozy backyard celebrations.",
      instagramUrl: "https://instagram.com/shopfia",
      tiktokUrl: "https://www.tiktok.com/@shopfia",
      partyfulUrl: "https://www.partyful.com",
      partyPhotoUrls: [floristPhotos[0], cookiePhotos[0], floristPhotos[1]]
    },
    create: {
      email: "buyer@shopfia.demo",
      name: "Jordan Buyer",
      role: UserRole.BUYER,
      username: "jordan.parties",
      bio: "Solano County mom planning sweet birthdays, baby showers, and cozy backyard celebrations.",
      instagramUrl: "https://instagram.com/shopfia",
      tiktokUrl: "https://www.tiktok.com/@shopfia",
      partyfulUrl: "https://www.partyful.com",
      partyPhotoUrls: [floristPhotos[0], cookiePhotos[0], floristPhotos[1]]
    }
  });

  const buyerNia = await prisma.user.upsert({
    where: { email: "nia@shopfia.demo" },
    update: {
      name: "Nia Bennett",
      role: UserRole.BUYER
    },
    create: {
      email: "nia@shopfia.demo",
      name: "Nia Bennett",
      role: UserRole.BUYER
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@shopfia.demo" },
    update: {
      name: "ShopFia Admin",
      role: UserRole.ADMIN
    },
    create: {
      email: "admin@shopfia.demo",
      name: "ShopFia Admin",
      role: UserRole.ADMIN
    }
  });

  if (baker.vendorProfile) {
    await ensureSellerAccountForVendorProfile(baker.vendorProfile.id, prisma);
    await ensureVendorCategory(baker.vendorProfile.id, categoryMap["Cakes & Desserts"]);
    await ensureVendorCategory(baker.vendorProfile.id, categoryMap["Party Favors and Gifts"]);
    await ensureVendorCategory(baker.vendorProfile.id, categoryMap["Styled Setups"]);

    const signatureCake = await ensureOffering({
      vendorId: baker.vendorProfile.id,
      slug: "signature-cake",
      title: "Luxury Custom Cookie Set",
      description:
        "One dozen hand-decorated sugar cookies with a custom color story, florals, lettering, and premium gift-box presentation.",
      basePriceCents: 7200,
      categoryId: categoryMap["Cakes & Desserts"],
      eventCategoryIds: [
        categoryMap["Baby Shower"],
        categoryMap["Birthday Party"],
        categoryMap["Wedding"]
      ],
      photos: [cookiePhotos[0], cookiePhotos[1]],
      tags: ["custom cookies", "hand-piped", "party favors"],
      durationMinutes: 30,
      turnaroundDays: 10
    });

    const dessertBar = await ensureOffering({
      vendorId: baker.vendorProfile.id,
      slug: "storybook-dessert-bar",
      title: "Event Favor Cookie Bar",
      description:
        "A styled favor display with 3-5 dozen custom cookies, signage, trays, ribbon details, and setup for showers, birthdays, or brand events.",
      basePriceCents: 28500,
      categoryId: categoryMap["Styled Setups"],
      eventCategoryIds: [
        categoryMap["Baby Shower"],
        categoryMap["Birthday Party"],
        categoryMap["Corporate Event"]
      ],
      photos: [cookiePhotos[0], cookiePhotos[2], cookiePhotos[3]],
      tags: ["favor display", "onsite styling", "custom signage"],
      durationMinutes: 90,
      turnaroundDays: 14
    });

    const minis = await ensureOffering({
      vendorId: baker.vendorProfile.id,
      slug: "mini-cake-drop",
      title: "Petite Gift Box",
      description:
        "Six coordinated cookies in a keepsake box for bridesmaids, birthdays, teacher gifts, or thoughtful hostess moments.",
      basePriceCents: 4200,
      categoryId: categoryMap["Party Favors and Gifts"],
      eventCategoryIds: [
        categoryMap["Birthday Party"],
        categoryMap["Wedding"],
        categoryMap["Graduation Party"]
      ],
      photos: [cookiePhotos[1], cookiePhotos[0]],
      tags: ["gift box", "custom favors", "pickup option"],
      turnaroundDays: 5
    });

    const jordanOrder = await ensureCompletedOrder({
      buyerId: buyerJordan.id,
      vendorId: baker.id,
      vendorProfileId: baker.vendorProfile.id,
      offeringId: signatureCake.id,
      amountCents: 9600,
      notes: "Vacaville baby shower floral cookie set"
    });

    const niaOrder = await ensureCompletedOrder({
      buyerId: buyerNia.id,
      vendorId: baker.id,
      vendorProfileId: baker.vendorProfile.id,
      offeringId: dessertBar.id,
      amountCents: 34000,
      notes: "Fairfield first birthday cookie favor bar"
    });

    const jordanMiniOrder = await ensureCompletedOrder({
      buyerId: buyerJordan.id,
      vendorId: baker.id,
      vendorProfileId: baker.vendorProfile.id,
      offeringId: minis.id,
      amountCents: 5200,
      notes: "Benicia bridesmaid cookie boxes"
    });

    await ensureReview({
      orderId: jordanOrder.id,
      buyerId: buyerJordan.id,
      vendorId: baker.vendorProfile.id,
      rating: 5,
      body: "The cookies looked exactly like our inspiration board. Every detail felt custom, delicate, and gift-worthy."
    });

    await ensureReview({
      orderId: niaOrder.id,
      buyerId: buyerNia.id,
      vendorId: baker.vendorProfile.id,
      rating: 5,
      body: "Our favor table was the first thing guests photographed. Every cookie felt intentional, polished, and very us."
    });

    await ensureReview({
      orderId: jordanMiniOrder.id,
      buyerId: buyerJordan.id,
      vendorId: baker.vendorProfile.id,
      rating: 4,
      body: "Perfect for a smaller celebration. I would absolutely book again for gifts or party favors."
    });

    await refreshVendorReviewStats(baker.vendorProfile.id);
  }

  if (florist.vendorProfile) {
    await ensureSellerAccountForVendorProfile(florist.vendorProfile.id, prisma);
    await ensureVendorCategory(florist.vendorProfile.id, categoryMap["Florals"]);
    await ensureVendorCategory(florist.vendorProfile.id, categoryMap["Styled Setups"]);
    await ensureVendorCategory(florist.vendorProfile.id, categoryMap["Event Planning"]);

    await ensureOffering({
      vendorId: florist.vendorProfile.id,
      slug: "mini-event-floral-package",
      title: "Modern Floral Moment",
      description:
        "A refined floral package with a petite statement arrangement, bud vases, and candle styling for showers, dinners, and micro-events.",
      basePriceCents: 18500,
      categoryId: categoryMap["Florals"],
      eventCategoryIds: [
        categoryMap["Baby Shower"],
        categoryMap["Wedding"],
        categoryMap["Holiday Party"]
      ],
      photos: [floristPhotos[1], floristPhotos[0], floristPhotos[3]],
      tags: ["florals", "micro events", "candle styling"],
      turnaroundDays: 10
    });

    await ensureOffering({
      vendorId: florist.vendorProfile.id,
      slug: "intimate-tablescape-styling",
      title: "Intimate Tablescape Styling",
      description:
        "Layered linens, place settings, florals, candles, and seasonal details for dinner parties, bridal brunches, and backyard celebrations.",
      basePriceCents: 42000,
      categoryId: categoryMap["Styled Setups"],
      eventCategoryIds: [
        categoryMap["Baby Shower"],
        categoryMap["Birthday Party"],
        categoryMap["Graduation Party"]
      ],
      photos: [floristPhotos[0], floristPhotos[2], floristPhotos[1]],
      tags: ["tablescape", "place settings", "intimate events"],
      durationMinutes: 180,
      turnaroundDays: 21
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
