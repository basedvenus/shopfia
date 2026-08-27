import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallbackImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";

const favoriteMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("toggle"),
    targetId: z.string().min(1),
    targetType: z.enum(["vendor", "party", "offering"])
  }),
  z.object({
    action: z.literal("createCollection"),
    name: z.string().trim().min(1).max(80)
  })
]);

type MobileFavoriteItem = {
  eyebrow: string;
  href: string;
  id: string;
  image: string;
  meta: string;
  targetId: string;
  targetType: "vendor" | "party" | "offering";
  title: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getFavoriteLibrary(session.user.id));
}

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "mobile-favorites:ip:{ip}", limit: 80, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(`mobile-favorites:${session.user.id}`, 45, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Please wait a minute before saving more items." },
      { status: 429 }
    );
  }

  const parsed = favoriteMutationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid favorites request." }, { status: 400 });
  }

  if (parsed.data.action === "createCollection") {
    await db.favoriteCollection.upsert({
      where: {
        buyerId_name: {
          buyerId: session.user.id,
          name: parsed.data.name
        }
      },
      update: {},
      create: {
        buyerId: session.user.id,
        name: parsed.data.name
      }
    });

    return NextResponse.json(await getFavoriteLibrary(session.user.id));
  }

  const { targetId, targetType } = parsed.data;
  let saved = false;

  if (targetType === "vendor") {
    const vendor = await db.vendorProfile.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    const existing = await db.favorite.findUnique({
      where: { buyerId_vendorId: { buyerId: session.user.id, vendorId: vendor.id } }
    });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
    } else {
      await db.favorite.create({ data: { buyerId: session.user.id, vendorId: vendor.id } });
      saved = true;
    }
  }

  if (targetType === "party") {
    const party = await db.partyEvent.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!party) return NextResponse.json({ error: "Party not found." }, { status: 404 });
    const existing = await db.favorite.findUnique({
      where: { buyerId_partyEventId: { buyerId: session.user.id, partyEventId: party.id } }
    });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
    } else {
      await db.favorite.create({ data: { buyerId: session.user.id, partyEventId: party.id } });
      saved = true;
    }
  }

  if (targetType === "offering") {
    const offering = await db.offering.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!offering) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    const existing = await db.favorite.findUnique({
      where: { buyerId_offeringId: { buyerId: session.user.id, offeringId: offering.id } }
    });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
    } else {
      await db.favorite.create({ data: { buyerId: session.user.id, offeringId: offering.id } });
      saved = true;
    }
  }

  return NextResponse.json({ saved, targetId, targetType });
}

async function getFavoriteLibrary(buyerId: string) {
  const [favorites, collections] = await Promise.all([
    db.favorite.findMany({
      where: { buyerId },
      include: {
        vendor: true,
        partyEvent: {
          include: {
            photos: { orderBy: { sortOrder: "asc" }, take: 1 }
          }
        },
        offering: {
          include: {
            category: true,
            vendor: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    db.favoriteCollection.findMany({
      where: { buyerId },
      include: { _count: { select: { favorites: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    collections: collections.map((collection) => ({
      count: collection._count.favorites,
      id: collection.id,
      name: collection.name
    })),
    favorites: favorites.flatMap<MobileFavoriteItem>((favorite) => {
      if (favorite.vendor) {
        return [{
          eyebrow: "Vendor",
          href: `/${favorite.vendor.slug}`,
          id: favorite.id,
          image: favorite.vendor.coverPhoto ?? favorite.vendor.photos[0] ?? favorite.vendor.logoUrl ?? fallbackImage,
          meta: [favorite.vendor.city, favorite.vendor.state].filter(Boolean).join(", "),
          targetId: favorite.vendor.id,
          targetType: "vendor" as const,
          title: favorite.vendor.name
        }];
      }

      if (favorite.partyEvent) {
        const photo = favorite.partyEvent.photos[0];
        return [{
          eyebrow: "Party",
          href: `/events/${favorite.partyEvent.slug}`,
          id: favorite.id,
          image: photo
            ? partyPhotoUrl(photo.id, photo.updatedAt, { width: 900 })
            : favorite.partyEvent.coverImageUrl ?? favorite.partyEvent.imageUrls[0] ?? fallbackImage,
          meta: favorite.partyEvent.location ?? favorite.partyEvent.theme ?? "Saved inspiration",
          targetId: favorite.partyEvent.id,
          targetType: "party" as const,
          title: favorite.partyEvent.title
        }];
      }

      if (favorite.offering) {
        return [{
          eyebrow: favorite.offering.category.name,
          href: `/offering/${favorite.offering.id}`,
          id: favorite.id,
          image: favorite.offering.photos[0] ?? favorite.offering.vendor.coverPhoto ?? fallbackImage,
          meta: favorite.offering.messageForPricing
            ? "Message for pricing"
            : favorite.offering.basePriceCents
              ? `From ${formatCurrency(favorite.offering.basePriceCents)}`
              : "Custom pricing",
          targetId: favorite.offering.id,
          targetType: "offering" as const,
          title: favorite.offering.title
        }];
      }

      return [];
    }),
    savedIds: {
      offerings: favorites.flatMap((favorite) => favorite.offeringId ? [favorite.offeringId] : []),
      parties: favorites.flatMap((favorite) => favorite.partyEventId ? [favorite.partyEventId] : []),
      vendors: favorites.flatMap((favorite) => favorite.vendorId ? [favorite.vendorId] : [])
    }
  };
}
