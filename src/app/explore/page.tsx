import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ExploreSearch } from "@/components/explore/explore-search";
import { VendorCard } from "@/components/explore/vendor-card";
import { getExploreData } from "@/lib/data/explore";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await getExploreData(searchParams);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/60 bg-white/50 p-6 shadow-soft backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="accent">Local event services + artisan goods</Badge>
          <Badge variant="outline">Fast browsing</Badge>
          <Badge variant="outline">Message, quote, book</Badge>
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Discover local vendors for your next event
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse bakers, florists, rentals, balloon artists, and custom gift makers by service or event.
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
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
