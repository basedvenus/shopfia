import type { Prisma } from "@prisma/client";
export const vendorDashboardSelect = {
      id: true,
      availabilityNotes: true,
      bio: true,
      city: true,
      formattedAddress: true,
      googlePlaceId: true,
      locationLat: true,
      locationLng: true,
      coverPhoto: true,
      instagramUrl: true,
      logoCrop: true,
      logoUrl: true,
      name: true,
      photos: true,
      serviceAreaNotes: true,
      serviceRadiusMiles: true,
      slug: true,
      state: true,
      status: true,
      stripeChargesEnabled: true,
      stripeOnboardingComplete: true,
      stripePayoutsEnabled: true,
      tiktokUrl: true,
      website: true,
      categories: { select: { category: { select: { name: true } }, categoryId: true }, take: 4 },
      verificationDocuments: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          expiresAt: true,
          id: true,
          originalName: true,
          reviewerNote: true,
          status: true,
          type: true
        },
        take: 12
      },
      inquiries: {
        orderBy: { createdAt: "desc" },
        select: { eventLocation: true, id: true, name: true, status: true, offering: { select: { title: true } } },
        take: 8
      },
      offerings: {
        orderBy: { createdAt: "desc" },
        select: {
          active: true,
          basePriceCents: true,
          category: { select: { name: true } },
          description: true,
          id: true,
          messageForPricing: true,
          photos: true,
          title: true
        }
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          amountCents: true,
          buyer: { select: { email: true, name: true } },
          buyerTotalCents: true,
          id: true,
          offering: { select: { title: true } },
          review: { select: { id: true } },
          quote: { select: { quoteRequest: { select: { conversationId: true } } } },
          status: true
        },
        take: 8
      },
      quoteRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          buyer: { select: { email: true, name: true } },
          eventLocation: true,
          id: true,
          offering: { select: { title: true } },
          quote: { select: { amountCents: true } },
          status: true
        },
        take: 8
      }
    } satisfies Prisma.VendorProfileSelect;
export type DashboardBusiness = Prisma.VendorProfileGetPayload<{select: typeof vendorDashboardSelect}>;
