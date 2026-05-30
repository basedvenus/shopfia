export async function getVendorProfileBySlug(slug: string) {
  const { db } = await import("@/lib/db");
  const normalizedSlug = decodeURIComponent(slug).trim();

  return db.vendorProfile.findFirst({
    where: {
      OR: [
        { slug: normalizedSlug },
        { username: normalizedSlug },
        { id: normalizedSlug }
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          createdAt: true,
          email: true,
          username: true
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
      }
    }
  });
}
