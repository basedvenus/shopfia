import Link from "next/link";
import { Armchair, Baby, BriefcaseBusiness, CakeSlice, Clapperboard, Flower2, Gift, GraduationCap, HeartHandshake, PanelsTopLeft, PartyPopper, Sparkles, UtensilsCrossed } from "lucide-react";
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
            <Link key={category.id} href={`/explore?categoryId=${category.id}`} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              <Card className="h-36 transition hover:-translate-y-0.5 hover:border-primary/30">
                <CardContent className="flex h-full items-center gap-4 p-5">
                  <CategoryIcon name={category.name} />
                  <div className="min-w-0">
                  <h2 className="font-semibold">{displayCategoryName(category.name)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryCounts.get(category.id)?.vendors ?? 0} vendors · {categoryCounts.get(category.id)?.offerings ?? 0} offerings
                  </p>
                </div>
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
            <Link key={category.id} href={`/explore?eventCategoryId=${category.id}`} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              <Card className="h-36 overflow-hidden border-white/70 bg-gradient-to-br from-white via-[#fff8f5] to-[#fbe2e6] transition hover:-translate-y-0.5">
                <CardContent className="flex h-full items-center gap-4 p-5">
                  <CategoryIcon name={category.name} />
                  <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                    Event inspiration
                  </p>
                  <h2 className="mt-2 font-semibold">{category.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryCounts.get(category.id)?.eventOfferings ?? 0} tagged offerings
                  </p>
                </div>
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

function CategoryIcon({ name }: { name: string }) {
  const icons = {
    Backdrops: PanelsTopLeft,
    "Cakes & Desserts": CakeSlice,
    "Catering & Beverages": UtensilsCrossed,
    "Children's Entertainment": Baby,
    Entertainment: Clapperboard,
    Florals: Flower2,
    "Party Rentals": Armchair,
    "Styling & Decor": Sparkles,
    "Baby Shower": Baby,
    "Birthday Party": PartyPopper,
    Wedding: HeartHandshake,
    "Corporate Event": BriefcaseBusiness,
    "Holiday Party": Gift,
    "Graduation Party": GraduationCap
  };
  const Icon = icons[name as keyof typeof icons] ?? Sparkles;
  return (
    <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
      {name === "Balloons" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <ellipse cx="12" cy="8" rx="6" ry="7" />
          <path d="m12 15-2 3h4l-2-3M12 18c-3 2 3 3 0 5M9 5c.5-1 1.5-1.5 2.5-1.5" />
        </svg>
      ) : <Icon className="h-6 w-6" strokeWidth={1.8} />}
    </span>
  );
}
