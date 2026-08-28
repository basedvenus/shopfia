import Link from "next/link";
import { CategoryAudience } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { getExploreCategoryCounts } from "@/lib/data/category-counts";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { db } = await import("@/lib/db");
  const categories = await db.category.findMany({
    orderBy: [{ audience: "asc" }, { name: "asc" }]
  }).catch((error) => {
    console.error("ShopFia categories failed", error);
    return fallbackCategories;
  });
  const categoryCounts = new Map(
    await Promise.all(
      categories.map(async (category) => {
        return [category.id, await getExploreCategoryCounts(db, category.id)] as const;
      })
    )
  );
  const vendorCategories = sortByOrder(
    categories.filter((c) => c.audience === CategoryAudience.VENDOR),
    serviceCategoryOrder
  );
  const eventCategories = sortByOrder(
    categories.filter((c) => c.audience === CategoryAudience.BUYER && eventCategoryOrder.includes(c.name)),
    eventCategoryOrder
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Shop by Category</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendorCategories.map((category) => (
            <Link key={category.id} href={`/explore?categoryId=${category.id}`}>
              <Card className="h-full transition hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <h2 className="font-semibold">{displayCategoryName(category.name)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryCounts.get(category.id)?.vendors ?? 0} vendors · {categoryCounts.get(category.id)?.offerings ?? 0} offerings
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Shop by Event</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventCategories.map((category) => (
            <Link key={category.id} href={`/explore?eventCategoryId=${category.id}`}>
              <Card className="h-full overflow-hidden border-white/70 bg-gradient-to-br from-white via-[#fff8f5] to-[#fbe2e6] transition hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                    Event inspiration
                  </p>
                  <h2 className="mt-2 font-semibold">{category.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryCounts.get(category.id)?.eventOfferings ?? 0} tagged offerings
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const serviceCategoryOrder = [
  "Backdrops",
  "Balloons",
  "Cakes & Desserts",
  "Catering & Beverages",
  "Children's Entertainment",
  "Entertainment",
  "Florals",
  "Party Rentals",
  "Styling & Decor"
];

const eventCategoryOrder = [
  "Baby Shower",
  "Birthday Party",
  "Wedding",
  "Corporate Event",
  "Holiday Party",
  "Graduation Party"
];

const fallbackCategories = [
  ...serviceCategoryOrder.map((name, index) => ({
    id: `service-${index}`,
    name,
    audience: CategoryAudience.VENDOR,
  })),
  ...eventCategoryOrder.map((name, index) => ({
    id: `event-${index}`,
    name,
    audience: CategoryAudience.BUYER,
  }))
];

function displayCategoryName(name: string) {
  return name;
}

function sortByOrder<T extends { name: string }>(items: T[], order: string[]) {
  return [...items].sort((left, right) => {
    const leftIndex = order.indexOf(displayCategoryName(left.name));
    const rightIndex = order.indexOf(displayCategoryName(right.name));

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return displayCategoryName(left.name).localeCompare(displayCategoryName(right.name));
  });
}
