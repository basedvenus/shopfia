import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const listings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      shop: {
        is: {
          vendorProfile: {
            is: {
              verified: true
            }
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

            return (
              <Card key={listing.id} className="overflow-hidden border-white/50 bg-white/90">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{listing.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {vendor.name} · {vendor.city}
                        {vendor.state ? `, ${vendor.state}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{listing.category}</Badge>
                  </div>

                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {listing.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <span>
                      From{" "}
                      <span className="font-semibold">
                        {listing.priceFrom != null ? formatCurrency(listing.priceFrom) : "Custom"}
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
                          View listing
                        </Badge>
                      </Link>
                    ) : (
                      <Link href={`/vendor/profile/${vendor.slug}`} className="flex-1">
                        <Badge className="w-full justify-center py-2" variant="accent">
                          Contact vendor
                        </Badge>
                      </Link>
                    )}
                    <Link href={`/vendor/profile/${vendor.slug}`} className="flex-1">
                      <Badge className="w-full justify-center py-2" variant="outline">
                        Vendor
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
