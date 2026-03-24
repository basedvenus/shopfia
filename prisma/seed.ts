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
  { name: "Holiday Party", iconName: "sparkles", audience: CategoryAudience.BUYER }
] as const;

const mayaPhotos = [
  "https://images.unsplash.com/photo-1464306076886-da185f6a9d05?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1559622214-0f0d2f1c4d12?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=1200&q=80"
];

const floristPhotos = [
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80",
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
  bio: string;
  city: string;
  state: string;
  serviceRadiusMiles: number;
  weekendAvailable: boolean;
  serviceAreaNotes: string;
  availabilityNotes: string;
  photos: string[];
  coverPhoto: string;
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
            startingPriceCents: input.startingPriceCents,
            verified: true
          },
          create: {
            slug: input.slug,
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
  durationMinutes?: number;
  turnaroundDays?: number;
}) {
  return prisma.offering.upsert({
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

async function main() {
  const categoryMap = await seedCategories();

  const baker = await upsertVendorUser({
    email: "baker@shopfia.demo",
    name: "Maya Sweet Studio",
    slug: "maya-sweet-studio",
    bio: "Playful, pastel-forward cakes and dessert styling for birthdays, showers, and romantic dinner parties. Each setup is designed to feel editorial enough for your camera roll and practical enough for a real celebration.",
    city: "Austin",
    state: "TX",
    serviceRadiusMiles: 20,
    weekendAvailable: true,
    serviceAreaNotes: "Austin, Round Rock, Cedar Park, and nearby event venues. Delivery, setup, and breakdown are available for larger installs.",
    availabilityNotes: "Books most weekends 2-4 weeks ahead. Rush dates open up when production slots allow.",
    photos: mayaPhotos,
    coverPhoto: mayaPhotos[0],
    startingPriceCents: 8500
  });

  const florist = await upsertVendorUser({
    email: "florals@shopfia.demo",
    name: "Petal & Thread",
    slug: "petal-and-thread",
    bio: "Whimsical florals for intimate events and styled gifting.",
    city: "Austin",
    state: "TX",
    serviceRadiusMiles: 30,
    weekendAvailable: false,
    serviceAreaNotes: "Studio pickup or local delivery with install windows available for event work.",
    availabilityNotes: "Ideal booking window is 10-14 days before your event.",
    photos: floristPhotos,
    coverPhoto: floristPhotos[0],
    startingPriceCents: 12000
  });

  const buyerJordan = await prisma.user.upsert({
    where: { email: "buyer@shopfia.demo" },
    update: {
      name: "Jordan Buyer",
      role: UserRole.BUYER
    },
    create: {
      email: "buyer@shopfia.demo",
      name: "Jordan Buyer",
      role: UserRole.BUYER
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
    await ensureVendorCategory(baker.vendorProfile.id, categoryMap["Styled Setups"]);

    const signatureCake = await ensureOffering({
      vendorId: baker.vendorProfile.id,
      slug: "signature-cake",
      title: "Signature Celebration Cake",
      description:
        "Custom sketch, color story, floral or bow accents, and delivery within Maya's local service zone.",
      basePriceCents: 15000,
      categoryId: categoryMap["Cakes & Desserts"],
      photos: [mayaPhotos[0], mayaPhotos[2]],
      tags: ["buttercream", "custom design", "delivery included"],
      durationMinutes: 60,
      turnaroundDays: 7
    });

    const dessertBar = await ensureOffering({
      vendorId: baker.vendorProfile.id,
      slug: "storybook-dessert-bar",
      title: "Storybook Dessert Bar",
      description:
        "A full sweets table with layered cake, mini desserts, signage, stands, and on-site styling for showers or birthdays.",
      basePriceCents: 32500,
      categoryId: categoryMap["Styled Setups"],
      photos: [mayaPhotos[1], mayaPhotos[0], mayaPhotos[3]],
      tags: ["dessert table", "onsite styling", "signage"],
      durationMinutes: 180,
      turnaroundDays: 14
    });

    const minis = await ensureOffering({
      vendorId: baker.vendorProfile.id,
      slug: "mini-cake-drop",
      title: "Mini Cake Drop",
      description:
        "Petite heart cakes and bento sets for gifting, rehearsal dinners, and content-friendly celebrations.",
      basePriceCents: 8500,
      categoryId: categoryMap["Cakes & Desserts"],
      photos: [mayaPhotos[2], mayaPhotos[3]],
      tags: ["mini cakes", "giftable", "pickup option"],
      turnaroundDays: 5
    });

    const jordanOrder = await ensureCompletedOrder({
      buyerId: buyerJordan.id,
      vendorId: baker.id,
      vendorProfileId: baker.vendorProfile.id,
      offeringId: signatureCake.id,
      amountCents: 18800,
      notes: "Baby shower cloud cake"
    });

    const niaOrder = await ensureCompletedOrder({
      buyerId: buyerNia.id,
      vendorId: baker.id,
      vendorProfileId: baker.vendorProfile.id,
      offeringId: dessertBar.id,
      amountCents: 41200,
      notes: "First birthday dessert bar"
    });

    const jordanMiniOrder = await ensureCompletedOrder({
      buyerId: buyerJordan.id,
      vendorId: baker.id,
      vendorProfileId: baker.vendorProfile.id,
      offeringId: minis.id,
      amountCents: 9600,
      notes: "Anniversary mini cake set"
    });

    await ensureReview({
      orderId: jordanOrder.id,
      buyerId: buyerJordan.id,
      vendorId: baker.vendorProfile.id,
      rating: 5,
      body: "The cake looked exactly like the mood board and still tasted amazing the next day. Maya made the whole process feel easy and premium."
    });

    await ensureReview({
      orderId: niaOrder.id,
      buyerId: buyerNia.id,
      vendorId: baker.vendorProfile.id,
      rating: 5,
      body: "Our dessert table was the first thing guests photographed. Every piece felt intentional, polished, and very us."
    });

    await ensureReview({
      orderId: jordanMiniOrder.id,
      buyerId: buyerJordan.id,
      vendorId: baker.vendorProfile.id,
      rating: 4,
      body: "Perfect for a smaller celebration. I would absolutely book again for gifting or a dinner party."
    });

    await refreshVendorReviewStats(baker.vendorProfile.id);
  }

  if (florist.vendorProfile) {
    await ensureSellerAccountForVendorProfile(florist.vendorProfile.id, prisma);
    await ensureVendorCategory(florist.vendorProfile.id, categoryMap["Florals"]);

    await ensureOffering({
      vendorId: florist.vendorProfile.id,
      slug: "mini-event-floral-package",
      title: "Mini Event Floral Package",
      description:
        "Entry floral package with bouquet, bud vases, and low centerpieces for showers and dinners.",
      basePriceCents: 22000,
      categoryId: categoryMap["Florals"],
      photos: floristPhotos,
      tags: ["florals", "event styling", "bouquets"],
      turnaroundDays: 10
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
