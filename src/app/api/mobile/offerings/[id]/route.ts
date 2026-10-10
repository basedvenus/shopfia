import { NextResponse } from "next/server";
import { publicOfferingWhere } from "@/lib/public-marketplace";
import { publicUserProfile } from "@/lib/public-user-profile";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await import("@/lib/db");

  const offering = await db.offering.findFirst({
    where: publicOfferingWhere({ id, active: true }),
    include: {
      category: true,
      categories: { include: { category: true } },
      eventCategories: { include: { category: true } },
      vendor: {
        select: {
          id: true,
          averageRating: true,
          bio: true,
          categories: { include: { category: true } },
          city: true,
          coverPhoto: true,
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
          tiktokUrl: true,
          username: true,
          verified: true,
          website: true,
          zipCode: true,
          rankingScore: true,
          sellerRatingAggregate: true,
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      }
    }
  });

  if (!offering || !offering.active) {
    return NextResponse.json({ error: "Offering not found." }, { status: 404 });
  }

  return NextResponse.json({
    offering: {
      ...offering,
      vendor: { ...offering.vendor, user: publicUserProfile(offering.vendor.user) }
    }
  });
}
