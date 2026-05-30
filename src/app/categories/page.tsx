import Link from "next/link";
import { CategoryAudience } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { db } = await import("@/lib/db");
  const categories = await db.category.findMany({
    include: { _count: { select: { offerings: true, eventOfferings: true, vendors: true } } },
    orderBy: [{ audience: "asc" }, { name: "asc" }]
  }).catch((error) => {
    console.error("ShopFia categories failed", error);
    return fallbackCategories;
  });
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
                    {category._count.vendors} vendors · {category._count.offerings} offerings
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
                    {category._count.eventOfferings} tagged offerings
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
  "Catering",
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
    _count: { eventOfferings: 0, offerings: 0, vendors: 0 }
  })),
  ...eventCategoryOrder.map((name, index) => ({
    id: `event-${index}`,
    name,
    audience: CategoryAudience.BUYER,
    _count: { eventOfferings: 0, offerings: 0, vendors: 0 }
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
