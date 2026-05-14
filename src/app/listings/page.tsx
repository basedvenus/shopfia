import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallbackListingImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";

export default async function ListingsPage() {
  const { db } = await import("@/lib/db");
  const listings = await db.listing.findMany({
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
              state: true
            }
          }
        }
      }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 48
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/60 bg-white/50 p-6 shadow-soft backdrop-blur">
        <Badge variant="accent">Marketplace Listings</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Browse active listings
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Real listings published by vendors. Each inquiry is saved to the database and linked to
          the correct vendor and listing.
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
            const image =
              listing.offering?.photos[0] ??
              vendor.coverPhoto ??
              vendor.photos[0] ??
              fallbackListingImage;

            return (
              <Card key={listing.id} className="overflow-hidden border-white/50 bg-white/90">
                <div className="relative aspect-[4/3] bg-[#f8ece9]">
                  <Image
                    src={image}
                    alt={listing.title}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute left-3 top-3">
                    <Badge className="bg-white/85 backdrop-blur" variant="outline">
                      {listing.category}
                    </Badge>
                  </div>
                </div>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{listing.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {vendor.name} · {vendor.city}
                        {vendor.state ? `, ${vendor.state}` : ""}
                      </p>
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
                      <Link href={`/offering/${listing.offering.id}`} className="flex-1">
                        <Badge className="w-full justify-center py-2" variant="accent">
                          View Listing
                        </Badge>
                      </Link>
                    ) : (
                      <Link href={`/vendor/profile/${vendor.slug}`} className="flex-1">
                        <Badge className="w-full justify-center py-2" variant="accent">
                          View Listing
                        </Badge>
                      </Link>
                    )}
                    <Link href={`/vendor/profile/${vendor.slug}`} className="flex-1">
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
