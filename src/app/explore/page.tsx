import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ExploreSearch } from "@/components/explore/explore-search";
import { VendorCard } from "@/components/explore/vendor-card";
import { getExploreData } from "@/lib/data/explore";
import { auth } from "@/auth";
import { getOriginalMemberCutoffDate } from "@/lib/profile-badges";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { db } = await import("@/lib/db");
  const [data, session, originalMemberCutoff] = await Promise.all([
    getExploreData(searchParams),
    auth(),
    getOriginalMemberCutoffDate(db)
  ]);
  const savedVendorIds = session?.user?.id
    ? new Set(
        (
          await db.favorite.findMany({
            where: { buyerId: session.user.id, vendorId: { not: null } },
            select: { vendorId: true }
          })
        ).map((favorite) => favorite.vendorId).filter(Boolean) as string[]
      )
    : new Set<string>();

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/20 bg-white/70 uppercase tracking-[0.18em] text-primary">
            Discover Local Celebrations
          </Badge>
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Explore vendors, services, and real event inspiration.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Search what you need first, then refine by category, event style, availability, and travel radius when you are ready.
          </p>
        </div>
        <div className="mt-5">
          <Suspense>
            <ExploreSearch
              categories={data.categories}
              eventCategories={data.eventCategories}
              filters={data.filters}
            />
          </Suspense>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Explore Vendors</h2>
          <p className="text-sm text-muted-foreground">{data.vendors.length} results</p>
        </div>
        {data.vendors.length === 0 ? (
          <div className="rounded-3xl border bg-white/80 p-8 text-center text-muted-foreground">
            No vendors matched your filters yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                isSaved={savedVendorIds.has(vendor.id)}
                originalMemberCutoff={originalMemberCutoff}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
