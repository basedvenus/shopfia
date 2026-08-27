import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
      categories: { include: { category: true } },
      city: true,
      coverPhoto: true,
      depositEnabled: true,
      depositPercent: true,
      formattedAddress: true,
      instagramUrl: true,
      logoUrl: true,
      name: true,
      offerings: {
        where: { active: true },
        include: {
          category: true,
          eventCategories: { include: { category: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      photos: true,
      rankingScore: true,
      reviewCount: true,
      reviews: {
        include: {
          buyer: {
            select: {
              id: true,
              image: true,
              name: true,
              username: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 8
      },
      serviceAreaNotes: true,
      serviceRadiusMiles: true,
      slug: true,
      startingPriceCents: true,
      state: true,
      status: true,
      tiktokUrl: true,
      username: true,
      verified: true,
      website: true,
      weekendAvailable: true,
      zipCode: true
    }
  });

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  }

  return NextResponse.json({ vendor });
}
