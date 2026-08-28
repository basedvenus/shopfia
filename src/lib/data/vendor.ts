export async function getVendorProfileBySlug(slug: string) {
  const { db } = await import("@/lib/db");
  const normalizedSlug = decodeURIComponent(slug).trim();

  const vendor = await db.vendorProfile.findFirst({
    where: {
      OR: [
        { slug: normalizedSlug },
        { username: normalizedSlug },
        { id: normalizedSlug }
      ]
    },
    select: {
      id: true,
      availabilityNotes: true,
      averageRating: true,
      bio: true,
      city: true,
      coverPhoto: true,
      createdAt: true,
      depositEnabled: true,
      depositPercent: true,
      formattedAddress: true,
      instagramUrl: true,
      logoUrl: true,
      name: true,
      photos: true,
      reviewCount: true,
      serviceAreaNotes: true,
      serviceRadiusMiles: true,
      slug: true,
      startingPriceCents: true,
      state: true,
      status: true,
      storefrontAboutHeading: true,
      storefrontAboutImage: true,
      storefrontButtonStyle: true,
      storefrontBookingJson: true,
      storefrontFaqJson: true,
      storefrontFeaturedOfferingIds: true,
      storefrontFontStyle: true,
      storefrontHiddenSections: true,
      storefrontImageShape: true,
      storefrontLayout: true,
      storefrontOfferingOrder: true,
      storefrontPalette: true,
      storefrontPoliciesJson: true,
      storefrontSectionOrder: true,
      storefrontTagline: true,
      tiktokUrl: true,
      userId: true,
      username: true,
      verified: true,
      website: true,
      weekendAvailable: true,
      user: {
        select: {
          id: true,
          createdAt: true,
          email: true,
          username: true,
          _count: {
            select: {
              followers: true
            }
          }
        }
      },
      sellerRatingAggregate: true,
      rankingScore: true,
      categories: { include: { category: true } },
      offerings: {
        where: { active: true },
        include: {
          category: true,
          eventCategories: { include: { category: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      reviews: {
        include: {
          buyer: {
            select: { id: true, createdAt: true, email: true, name: true, username: true, image: true }
          },
          response: true
        },
        orderBy: { createdAt: "desc" },
        take: 20
      },
      taggedPartyEvents: {
        include: {
          user: {
            select: {
              createdAt: true,
              email: true,
              name: true,
              username: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 6
      },
      taggedPartyPhotos: {
        where: {
          eventId: {
            not: null
          }
        },
        include: {
          vendorRatings: true,
          event: {
            include: {
              user: {
                select: {
                  createdAt: true,
                  email: true,
                  name: true,
                  username: true,
                  image: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 18
      },
      _count: {
        select: {
          favorites: true,
          orders: true
        }
      }
    }
  });

  return vendor ? { ...vendor, verificationDocuments: [] } : null;
}
