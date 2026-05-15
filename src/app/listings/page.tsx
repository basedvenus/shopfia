import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { imageCropToCss, normalizeImageCrop } from "@/lib/image-crop";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";
import { formatCurrency } from "@/lib/utils";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const fallbackListingImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";

export default async function ListingsPage() {
  const [{ db }, session] = await Promise.all([import("@/lib/db"), auth()]);
  const [listings, originalMemberCutoff] = await Promise.all([
    db.listing.findMany({
    where: {
      status: "ACTIVE",
      shop: {
        is: {
          vendorProfile: {
            isNot: null
          }
        }
      }
    },
    include: {
      offering: {
        select: {
          id: true,
          photoCrops: true,
          photos: true,
          active: true
        }
      },
      shop: {
        select: {
          vendorProfile: {
            select: {
              id: true,
              slug: true,
              name: true,
              city: true,
              coverPhoto: true,
              photos: true,
              state: true,
              user: {
                select: {
                  createdAt: true,
                  email: true,
                  username: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 48
    }),
    getOriginalMemberCutoffDate(db)
  ]);
  const savedOfferingIds = session?.user?.id
    ? new Set(
        (
          await db.favorite.findMany({
            where: { buyerId: session.user.id, offeringId: { not: null } },
            select: { offeringId: true }
          })
        ).map((favorite) => favorite.offeringId).filter(Boolean) as string[]
      )
    : new Set<string>();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/60 bg-white/50 p-6 shadow-soft backdrop-blur">
        <Badge variant="accent">Vendor Services</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Find the vendors behind every event
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Explore celebrations styled by local artisans and discover the services that bring each party together.
        </p>
      </section>

      {listings.length === 0 ? (
        <div className="rounded-3xl border bg-white/80 p-8 text-center text-muted-foreground">
          No active listings yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => {
            const vendor = listing.shop?.vendorProfile;
            if (!vendor) return null;
            const vendorBadge = getProfileBadge(vendor.user, originalMemberCutoff, { vendorContext: true });
            const image =
              listing.offering?.photos[0] ??
              vendor.coverPhoto ??
              vendor.photos[0] ??
              fallbackListingImage;
            const offeringPhotoCrops = Array.isArray(listing.offering?.photoCrops)
              ? listing.offering.photoCrops
              : [];
            const crop = normalizeImageCrop(offeringPhotoCrops[0]);

            return (
              <Card key={listing.id} className="group relative overflow-hidden border-white/50 bg-white/90 transition hover:-translate-y-0.5 hover:shadow-soft">
                <Link
                  href={listing.offering?.active ? `/offering/${listing.offering.id}` : `/vendor/profile/${vendor.slug}`}
                  className="absolute inset-0 z-10"
                  aria-label={`View ${listing.title}`}
                />
                <div className="relative aspect-[4/3] bg-[#f8ece9]">
                  <Image
                    src={image}
                    alt={listing.title}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    style={imageCropToCss(crop)}
                  />
                  <div className="absolute left-3 top-3">
                    <Badge className="bg-white/85 backdrop-blur" variant="outline">
                      {listing.category}
                    </Badge>
                  </div>
                  {listing.offering?.id ? (
                    <div className="absolute right-3 top-3 z-20">
                      <FavoriteToggle
                        targetType="offering"
                        targetId={listing.offering.id}
                        isSaved={savedOfferingIds.has(listing.offering.id)}
                      />
                    </div>
                  ) : null}
                </div>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{listing.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {vendor.name} · {vendor.city}
                          {vendor.state ? `, ${vendor.state}` : ""}
                        </span>
                        <ProfileBadge badge={vendorBadge} />
                      </div>
                    </div>
                  </div>

                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {listing.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {listing.priceFrom != null ? "From " : ""}
                      <span className="font-semibold">
                        {listing.priceFrom != null ? formatCurrency(listing.priceFrom) : "Custom pricing"}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Qty {listing.availableQuantity}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {listing.offering?.active ? (
                      <Link href={`/offering/${listing.offering.id}`} className="relative z-20 flex-1">
                        <Badge className="w-full justify-center py-2" variant="accent">
                          View Listing
                        </Badge>
                      </Link>
                    ) : (
                      <Link href={`/vendor/profile/${vendor.slug}`} className="relative z-20 flex-1">
                        <Badge className="w-full justify-center py-2" variant="accent">
                          View Listing
                        </Badge>
                      </Link>
                    )}
                    <Link href={`/vendor/profile/${vendor.slug}`} className="relative z-20 flex-1">
                      <Badge className="w-full justify-center py-2" variant="outline">
                        Vendor Profile
                      </Badge>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
