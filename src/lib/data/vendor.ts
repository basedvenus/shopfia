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
          id: true
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
            select: { id: true, name: true, image: true }
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
          event: {
            include: {
              user: {
                select: {
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
